import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';
import type { LLMProvider } from './LLMProvider.js';

export interface AgentProviderConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const DEFAULT_TIMEOUT_MS = 120_000;

export function readAgentProviderConfig(env: NodeJS.ProcessEnv = process.env): AgentProviderConfig {
  const baseUrl = env.IDLE_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = env.IDLE_LLM_MODEL?.trim() || DEFAULT_MODEL;
  const apiKey = env.IDLE_LLM_API_KEY?.trim() || undefined;
  const timeoutMs = Number.parseInt(env.IDLE_LLM_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('IDLE_LLM_TIMEOUT_MS must be a positive integer');
  }

  return { baseUrl, model, ...(apiKey ? { apiKey } : {}), timeoutMs };
}

export function createConfiguredAgentProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const config = readAgentProviderConfig(env);
  return new OpenAICompatibleProvider(config);
}
