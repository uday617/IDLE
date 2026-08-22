import type { FailureContext } from '@idle/contracts';

export interface VerificationFailureInput {
  taskId: string;
  attempt: number;
  checkId: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  affectedPaths?: string[];
  changeSetId?: string;
  previousAttempts?: FailureContext['previousAttempts'];
}

export class FailureContextBuilder {
  static readonly MAX_EXCERPT_CHARS = 8_000;

  static fromVerificationResult(input: VerificationFailureInput): FailureContext {
    return {
      taskId: input.taskId as FailureContext['taskId'],
      attempt: input.attempt,
      checkId: input.checkId,
      ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
      stdoutExcerpt: this.truncate(input.stdout ?? '', this.MAX_EXCERPT_CHARS),
      stderrExcerpt: this.truncate(input.stderr ?? '', this.MAX_EXCERPT_CHARS),
      affectedPaths: [...new Set(input.affectedPaths ?? [])],
      ...(input.changeSetId === undefined ? {} : { changeSetId: input.changeSetId }),
      previousAttempts: [...(input.previousAttempts ?? [])],
    };
  }

  static truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
  }
}
