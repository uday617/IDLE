import { RUNTIME_VERSION } from './index.js';
import { createRuntimeServer } from './ipc/server.js';

const server = createRuntimeServer(RUNTIME_VERSION);

await server.start();

process.on('SIGINT', () => {
  void server.stop().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void server.stop().finally(() => process.exit(0));
});
