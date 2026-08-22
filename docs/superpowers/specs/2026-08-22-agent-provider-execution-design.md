# Agent Provider Execution Design

## Status

Design approved in chat; written spec awaiting user review before implementation.

## Goal

Add a provider-independent LLM execution boundary that can normalize model responses, represent tool calls, and drive a bounded multi-turn agent loop without giving the model direct filesystem or shell access.

## Scope

This slice covers the runtime abstraction and execution loop only. It does not add a provider API key, hard-code a commercial provider, or expose unrestricted tools.

## Architecture

```text
TaskRunner
   |
   v
AgentRuntime
   |
   +--> AgentContext
   |
   v
LLMProvider
   |
   +--> assistant text
   +--> normalized tool calls
             |
             v
        ToolRegistry
             |
             v
 SecurityPolicy / ToolExecutor
             |
             v
        Tool result
             |
             +----> AgentRuntime -> next model turn
```

`AgentRuntime` owns orchestration and turn limits. `LLMProvider` owns transport/provider-specific request formatting and response normalization. `ToolRegistry` is the allowlist between model output and executable capabilities. Existing `SecurityPolicy` and `ToolExecutor` remain the enforcement boundary for commands; project/file operations continue through existing services.

## Contracts

### LLMProvider

```ts
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools: LLMToolDefinition[];
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
```

Provider adapters must return this normalized shape. The runtime must not depend on provider-specific response types.

### ToolRegistry

```ts
export interface AgentToolContext {
  projectId: string;
  taskId: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    arguments_: Record<string, unknown>,
    context: AgentToolContext,
  ): Promise<{ content: string }>;
}

export interface ToolRegistry {
  definitions(): LLMToolDefinition[];
  execute(
    call: LLMToolCall,
    context: AgentToolContext,
  ): Promise<{ content: string }>;
}
```

Unknown tool names and invalid argument shapes must fail as controlled tool errors; they must never fall through to arbitrary command execution.

## Agent loop

The runtime will execute at most `maxTurns` model turns. Each turn:

1. Send the accumulated messages and allowlisted tool definitions to the provider.
2. If the provider returns final text with `finishReason = stop`, finish successfully.
3. If tool calls are returned, execute each through `ToolRegistry` and append tool results to the conversation.
4. Continue until the provider finishes or `maxTurns` is reached.
5. On timeout, provider failure, malformed response, unknown tool, or turn exhaustion, return a structured failure without applying changes automatically.

The default `maxTurns` is 8 and must be configurable for tests. No retry loop may bypass this bound.

## Security requirements

- The model never receives a raw shell/file-system handle.
- Tool execution is allowlisted through `ToolRegistry`.
- Command-capable tools must delegate to the existing `ToolExecutor` and `SecurityPolicy` path.
- Change creation remains review-first; a model response cannot directly mutate project files.
- Provider errors and tool errors are returned as task-level failures or tool-result messages, not thrown across the renderer boundary.
- CI tests must use a fake provider; no network access or secret is required.

## Provider adapter boundary

The first concrete adapter after this slice will target an OpenAI-compatible HTTP API. That adapter is intentionally separate from this design so local/free endpoints such as Ollama or other compatible servers can be added without changing `AgentRuntime`, `TaskRunner`, or tool security.

## Testing

The test suite must cover:

- final text response completes in one turn;
- tool call is dispatched through the registry;
- tool result is fed into the next provider turn;
- unknown tool is rejected without execution;
- provider error becomes controlled failure;
- malformed tool arguments become controlled tool errors;
- `maxTurns` prevents infinite loops;
- command-capable tool remains behind the existing security executor;
- no tool call directly mutates a project during the agent loop.

## Non-goals

- Real provider credentials or network calls in CI.
- Automatic ChangeSet application.
- Autonomous unrestricted shell access.
- Multi-agent manager/planner/reviewer orchestration.
