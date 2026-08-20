import { describe, expect, it } from 'vitest';
import { AgentMemoryService } from '../../src/agent/AgentMemoryService.js';

describe('AgentMemoryService', () => {
  it('stores and recalls memories for the same agent', () => {
    const memory = new AgentMemoryService();
    const entry = memory.remember('agent-1', 'Use PostgreSQL for persistence', ['database']);
    expect(memory.recall('agent-1')).toEqual([entry]);
  });

  it('isolates memories between agents', () => {
    const memory = new AgentMemoryService();
    memory.remember('agent-1', 'private context', ['context']);
    memory.remember('agent-2', 'other context', ['context']);
    expect(memory.recall('agent-1')).toHaveLength(1);
    expect(memory.recall('agent-1')[0].content).toBe('private context');
  });

  it('filters recalled memories by tag and text', () => {
    const memory = new AgentMemoryService();
    memory.remember('agent-1', 'Use PostgreSQL', ['database']);
    memory.remember('agent-1', 'Use Vitest', ['testing']);
    expect(memory.recall('agent-1', { tag: 'database' })[0].content).toBe('Use PostgreSQL');
    expect(memory.recall('agent-1', { text: 'vitest' })[0].content).toBe('Use Vitest');
  });

  it('forgets only memories owned by the requesting agent', () => {
    const memory = new AgentMemoryService();
    const own = memory.remember('agent-1', 'remove me');
    const other = memory.remember('agent-2', 'keep me');
    expect(memory.forget('agent-2', own.id)).toBe(false);
    expect(memory.recall('agent-1')).toEqual([own]);
    expect(memory.forget('agent-1', own.id)).toBe(true);
    expect(memory.recall('agent-1')).toEqual([]);
    expect(memory.recall('agent-2')).toEqual([other]);
  });
});
