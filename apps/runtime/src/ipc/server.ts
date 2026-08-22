import type { ChangeSet, FailureContext, TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import { AgentChangeSetBuilder } from '../agents/AgentChangeSetBuilder.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';
import { AgentPlanner } from '../agents/AgentPlanner.js';
import { AgentProposalEngine, extractReferencedFilePaths } from '../agents/AgentProposalEngine.js';
import { AgentRuntime } from '../agents/AgentRuntime.js';
import { createConfiguredAgentProvider } from '../agents/llm/createConfiguredProvider.js';
import { createAgentWorkspaceProposalBuffer, createAgentWorkspaceTools } from '../agents/tools/AgentWorkspaceTools.js';
import { ToolRegistry } from '../agents/tools/ToolRegistry.js';
import { RepairAgent } from '../agents/RepairAgent.js';
import { RepairCoordinator, type RepairDecision } from '../agents/RepairCoordinator.js';
import type { AgentProposalFile } from '../agents/AgentProposalEngine.js';
import { ProjectController, type ProjectCommand, type ProjectCommandResult } from '../project/ProjectController.js';
import { ChangeSetService } from '../project/ChangeSetService.js';
import { FileService } from '../project/FileService.js';
import { ProjectService } from '../project/ProjectService.js';
import { TaskRunner, type TaskStatusEvent as RuntimeTaskStatusEvent } from '../tasks/TaskRunner.js';
import { TaskService } from '../tasks/TaskService.js';

export interface RuntimeHealth { status: 'ok'; version: string; }
export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
  handleProject(command: ProjectCommand): Promise<ProjectCommandResult>;
  submitTask(request: TaskSubmitRequest): Promise<TaskSubmitResult>;
  getTask(taskId: string): Promise<TaskResult | null>;
  repairTask(taskId: string, failure: FailureContext, files?: readonly AgentProposalFile[]): Promise<RepairDecision>;
  subscribeTask(listener: (event: TaskStatusEvent) => void): () => void;
}

export interface RuntimeServerOptions {
  taskStorePath?: string;
  repairAgent?: RepairAgent;
}

const REAL_AGENT_SYSTEM_PROMPT = [
  'You are IDLE, a coding agent working inside a user project.',
  'Inspect the repository with list_files and read_file before proposing changes.',
  'Use propose_create_file, propose_replace_line, and propose_delete_file to create a reviewable ChangeSet.',
  'Never claim that a file was changed: proposal tools do not write to disk.',
  'Do not use shell commands; this agent milestone exposes only workspace inspection and proposal tools.',
  'Prefer the smallest safe change that satisfies the user request.',
  'When the requested work is fully proposed, stop and summarize what you proposed.',
].join('\n');

const REPAIR_AGENT_SYSTEM_PROMPT = [
  'You are IDLE repair agent.',
  'Diagnose the supplied verification failure and propose the smallest safe code change.',
  'Never apply changes directly.',
  'Return only a supported ChangeSet proposal description.',
].join('\n');

function toContractStatus(status: RuntimeTaskStatusEvent['status']): TaskStatusEvent['status'] {
  return status === 'pending' ? 'queued' : status;
}

export function createRuntimeServer(version: string, options: RuntimeServerOptions = {}): RuntimeServer {
  let started = false;
  const projectService = new ProjectService();
  const fileService = new FileService(projectService);
  const changeSetService = new ChangeSetService(projectService, fileService);
  const projectController = new ProjectController(projectService, fileService, changeSetService);
  const taskListeners = new Set<(event: TaskStatusEvent) => void>();
  const taskService = new TaskService(options.taskStorePath);
  const generatedChangeSets = new Map<string, ChangeSet>();
  const agentExecutor = new AgentExecutor(projectService, fileService);
  const agentPlanner = new AgentPlanner();
  const agentProposalEngine = new AgentProposalEngine();
  const changeSetBuilder = new AgentChangeSetBuilder();
  const agentMode = process.env.IDLE_AGENT_MODE?.trim().toLowerCase() || 'deterministic';
  const llmProvider = agentMode === 'llm' ? createConfiguredAgentProvider() : undefined;
  const repairAgent = options.repairAgent ?? (llmProvider
    ? new RepairAgent(new AgentRuntime(llmProvider, new ToolRegistry(), {
      maxTurns: 4,
      systemPrompt: REPAIR_AGENT_SYSTEM_PROMPT,
    }))
    : undefined);
  const repairCoordinator = repairAgent
    ? new RepairCoordinator(taskService, { repairAgent })
    : undefined;

  const taskRunner = new TaskRunner(taskService, async (request) => {
    const inspection = await agentExecutor.execute(request);
    await taskService.checkpoint(request.id, { name: 'agent.inspection', data: inspection });
    const plan = agentPlanner.createPlan(inspection);
    await taskService.checkpoint(request.id, { name: 'agent.plan', data: plan });

    let changeSet: ChangeSet;
    if (llmProvider) {
      const proposals = createAgentWorkspaceProposalBuffer();
      const registry = new ToolRegistry();
      for (const tool of createAgentWorkspaceTools(fileService, proposals)) registry.register(tool);

      const runtime = new AgentRuntime(llmProvider, registry, {
        maxTurns: 8,
        systemPrompt: REAL_AGENT_SYSTEM_PROMPT,
      });
      const agent = await runtime.run({
        taskId: request.id,
        projectId: request.projectId,
        prompt: request.prompt ?? '',
      });
      await taskService.checkpoint(request.id, { name: 'agent.runtime', data: agent });
      if (agent.error) throw new Error(agent.error);
      changeSet = changeSetBuilder.createChangeSet(plan, proposals.changes);
    } else {
      const goal = request.prompt ?? '';
      const proposalFiles = (await Promise.all(extractReferencedFilePaths(goal).map(async (path) => {
        const state = await fileService.readState(request.projectId, path);
        return state.exists ? { path, content: state.content } : undefined;
      }))).filter((file): file is { path: string; content: string } => file !== undefined);
      const proposal = agentProposalEngine.propose({ taskId: request.id, goal, files: proposalFiles });
      changeSet = changeSetBuilder.createChangeSet(plan, proposal.changes);
    }

    generatedChangeSets.set(changeSet.id, changeSet);
    await taskService.checkpoint(request.id, { name: 'agent.changeset', data: changeSet });
  });

  taskRunner.subscribe((event) => {
    const status = toContractStatus(event.status);
    const contractEvent: TaskStatusEvent = {
      taskId: event.taskId as TaskStatusEvent['taskId'],
      status,
      timestamp: event.timestamp,
      ...(event.error ? { message: event.error } : {}),
    };
    for (const listener of taskListeners) listener(contractEvent);
  });

  return {
    async start() {
      if (started) return;
      await taskService.load();
      started = true;
      await taskRunner.resumePendingTasks();
    },
    async stop() {
      started = false;
      taskListeners.clear();
      generatedChangeSets.clear();
    },
    health() {
      if (!started) throw new Error('Runtime is not started');
      return { status: 'ok', version };
    },
    async handleProject(command) {
      if (!started) throw new Error('Runtime is not started');
      return projectController.handle(command);
    },
    async submitTask(request) {
      if (!started) throw new Error('Runtime is not started');
      void taskRunner.submit({
        id: request.taskId,
        projectId: request.projectId,
        prompt: request.prompt,
        checkpoint: { name: 'submitted', data: { projectId: request.projectId, prompt: request.prompt } },
      });
      return { taskId: request.taskId, status: 'queued' };
    },
    async getTask(taskId) {
      if (!started) throw new Error('Runtime is not started');
      const task = taskRunner.get(taskId);
      if (!task || (task.status !== 'completed' && task.status !== 'failed')) return null;
      const result: TaskResult = {
        taskId: task.id as TaskResult['taskId'],
        status: task.status,
        ...(task.error ? { error: task.error } : {}),
      };
      if (task.checkpoint?.name === 'agent.changeset') {
        const checkpoint = task.checkpoint.data as { id?: unknown } | undefined;
        if (typeof checkpoint?.id === 'string') {
          result.changeSetId = checkpoint.id;
          const changeSet = generatedChangeSets.get(checkpoint.id);
          if (changeSet && task.projectId) {
            result.changeSet = changeSet;
            result.changeSetReview = await changeSetService.review(task.projectId, changeSet);
          }
        }
      }
      return result;
    },
    async repairTask(taskId, failure, files = []) {
      if (!started) throw new Error('Runtime is not started');
      if (!repairCoordinator) throw new Error('Repair agent is not configured');
      if (!taskService.get(taskId)) throw new Error(`Unknown task: ${taskId}`);

      repairCoordinator.start(taskId);
      const decision = await repairCoordinator.onVerificationFailureAndPropose(taskId, failure, files);
      if (decision.kind === 'await_review') {
        generatedChangeSets.set(decision.changeSet.id, decision.changeSet);
        await taskService.checkpoint(taskId, { name: 'repair.changeset', data: decision.changeSet });
      }
      return decision;
    },
    subscribeTask(listener) {
      taskListeners.add(listener);
      return () => taskListeners.delete(listener);
    },
  };
}
