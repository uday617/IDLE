import { describe, expect, it } from 'vitest';
import { createRuntimeServer } from '../src/ipc/server.js';

describe('runtime server', () => {
  it('reports health after startup', async () => {
    const server = createRuntimeServer('0.1.0');
    await server.start();

    expect(server.health()).toEqual({ status: 'ok', version: '0.1.0' });

    await server.stop();
  });
});
