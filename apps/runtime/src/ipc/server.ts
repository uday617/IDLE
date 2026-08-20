import {
  ProjectController,
  type ProjectCommand,
  type ProjectCommandResult,
} from '../project/ProjectController.js';
import { ChangeSetService } from '../project/ChangeSetService.js';
import { FileService } from '../project/FileService.js';
import { ProjectService } from '../project/ProjectService.js';

export interface RuntimeHealth {
  status: 'ok';
  version: string;
}

export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
  handleProject(command: ProjectCommand): Promise<ProjectCommandResult>;
}

export function createRuntimeServer(version: string): RuntimeServer {
  let started = false;
  const projectService = new ProjectService();
  const fileService = new FileService(projectService);
  const changeSetService = new ChangeSetService(projectService, fileService);
  const projectController = new ProjectController(projectService, fileService, changeSetService);

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
