import type { ChangeSet, TaskResult, TaskStatusEvent, TaskSubmitRequest, TaskSubmitResult } from '@idle/contracts';
import { AgentChangeSetBuilder } from '../agents/AgentChangeSetBuilder.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';
import { AgentPlanner } from '../agents/AgentPlanner.js';
import { AgentProposalEngine, extractReferencedFilePaths } from '../agents/AgentProposalEngine.js';
import { ProjectController, type ProjectCommand, type ProjectCommandResult } from '../project/ProjectController.js';
import { ChangeSetService } from '../project/ChangeSetService.js';
import { FileService } from '../project/FileService.js';
import { ProjectService } from '../project/ProjectService.js';
import { TaskRunner, type TaskStatusEvent as RuntimeTaskStatusEvent } from '../tasks/TaskRunner.js';
import { TaskService } from '../tasks/TaskService.js';
export interface RuntimeHealth { status: 'ok'; version: string; }
export interface RuntimeServer { start(): Promise<void>; stop(): Promise<void>; health(): RuntimeHealth; handleProject(command: ProjectCommand): Promise<ProjectCommandResult>; submitTask(request: TaskSubmitRequest): Promise<TaskSubmitResult>; getTask(taskId: string): Promise<TaskResult | null>; subscribeTask(listener: (event: TaskStatusEvent) => void): () => void; }
function toContractStatus(status: RuntimeTaskStatusEvent['status']): TaskStatusEvent['status'] { return status === 'pending' ? 'queued' : status; }
export function createRuntimeServer(version: string): RuntimeServer {
  let started = false;
  const projectService = new ProjectService(); const fileService = new FileService(projectService); const changeSetService = new ChangeSetService(projectService, fileService); const projectController = new ProjectController(projectService, fileService, changeSetService);
  const taskListeners = new Set<(event: TaskStatusEvent) => void>(); const taskService = new TaskService(); const generatedChangeSets = new Map<string, ChangeSet>();
  const agentExecutor = new AgentExecutor(projectService, fileService); const agentPlanner = new AgentPlanner(); const agentProposalEngine = new AgentProposalEngine(); const changeSetBuilder = new AgentChangeSetBuilder();
  const taskRunner = new TaskRunner(taskService, async (request) => {
    const inspection = await agentExecutor.execute(request); await taskService.checkpoint(request.id, { name: 'agent.inspection', data: inspection });
    const plan = agentPlanner.createPlan(inspection); await taskService.checkpoint(request.id, { name: 'agent.plan', data: plan });
    const goal = request.prompt ?? '';
    const proposalFiles = (await Promise.all(extractReferencedFilePaths(goal).map(async (path) => {
      const state = await fileService.readState(request.projectId, path);
      return state.exists ? { path, content: state.content } : undefined;
    }))).filter((file): file is { path: string; content: string } => file !== undefined);
    const proposal = agentProposalEngine.propose({ taskId: request.id, goal, files: proposalFiles });
    const changeSet = changeSetBuilder.createChangeSet(plan, proposal.changes); generatedChangeSets.set(changeSet.id, changeSet); await taskService.checkpoint(request.id, { name: 'agent.changeset', data: changeSet });
  });
  taskRunner.subscribe((event) => { const status = toContractStatus(event.status); const contractEvent: TaskStatusEvent = { taskId: event.taskId as TaskStatusEvent['taskId'], status, timestamp: event.timestamp, ...(event.error ? { message: event.error } : {}) }; for (const listener of taskListeners) listener(contractEvent); });
  return {
    async start() { started = true; }, async stop() { started = false; taskListeners.clear(); generatedChangeSets.clear(); }, health() { if (!started) throw new Error('Runtime is not started'); return { status: 'ok', version }; },
    async handleProject(command) { if (!started) throw new Error('Runtime is not started'); return projectController.handle(command); },
    async submitTask(request) { if (!started) throw new Error('Runtime is not started'); void taskRunner.submit({ id: request.taskId, projectId: request.projectId, prompt: request.prompt, checkpoint: { name: 'submitted', data: { projectId: request.projectId, prompt: request.prompt } } }); return { taskId: request.taskId, status: 'queued' }; },
    async getTask(taskId) {
      if (!started) throw new Error('Runtime is not started'); const task = taskRunner.get(taskId); if (!task || (task.status !== 'completed' && task.status !== 'failed')) return null;
      const result: TaskResult = { taskId: task.id as TaskResult['taskId'], status: task.status, ...(task.error ? { error: task.error } : {}) };
      if (task.checkpoint?.name === 'agent.changeset') { const checkpoint = task.checkpoint.data as { id?: unknown } | undefined; if (typeof checkpoint?.id === 'string') { result.changeSetId = checkpoint.id; const changeSet = generatedChangeSets.get(checkpoint.id); if (changeSet && task.projectId) { result.changeSet = changeSet; result.changeSetReview = await changeSetService.review(task.projectId, changeSet); } } }
      return result;
    },
    subscribeTask(listener) { taskListeners.add(listener); return () => taskListeners.delete(listener); },
  };
}
