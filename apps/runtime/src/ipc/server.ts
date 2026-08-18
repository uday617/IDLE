export interface RuntimeHealth {
  status: 'ok';
  version: string;
}

export interface RuntimeServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): RuntimeHealth;
}

export function createRuntimeServer(version: string): RuntimeServer {
  let started = false;

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
  };
}
