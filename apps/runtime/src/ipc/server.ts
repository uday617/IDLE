import { ProjectController, type ProjectCommand } from '../project/ProjectController.js';
import { ProjectService } from '../project/ProjectService.js';

export interface RuntimeHealth {
  status: 'ok';
  version: string;
}

export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
  handleProject(command: ProjectCommand): Promise<unknown>;
}

export function createRuntimeServer(version: string): RuntimeServer {
  let started = false;
  const projectController = new ProjectController(new ProjectService());

  return {
    async start() {
      started = true;
    },
    async stop() {
      started = false;
    },
    health() {
      if (!started) throw new Error('Runtime is not started');
      return { status: 'ok', version };
    },
    async handleProject(command) {
      if (!started) throw new Error('Runtime is not started');
      return projectController.handle(command);
    },
  };
}
