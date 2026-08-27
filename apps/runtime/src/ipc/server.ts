import type { ChangeSet, FailureContext, TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CommandPolicy } from '../security/SecurityPolicy.js';
import { SecurityPolicy } from '../security/SecurityPolicy.js';
import { SecureCommandExecutor } from '../security/SecureCommandExecutor.js';
import { CommandRepairVerifier } from '../security/CommandRepairVerifier.js';
import { AgentChangeSetBuilder } from '../agents/AgentChangeSetBuilder.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';
import { AgentPlanner } from '../agents/AgentPlanner.js';
import { AgentProposalEngine, extractReferencedFilePaths } from '../agents/AgentProposalEngine.js';
import { AgentRuntime } from '../agents/AgentRuntime.js';
import { createConfiguredAgentProvider } from '../agents/llm/createConfiguredProvider.js';
import { createAgentWorkspaceProposalBuffer, createAgentWorkspaceTools } from '../agents/tools/AgentWorkspaceTools.js';
import { ToolRegistry } from '../agents/tools/ToolRegistry.js';
import { RepairAgent } from '../agents/RepairAgent.js';
import { RepairCoordinator } from '../agents/RepairCoordinator.js';
import { MultiAgentCoordinator } from '../orchestration/MultiAgentCoordinator.js';
import type { RepairDecision } from '../agents/RepairLoop.js';
import type { AgentProposalFile } from '../agents/AgentProposalEngine.js';
import { MemoryRepository } from '../memory/MemoryRepository.js';
import { ProjectMemoryRetriever } from '../memory/ProjectMemoryRetriever.js';
import { ProjectMemory } from '../memory/ProjectMemory.js';
import { TaskMemoryRecorder } from '../memory/TaskMemoryRecorder.js';
import { TaskLearningService } from '../learning/TaskLearningService.js';
import { ProjectController, type ProjectCommand, type ProjectCommandResult } from '../project/ProjectController.js';
import { ChangeSetService } from '../project/ChangeSetService.js';
import { FileService } from '../project/FileService.js';
import { LanguageAdapterRegistry } from '../project/LanguageAdapterRegistry.js';
import { ProjectGraph } from '../project/ProjectGraph.js';
import { ProjectGraphRepository } from '../project/ProjectGraphRepository.js';
import { ProjectIndexer } from '../project/ProjectIndexer.js';
import { ProjectIntelligenceService } from '../project/ProjectIntelligenceService.js';
import { ProjectLanguageService } from '../project/ProjectLanguageService.js';
import { ProjectScanner } from '../project/ProjectScanner.js';
import { ProjectService } from '../project/ProjectService.js';
import { TypeScriptLanguageAdapter } from '../project/TypeScriptLanguageAdapter.js';
import { TaskRunner, type TaskStatusEvent as RuntimeTaskStatusEvent } from '../tasks/TaskRunner.js';
import { TaskService } from '../tasks/TaskService.js';

export interface RuntimeHealth { status: 'ok'; version: string; }
export type RepairVerifier = (taskId: string, projectId: string, changeSet: ChangeSet) => Promise<FailureContext | null>;

export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
  handleProject(command: ProjectCommand): Promise<ProjectCommandResult>;
  submitTask(request: TaskSubmitRequest): Promise<TaskSubmitResult>;
  getTask(taskId: string): Promise<TaskResult | null>;
  repairTask(taskId: string, failure: FailureContext, files?: readonly AgentProposalFile[]): Promise<RepairDecision>;
  applyRepair(taskId: string, changeSetId: string): Promise<RepairDecision>;
  subscribeTask(listener: (event: TaskStatusEvent) => void): () => void;
}

export interface RuntimeServerOptions {
  taskStorePath?: string;
  memoryStorePath?: string;
  repairAgent?: RepairAgent;
  repairVerifier?: RepairVerifier;
  repairVerification?: {
    command: string;
    checkId?: string;
    policy: CommandPolicy;
    affectedPaths?: string[];
  };
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
  const memoryStorePath = options.memoryStorePath ?? process.env.IDLE_MEMORY_STORE_PATH ?? join(homedir(), '.idle', 'memory');
  const memoryRepository = new MemoryRepository(memoryStorePath);
  const memoryRetriever = new ProjectMemoryRetriever(memoryRepository);
  const memoryRecorder = new TaskMemoryRecorder(memoryRepository, {
    async learn(outcome) {
      const learning = new TaskLearningService(new ProjectMemory(outcome.projectId, memoryRepository));
      await learning.learnFromOutcome(outcome);
    },
  });
  const projectScanner = new ProjectScanner(projectService);
  const projectIndexer = new ProjectIndexer(projectService);
  const projectLanguage = new ProjectLanguageService(
    projectService,
    new LanguageAdapterRegistry([new TypeScriptLanguageAdapter()]),
  );
  const projectGraph = new ProjectGraph(new ProjectGraphRepository(memoryStorePath));
  const projectIntelligence = new ProjectIntelligenceService(
    projectService,
    projectScanner,
    projectIndexer,
    projectLanguage,
    projectGraph,
  );
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
      memory: memoryRetriever,
      projectContext: projectIntelligence,
    }))
    : undefined);
  const repairCoordinator = repairAgent
    ? new RepairCoordinator(taskService, { repairAgent, memoryRecorder })
    : undefined;
  const commandRepairVerifier = options.repairVerification
    ? new CommandRepairVerifier(new SecureCommandExecutor(SecurityPolicy, options.repairVerification.policy))
    : undefined;

  const executeMultiAgent = async (request: Parameters<NonNullable<ConstructorParameters<typeof TaskRunner>[1]>>[0]): Promise<ChangeSet> => {
    const coordinator = new MultiAgentCoordinator(async (task, subtask) => {
      const inspection = await agentExecutor.execute({ id: subtask.id, projectId: task.projectId, prompt: subtask.prompt });
      const plan = agentPlanner.createPlan(inspection);
      let changeSet: ChangeSet;

      if (llmProvider) {
        const proposals = createAgentWorkspaceProposalBuffer();
        const registry = new ToolRegistry();
        for (const tool of createAgentWorkspaceTools(fileService, proposals)) registry.register(tool);
        const runtime = new AgentRuntime(llmProvider, registry, {
          maxTurns: 8,
          systemPrompt: REAL_AGENT_SYSTEM_PROMPT,
          memory: memoryRetriever,
          projectContext: projectIntelligence,
        });
        const agent = await runtime.run({ taskId: subtask.id, projectId: task.projectId, prompt: subtask.prompt });
        if (agent.error) throw new Error(agent.error);
        changeSet = changeSetBuilder.createChangeSet(plan, proposals.changes);
      } else {
        const goal = subtask.prompt;
        const proposalFiles = (await Promise.all(extractReferencedFilePaths(goal).map(async (path) => {
          const state = await fileService.readState(task.projectId, path);
          return state.exists ? { path, content: state.content } : undefined;
        }))).filter((file): file is { path: string; content: string } => file !== undefined);
        const proposal = agentProposalEngine.propose({ taskId: subtask.id, goal, files: proposalFiles });
        changeSet = changeSetBuilder.createChangeSet(plan, proposal.changes);
      }

      const review = await changeSetService.review(task.projectId, changeSet);
      if (!review.valid) throw new Error(`Generated ChangeSet failed validation: ${review.errors.join('; ')}`);
      return {
        changeSet,
        ...(subtask.claimedPaths ? { claimedPaths: subtask.claimedPaths } : { claimedPaths: extractReferencedFilePaths(subtask.prompt) }),
      };
    });

    const coordination = await coordinator.run({ id: request.id as Parameters<typeof coordinator.run>[0]['id'], projectId: request.projectId as Parameters<typeof coordinator.run>[0]['projectId'], prompt: request.prompt ?? '' }, {
      defaultMaxAgents: 2,
      hardMaxAgents: 4,
      ...(request.orchestration?.maxAgents !== undefined ? { maxAgents: request.orchestration.maxAgents } : {}),
      ...(request.orchestration?.maxDelegationDepth !== undefined || request.orchestration?.maxTaskTokens !== undefined || request.orchestration?.maxApiCalls !== undefined || request.orchestration?.idleTimeoutMs !== undefined
        ? {
            budget: {
              maxDelegationDepth: request.orchestration.maxDelegationDepth ?? 2,
              ...(request.orchestration.maxTaskTokens !== undefined ? { maxTaskTokens: request.orchestration.maxTaskTokens } : {}),
              ...(request.orchestration.maxApiCalls !== undefined ? { maxApiCalls: request.orchestration.maxApiCalls } : {}),
              ...(request.orchestration.idleTimeoutMs !== undefined ? { idleTimeoutMs: request.orchestration.idleTimeoutMs } : {}),
            },
          }
        : {}),
    });
    if (coordination.status !== 'completed' || !coordination.combinedChangeSet) {
      const conflictMessage = coordination.conflicts.map((conflict) => `${conflict.paths.join(', ')} (${conflict.subtaskIds.join(', ')})`).join('; ');
      const failureMessage = coordination.failures.map((failure) => `${failure.subtaskId}: ${failure.error}`).join('; ');
      throw new Error(conflictMessage ? `Multi-agent conflict: ${conflictMessage}` : failureMessage || `Multi-agent task ${coordination.status}`);
    }
    const review = await changeSetService.review(request.projectId, coordination.combinedChangeSet);
    if (!review.valid) throw new Error(`Combined ChangeSet failed validation: ${review.errors.join('; ')}`);
    generatedChangeSets.set(coordination.combinedChangeSet.id, coordination.combinedChangeSet);
    return coordination.combinedChangeSet;
  };

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
        memory: memoryRetriever,
        projectContext: projectIntelligence,
      });
      const agent = await runtime.run({ taskId: request.id, projectId: request.projectId, prompt: request.prompt ?? '' });
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

    const review = await changeSetService.review(request.projectId, changeSet);
    if (!review.valid) throw new Error(`Generated ChangeSet failed validation: ${review.errors.join('; ')}`);
    await taskService.checkpoint(request.id, { name: 'agent.changeset', data: changeSet });
    await taskService.checkpoint(request.id, { name: 'agent.verification', data: { valid: true, errors: [], changeCount: changeSet.changes.length } });
    generatedChangeSets.set(changeSet.id, changeSet);
  }, undefined, executeMultiAgent, memoryRecorder);

  taskRunner.subscribe((event) => {
    const status = toContractStatus(event.status);
    const contractEvent: TaskStatusEvent = {
      taskId: event.taskId as TaskStatusEvent['taskId'], status, timestamp: event.timestamp,
      ...(event.error ? { message: event.error } : {}),
    };
    for (const listener of taskListeners) listener(contractEvent);
  });

  return {
    async start() { if (started) return; await taskService.load(); started = true; await taskRunner.resumePendingTasks(); },
    async stop() { started = false; taskListeners.clear(); generatedChangeSets.clear(); },
    health() { if (!started) throw new Error('Runtime is not started'); return { status: 'ok', version }; },
    async handleProject(command) {
      if (!started) throw new Error('Runtime is not started');
      const result = await projectController.handle(command);
      if (command.type === 'project.open' && result && !Array.isArray(result) && 'id' in result) await projectIntelligence.index(result.id);
      else if (command.type === 'project.close') await projectIntelligence.clear(command.projectId);
      return result;
    },
    async submitTask(request) {
      if (!started) throw new Error('Runtime is not started');
      void taskRunner.submit({ id: request.taskId, projectId: request.projectId, prompt: request.prompt, orchestration: request.orchestration, checkpoint: { name: 'submitted', data: { projectId: request.projectId, prompt: request.prompt, orchestration: request.orchestration } } });
      return { taskId: request.taskId, status: 'queued' };
    },
    async getTask(taskId) {
      if (!started) throw new Error('Runtime is not started');
      const task = taskRunner.get(taskId);
      if (!task || (task.status !== 'completed' && task.status !== 'failed')) return null;
      const result: TaskResult = { taskId: task.id as TaskResult['taskId'], status: task.status, ...(task.error ? { error: task.error } : {}) };
      if (task.checkpoint?.name === 'agent.changeset' || task.checkpoint?.name === 'repair.changeset') {
        const checkpoint = task.checkpoint.data as { id?: unknown } | undefined;
        if (typeof checkpoint?.id === 'string') {
          result.changeSetId = checkpoint.id;
          const changeSet = generatedChangeSets.get(checkpoint.id);
          if (changeSet && task.projectId) { result.changeSet = changeSet; result.changeSetReview = await changeSetService.review(task.projectId, changeSet); }
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
      if (decision.kind === 'await_review') { generatedChangeSets.set(decision.changeSet.id, decision.changeSet); await taskService.checkpoint(taskId, { name: 'repair.changeset', data: decision.changeSet }); }
      return decision;
    },
    async applyRepair(taskId, changeSetId) {
      if (!started) throw new Error('Runtime is not started');
      if (!options.repairVerifier && !commandRepairVerifier) throw new Error('Repair verifier is not configured');
      if (!repairCoordinator) throw new Error('Repair agent is not configured');
      const task = taskService.get(taskId);
      if (!task) throw new Error(`Unknown task: ${taskId}`);
      if (task.repairStatus !== 'review') throw new Error(`Task is not awaiting repair review: ${taskId}`);
      const changeSet = generatedChangeSets.get(changeSetId);
      if (!changeSet) throw new Error(`Unknown repair ChangeSet: ${changeSetId}`);
      const checkpoint = task.checkpoint?.data as { id?: unknown } | undefined;
      if (task.checkpoint?.name !== 'repair.changeset' || checkpoint?.id !== changeSetId) throw new Error(`Repair ChangeSet is not pending review for task: ${taskId}`);
      if (!task.projectId) throw new Error(`Task is missing project context: ${taskId}`);
      const applied = await changeSetService.apply(task.projectId, changeSet);
      await taskService.checkpoint(taskId, { name: 'repair.applied', data: applied });
      let verificationFailure: FailureContext | null;
      if (options.repairVerifier) verificationFailure = await options.repairVerifier(taskId, task.projectId, changeSet);
      else {
        const project = await projectService.get(task.projectId);
        if (!project || !commandRepairVerifier || !options.repairVerification) throw new Error(`Project verification context is unavailable: ${taskId}`);
        verificationFailure = await commandRepairVerifier.verify({ taskId, projectId: task.projectId, cwd: project.path, command: options.repairVerification.command, checkId: options.repairVerification.checkId ?? 'repair-verification', attempt: Math.min(task.repairAttempts + 1, 3), previousAttempts: task.latestFailure ? [...task.latestFailure.previousAttempts, { attempt: task.latestFailure.attempt, ...(task.latestFailure.changeSetId ? { changeSetId: task.latestFailure.changeSetId } : {}), status: 'failed', summary: task.latestFailure.stderrExcerpt || task.latestFailure.stdoutExcerpt }] : [], ...(options.repairVerification.affectedPaths ? { affectedPaths: options.repairVerification.affectedPaths } : {}) });
      }
      await taskService.checkpoint(taskId, { name: 'repair.verification', data: verificationFailure ?? { ok: true } });
      if (verificationFailure) {
        const nextDecision = await repairCoordinator.onVerificationFailureAndPropose(taskId, { ...verificationFailure, attempt: Math.max(task.repairAttempts + 1, verificationFailure.attempt) });
        if (nextDecision.kind === 'await_review') { generatedChangeSets.set(nextDecision.changeSet.id, nextDecision.changeSet); await taskService.checkpoint(taskId, { name: 'repair.changeset', data: nextDecision.changeSet }); }
        return nextDecision;
      }
      return repairCoordinator.onVerificationSuccess(taskId);
    },
    subscribeTask(listener) { taskListeners.add(listener); return () => taskListeners.delete(listener); },
  };
}
