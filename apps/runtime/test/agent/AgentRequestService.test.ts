import { describe, expect, it } from 'vitest';
import { AgentRequestService, type AgentPolicy } from '../../src/agent/AgentRequestService.js';

const policy: AgentPolicy = {
  allowedCapabilities: ['read', 'edit'],
  maxAutonomy: 2,
  requireApprovalFor: ['edit'],
  maxActiveAgents: 2,
  maxDelegationDepth: 2,
  budget: { maxTaskUnits: 5, maxTokens: 1000, maxApiCalls: 3 },
  idleTimeoutMs: 1000,
};

function service() {
  return new AgentRequestService(new Map([['parent-1', policy]]));
}

describe('AgentRequestService', () => {
  it('allows an allowed capability within the autonomy limit', () => {
    expect(service().request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'child-1' })).toMatchObject({
      decision: 'allow',
    });
  });

  it('denies a capability outside the policy', () => {
    expect(service().request('parent-1', { capability: 'shell', autonomy: 1 })).toMatchObject({ decision: 'deny' });
  });

  it('denies requests above the autonomy limit', () => {
    expect(service().request('parent-1', { capability: 'read', autonomy: 3 })).toMatchObject({ decision: 'deny' });
  });

  it('requires approval for policy-controlled capabilities', () => {
    expect(service().request('parent-1', { capability: 'edit', autonomy: 1 })).toMatchObject({ decision: 'approval_required' });
  });

  it('requires approval when explicitly requested', () => {
    expect(service().request('parent-1', {
      capability: 'read', autonomy: 1, requiresApproval: true, metadata: { task: 'delegated-read' },
    })).toMatchObject({ decision: 'approval_required', request: { metadata: { task: 'delegated-read' } } });
  });

  it('denies unknown parent agents', () => {
    expect(service().request('missing', { capability: 'read', autonomy: 1 })).toMatchObject({ decision: 'deny' });
  });

  it('denies delegation deeper than the configured limit', () => {
    expect(service().request('parent-1', { capability: 'read', autonomy: 1, delegationDepth: 3 })).toMatchObject({
      decision: 'deny',
      reason: 'Delegation depth exceeds policy',
    });
  });

  it('denies requests when the active-agent limit is reached', () => {
    const requests = service();
    expect(requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'child-1' }).decision).toBe('allow');
    expect(requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'child-2' }).decision).toBe('allow');
    expect(requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'child-3' })).toMatchObject({
      decision: 'deny',
      reason: 'Active-agent limit exceeded',
    });
  });

  it('denies requests that exceed the configured task/token/API budget', () => {
    expect(service().request('parent-1', {
      capability: 'read', autonomy: 1, taskUnits: 6, estimatedTokens: 1001, estimatedApiCalls: 4,
    })).toMatchObject({ decision: 'deny', reason: 'Delegation budget exceeded' });
  });

  it('releases an active reservation', () => {
    const requests = service();
    const result = requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'child-1' });
    expect(result.reservationId).toBeDefined();
    expect(requests.activeCount()).toBe(1);
    expect(requests.release(result.reservationId!)).toBe(true);
    expect(requests.activeCount()).toBe(0);
  });

  it('terminates idle agents after their timeout', () => {
    const requests = service();
    const result = requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'idle-child' });
    expect(result.reservationId).toBeDefined();
    expect(requests.terminateIdle(Date.now() + 1001)).toEqual(['idle-child']);
    expect(requests.activeCount()).toBe(0);
  });

  it('touches an active reservation and keeps it alive', () => {
    const requests = service();
    const result = requests.request('parent-1', { capability: 'read', autonomy: 1, childAgentId: 'active-child' });
    expect(requests.touch(result.reservationId!)).toBe(true);
    expect(requests.terminateIdle(Date.now() + 500)).toEqual([]);
  });
});
