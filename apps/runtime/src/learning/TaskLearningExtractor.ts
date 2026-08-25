import type { TaskOutcome } from '../memory/TaskMemoryRecorder.js';

const MAX_TEXT_LENGTH = 2_000;
const SECRET_PATTERNS = [
  /(?:token|password|passwd|secret|api[_-]?key)\s*[:=]\s*\S+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
];

export interface ProjectLesson {
  kind: 'convention' | 'solution' | 'failure' | 'decision';
  statement: string;
  evidenceTaskId: string;
  evidence: string;
}

export class TaskLearningExtractor {
  extract(outcome: TaskOutcome): ProjectLesson | undefined {
    if (outcome.status !== 'completed' || outcome.verification !== 'passed') return undefined;
    const statement = this.sanitize(outcome.summary ?? outcome.prompt ?? '');
    if (!statement) return undefined;

    return {
      kind: 'solution',
      statement,
      evidenceTaskId: outcome.taskId,
      evidence: `verification=${outcome.verification}; status=${outcome.status}`,
    };
  }

  private sanitize(value: string): string {
    let sanitized = value;
    for (const pattern of SECRET_PATTERNS) sanitized = sanitized.replace(pattern, '[redacted]');
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized.length <= MAX_TEXT_LENGTH ? sanitized : `${sanitized.slice(0, MAX_TEXT_LENGTH - 1)}…`;
  }
}
