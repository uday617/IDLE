# Real Agent Milestone

The runtime can now opt into a real local LLM agent while keeping CI deterministic and network-free.

## Enable the local agent

Set:

```text
IDLE_AGENT_MODE=llm
```

The default provider is OpenAI-compatible at `http://127.0.0.1:11434/v1` with model `qwen2.5-coder:7b`.

Override with:

```text
IDLE_LLM_BASE_URL=http://127.0.0.1:11434/v1
IDLE_LLM_MODEL=qwen2.5-coder:7b
IDLE_LLM_TIMEOUT_MS=120000
```

`IDLE_LLM_API_KEY` is optional for hosted OpenAI-compatible endpoints.

## Safety boundary

The model receives only these workspace tools:

- `list_files`
- `read_file`
- `propose_create_file`
- `propose_replace_line`
- `propose_delete_file`

Proposal tools never write to disk. They collect a `ChangeSet`, which continues through the existing review/validation/apply path. Shell execution is deliberately not exposed to the model in this milestone.

## CI behavior

When `IDLE_AGENT_MODE` is not `llm`, the existing deterministic proposal path remains active. Tests do not require Ollama, credentials, or network access.
