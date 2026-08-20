export type AgentRequestDecision = 'allow' | 'deny' | 'approval_required';

export interface AgentRequest {
  capability: string;
  autonomy: number;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentPolicy {
  allowedCapabilities: readonly string[];
  maxAutonomy: number;
  requireApprovalFor?: readonly string[];
}

export interface AgentRequestResult {
  decision: AgentRequestDecision;
  reason: string;
  parentAgentId: string;
  request: AgentRequest;
}

export class AgentRequestService {
  constructor(private readonly policies: ReadonlyMap<string, AgentPolicy>) {}

  request(parentAgentId: string, request: AgentRequest): AgentRequestResult {
    const policy = this.policies.get(parentAgentId);
    if (!policy) {
      return { decision: 'deny', reason: 'Unknown parent agent', parentAgentId, request };
    }

    if (!policy.allowedCapabilities.includes(request.capability)) {
      return { decision: 'deny', reason: `Capability not allowed: ${request.capability}`, parentAgentId, request };
    }

    if (!Number.isFinite(request.autonomy) || request.autonomy < 0 || request.autonomy > policy.maxAutonomy) {
      return { decision: 'deny', reason: 'Requested autonomy exceeds policy', parentAgentId, request };
    }

    if (request.requiresApproval || policy.requireApprovalFor?.includes(request.capability)) {
      return { decision: 'approval_required', reason: 'Human approval required', parentAgentId, request };
    }

    return { decision: 'allow', reason: 'Request satisfies agent policy', parentAgentId, request };
  }
}
