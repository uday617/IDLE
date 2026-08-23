export type AgentRequestDecision = 'allow' | 'deny' | 'approval_required';

export interface AgentBudget {
  maxTaskUnits: number;
  maxTokens: number;
  maxApiCalls: number;
}

export interface AgentRequest {
  capability: string;
  autonomy: number;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
  delegationDepth?: number;
  taskUnits?: number;
  estimatedTokens?: number;
  estimatedApiCalls?: number;
  childAgentId?: string;
}

export interface AgentPolicy {
  allowedCapabilities: readonly string[];
  maxAutonomy: number;
  requireApprovalFor?: readonly string[];
  maxActiveAgents?: number;
  maxDelegationDepth?: number;
  budget?: AgentBudget;
  idleTimeoutMs?: number;
}

export interface AgentRequestResult {
  decision: AgentRequestDecision;
  reason: string;
  parentAgentId: string;
  request: AgentRequest;
  reservationId?: string;
}

interface ActiveReservation {
  id: string;
  parentAgentId: string;
  childAgentId: string;
  lastActivityAt: number;
}

const DEFAULT_MAX_ACTIVE_AGENTS = 4;
const DEFAULT_MAX_DELEGATION_DEPTH = 2;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export class AgentRequestService {
  private readonly active = new Map<string, ActiveReservation>();

  constructor(private readonly policies: ReadonlyMap<string, AgentPolicy>) {}

  request(parentAgentId: string, request: AgentRequest): AgentRequestResult {
    const policy = this.policies.get(parentAgentId);
    if (!policy) return this.deny(parentAgentId, request, 'Unknown parent agent');

    if (!policy.allowedCapabilities.includes(request.capability)) {
      return this.deny(parentAgentId, request, `Capability not allowed: ${request.capability}`);
    }

    if (!Number.isFinite(request.autonomy) || request.autonomy < 0 || request.autonomy > policy.maxAutonomy) {
      return this.deny(parentAgentId, request, 'Requested autonomy exceeds policy');
    }

    const depth = request.delegationDepth ?? 0;
    if (!Number.isInteger(depth) || depth < 0 || depth > (policy.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH)) {
      return this.deny(parentAgentId, request, 'Delegation depth exceeds policy');
    }

    const maxActive = policy.maxActiveAgents ?? DEFAULT_MAX_ACTIVE_AGENTS;
    if (this.active.size >= maxActive) {
      return this.deny(parentAgentId, request, 'Active-agent limit exceeded');
    }

    const budget = policy.budget;
    if (budget) {
      const taskUnits = request.taskUnits ?? 1;
      const tokens = request.estimatedTokens ?? 0;
      const apiCalls = request.estimatedApiCalls ?? 1;
      if (taskUnits > budget.maxTaskUnits || tokens > budget.maxTokens || apiCalls > budget.maxApiCalls) {
        return this.deny(parentAgentId, request, 'Delegation budget exceeded');
      }
    }

    if (request.requiresApproval || policy.requireApprovalFor?.includes(request.capability)) {
      return { decision: 'approval_required', reason: 'Human approval required', parentAgentId, request };
    }

    const childAgentId = request.childAgentId ?? `${parentAgentId}:child:${Date.now()}`;
    const reservationId = `${childAgentId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    this.active.set(reservationId, {
      id: reservationId,
      parentAgentId,
      childAgentId,
      lastActivityAt: Date.now(),
    });

    return { decision: 'allow', reason: 'Request satisfies agent policy', parentAgentId, request, reservationId };
  }

  touch(reservationId: string): boolean {
    const reservation = this.active.get(reservationId);
    if (!reservation) return false;
    reservation.lastActivityAt = Date.now();
    return true;
  }

  release(reservationId: string): boolean {
    return this.active.delete(reservationId);
  }

  terminateIdle(now = Date.now()): string[] {
    const terminated: string[] = [];
    for (const [id, reservation] of this.active) {
      const policy = this.policies.get(reservation.parentAgentId);
      const timeout = policy?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
      if (now - reservation.lastActivityAt >= timeout) {
        this.active.delete(id);
        terminated.push(reservation.childAgentId);
      }
    }
    return terminated;
  }

  activeCount(): number {
    return this.active.size;
  }

  private deny(parentAgentId: string, request: AgentRequest, reason: string): AgentRequestResult {
    return { decision: 'deny', reason, parentAgentId, request };
  }
}
