#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectPath = process.argv[2] ? resolve(process.argv[2]) : root;
const prompt = process.argv.slice(3).join(' ') ||
  'Inspect this project and propose creating IDLE_SMOKE.md containing exactly: IDLE local agent smoke test';

const runtime = spawn(process.execPath, [resolve(root, 'apps/runtime/dist/main.js')], {
  cwd: root,
  env: { ...process.env, IDLE_AGENT_MODE: 'llm' },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let nextId = 1;
let buffer = '';
const pending = new Map();

runtime.stdout.setEncoding('utf8');
runtime.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }

    if (typeof message.id !== 'number') continue;
    const resolver = pending.get(message.id);
    if (!resolver) continue;
    pending.delete(message.id);
    if (message.error) resolver.reject(new Error(message.error));
    else resolver.resolve(message.result);
  }
});

runtime.on('exit', (code, signal) => {
  const error = new Error(`Runtime exited before smoke test completed (code=${code}, signal=${signal ?? 'none'})`);
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
});

function request(type, payload = {}) {
  const id = nextId++;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, { resolve: resolvePromise, reject });
    runtime.stdin.write(`${JSON.stringify({ id, type, ...payload })}\n`);
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

try {
  const project = await request('project.open', { path: projectPath });
  console.log(`Opened project: ${project.path}`);

  const taskId = `local-agent-smoke-${Date.now()}`;
  await request('task.submit', {
    taskId,
    projectId: project.id,
    prompt,
  });
  console.log(`Submitted task: ${taskId}`);

  const deadline = Date.now() + 10 * 60 * 1000;
  let result = null;
  while (Date.now() < deadline) {
    result = await request('task.get', { taskId });
    if (result) break;
    await sleep(500);
  }

  if (!result) throw new Error('Timed out waiting for local agent task result');
  if (result.status !== 'completed') throw new Error(`Agent task failed: ${result.error ?? result.status}`);
  if (!result.changeSet || !result.changeSet.id) throw new Error('Agent completed without producing a ChangeSet');

  console.log(`ChangeSet produced: ${result.changeSet.id}`);
  console.log(JSON.stringify(result.changeSet, null, 2));
  console.log('LOCAL_AGENT_SMOKE_PASS');
} finally {
  runtime.stdin.end();
  await new Promise((resolvePromise) => runtime.once('exit', resolvePromise));
}
