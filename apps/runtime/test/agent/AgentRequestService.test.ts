import { describe, expect, it } from 'vitest';
import { AgentRequestService, type AgentPolicy } from '../../src/agent/AgentRequestService.js';

const policy: AgentPolicy = {
  allowedCapabilities: ['read', 'edit'],
  maxAutonomy: 2,
  requireApprovalFor: ['edit'],
};

function service() {
  return new AgentRequestService(new Map([['parent-1', policy]]));
}

describe('AgentRequestService', () => {
  it('allows an allowed capability within the autonomy limit', () => {
    expect(service().request('parent-1', { capability: 'read', autonomy: 1 })).toMatchObject({
      decision: 'allow',
    });
  });

  it('denies a capability outside the policy', () => {
    expect(service().request('parent-1', { capability: 'shell', autonomy: 1 })).toMatchObject({
      decision: 'deny',
    });
  });

  it('denies requests above the autonomy limit', () => {
    expect(service().request('parent-1', { capability: 'read', autonomy: 3 })).toMatchObject({
      decision: 'deny',
    });
  });

  it('requires approval for policy-controlled capabilities', () => {
    expect(service().request('parent-1', { capability: 'edit', autonomy: 1 })).toMatchObject({
      decision: 'approval_required',
    });
  });

  it('requires approval when explicitly requested', () => {
    expect(service().request('parent-1', {
      capability: 'read',
      autonomy: 1,
      requiresApproval: true,
      metadata: { task: 'delegated-read' },
    })).toMatchObject({
      decision: 'approval_required',
      request: { metadata: { task: 'delegated-read' } },
    });
  });

  it('denies unknown parent agents', () => {
    expect(service().request('missing', { capability: 'read', autonomy: 1 })).toMatchObject({
      decision: 'deny',
    });
  });
});
