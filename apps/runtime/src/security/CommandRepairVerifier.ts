import type { FailureContext } from '@idle/contracts';
import type { SecureCommandExecutor } from './SecureCommandExecutor.js';

export interface CommandVerificationRequest {
  taskId: string;
  projectId: string;
  cwd: string;
  command: string;
  checkId: string;
  attempt: number;
  previousAttempts: FailureContext['previousAttempts'];
  affectedPaths?: string[];
}

const MAX_EXCERPT_LENGTH = 4000;

function excerpt(value: string): string {
  if (value.length <= MAX_EXCERPT_LENGTH) return value;
  return value.slice(-MAX_EXCERPT_LENGTH);
}

export class CommandRepairVerifier {
  constructor(private readonly executor: Pick<SecureCommandExecutor, 'run'>) {}

  async verify(request: CommandVerificationRequest): Promise<FailureContext | null> {
    const result = await this.executor.run({ command: request.command, cwd: request.cwd });
    if (result.exitCode === 0) return null;

    return {
      taskId: request.taskId as FailureContext['taskId'],
      attempt: request.attempt,
      checkId: request.checkId,
      exitCode: result.exitCode,
      stdoutExcerpt: excerpt(result.stdout),
      stderrExcerpt: excerpt(result.stderr),
      affectedPaths: request.affectedPaths ?? [],
      previousAttempts: request.previousAttempts,
    };
  }
}
