import { describe, expect, it } from 'vitest';
import { readAgentProviderConfig } from '../../../src/agents/llm/createConfiguredProvider.js';

describe('readAgentProviderConfig', () => {
  it('defaults to a local Ollama-compatible endpoint and coding model', () => {
    const config = readAgentProviderConfig({});

    expect(config).toEqual({
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'qwen2.5-coder:7b',
      timeoutMs: 120_000,
    });
  });

  it('allows hosted provider settings through environment variables', () => {
    const config = readAgentProviderConfig({
      IDLE_LLM_BASE_URL: 'https://example.test/v1/',
      IDLE_LLM_MODEL: 'coder',
      IDLE_LLM_API_KEY: 'secret',
      IDLE_LLM_TIMEOUT_MS: '5000',
    });

    expect(config).toEqual({
      baseUrl: 'https://example.test/v1/',
      model: 'coder',
      apiKey: 'secret',
      timeoutMs: 5000,
    });
  });

  it('rejects an invalid timeout', () => {
    expect(() => readAgentProviderConfig({ IDLE_LLM_TIMEOUT_MS: '0' })).toThrow(
      'IDLE_LLM_TIMEOUT_MS must be a positive integer',
    );
  });
});
