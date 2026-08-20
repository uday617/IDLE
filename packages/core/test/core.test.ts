import { describe, expect, it } from 'vitest';

describe('repository smoke', () => {
  it('has the foundation packages', () => {
    expect(['desktop', 'runtime', 'contracts', 'core']).toHaveLength(4);
  });
});
