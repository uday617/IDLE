export const EVENT_TYPES = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_STARTED: 'TASK_STARTED',
  FILE_CHANGED: 'FILE_CHANGED',
  VERIFICATION_STARTED: 'VERIFICATION_STARTED',
  VERIFICATION_COMPLETED: 'VERIFICATION_COMPLETED',
  AGENT_COMPLETED: 'AGENT_COMPLETED',
} as const;

export const COORDINATION_EVENT_TYPES = {
  CREATED: 'coordination.created',
  STARTED: 'subtask.started',
  PROGRESS: 'subtask.progress',
  CLAIMED: 'subtask.claimed',
  CONFLICT: 'coordination.conflict',
  COMPLETED: 'subtask.completed',
  FAILED: 'subtask.failed',
  CANCELLED: 'subtask.cancelled',
  AGGREGATED: 'changeset.aggregated',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
export type CoordinationEventType = (typeof COORDINATION_EVENT_TYPES)[keyof typeof COORDINATION_EVENT_TYPES];
