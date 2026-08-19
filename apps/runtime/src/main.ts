import { createInterface } from 'node:readline';
import { RUNTIME_VERSION } from './index.js';
import { createRuntimeServer } from './ipc/server.js';
import type { ProjectCommand } from './project/ProjectController.js';

const server = createRuntimeServer(RUNTIME_VERSION);
await server.start();

interface RuntimeRequest {
  id: number;
  type: 'health' | 'project.open' | 'project.get' | 'project.close';
  path?: string;
  projectId?: string;
}

const lines = createInterface({ input: process.stdin });
lines.on('line', async (line) => {
  let request: RuntimeRequest | null = null;
  try {
    request = JSON.parse(line) as RuntimeRequest;
    let result: unknown;

    if (request.type === 'health') {
      result = server.health();
    } else {
      const command: ProjectCommand =
        request.type === 'project.open'
          ? { type: 'project.open', path: request.path ?? '' }
          : request.type === 'project.get'
            ? { type: 'project.get', projectId: request.projectId ?? '' }
            : { type: 'project.close', projectId: request.projectId ?? '' };
      result = await server.handleProject(command);
    }

    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    process.stdout.write(`${JSON.stringify({ id: request?.id ?? -1, error: message })}\n`);
  }
});

const shutdown = () => {
  lines.close();
  void server.stop().finally(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
