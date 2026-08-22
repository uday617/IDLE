# Real Agent: Local Model Smoke Test

IDLE now has an end-to-end local-model path:

```text
Task submit
  -> AgentRuntime
  -> OpenAI-compatible provider
  -> local model (Ollama by default)
  -> workspace inspection/proposal tools
  -> reviewable ChangeSet
```

The runtime defaults to an Ollama-compatible endpoint at `http://127.0.0.1:11434/v1` and a local model name of `qwen2.5-coder:7b`. These defaults can be overridden with environment variables.

## 1. Install and start Ollama

Install Ollama for your platform, then make sure its local server is running. Ollama exposes an OpenAI-compatible `/v1/chat/completions` endpoint and supports tools on that endpoint. See the official documentation: https://docs.ollama.com/api/openai-compatibility

Pull a coding model that exists on your machine, for example:

```bash
ollama pull qwen2.5-coder:7b
```

If you choose another model, set `IDLE_LLM_MODEL` to that exact local model name.

## 2. Build IDLE

From the repository root:

```bash
pnpm install
pnpm --filter @idle/runtime build
```

## 3. Configure the provider (optional)

Defaults:

```text
IDLE_AGENT_MODE=llm
IDLE_LLM_BASE_URL=http://127.0.0.1:11434/v1
IDLE_LLM_MODEL=qwen2.5-coder:7b
IDLE_LLM_TIMEOUT_MS=120000
```

Ollama does not require a real API key for its local OpenAI-compatible endpoint. If your compatible server requires one, set `IDLE_LLM_API_KEY`.

## 4. Run the smoke test

Run it against a disposable test project first:

```bash
node scripts/real-agent-local-smoke.mjs ./path/to/test-project
```

You can provide a custom prompt after the project path:

```bash
node scripts/real-agent-local-smoke.mjs ./path/to/test-project "Inspect the project and propose creating NOTES.md with the text hello"
```

The harness submits a real task through the runtime, waits for completion, and requires a reviewable ChangeSet. **It does not apply the ChangeSet and does not write the proposed files.** A successful run ends with:

```text
LOCAL_AGENT_SMOKE_PASS
```

## 5. What this proves

A successful smoke test proves the real local path is wired end-to-end:

- the runtime can load the configured provider;
- the local model can answer through the OpenAI-compatible API;
- the model can use the registered workspace tools;
- tool results return to the bounded agent loop;
- the agent can produce a ChangeSet;
- proposal generation remains review-first.

It does **not** prove that every local model follows the system prompt equally well. Tool-calling quality varies by model, so use a model with reliable function/tool-calling support.

> Final validation note: the real-agent smoke workflow also exercises the conventional `list_roots` workspace tool used by local agents.
