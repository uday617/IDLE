import type { CommandPolicy } from '../security/SecurityPolicy.js';
import { ToolExecutor, type ToolExecutionResult } from '../agents/tools/ToolExecutor.js';
import type { TaskRunRequest } from './TaskRunner.js';

export interface CommandTaskRunRequest extends TaskRunRequest {
  command: string;
  cwd: string;
  policy: CommandPolicy;
}

export type SecureTaskExecutor = (
  request: CommandTaskRunRequest,
) => Promise<ToolExecutionResult>;

export function createSecureTaskExecutor(
  toolExecutor: ToolExecutor = new ToolExecutor(),
): SecureTaskExecutor {
  return (request) => toolExecutor.execute(request.command, request.cwd, request.policy);
}
