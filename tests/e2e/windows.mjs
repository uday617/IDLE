import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = join(root, 'tests', 'fixtures', 'sample-project');
const desktopEntry = join(root, 'apps', 'desktop', 'out', 'main', 'main.js');
const runtimeBundle = join(root, 'apps', 'desktop', 'runtime-bundle', 'main.js');
const electronExecutable = join(root, 'apps', 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe');

async function createFixtureCopy() {
  const directory = await mkdtemp(join(tmpdir(), 'idle-e2e-'));
  const project = join(directory, 'sample-project');
  await cp(fixture, project, { recursive: true });
  execFileSync('git', ['init', project], { stdio: 'ignore' });
  return { directory, project };
}

async function launchApp(project, taskStorePath) {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [desktopEntry],
    cwd: join(root, 'apps', 'desktop'),
    env: {
      ...process.env,
      IDLE_AGENT_MODE: 'deterministic',
      IDLE_TASK_STORE_PATH: taskStorePath,
      IDLE_RUNTIME_PATH: runtimeBundle,
    },
  });
  app.on('console', (message) => console.log(`[electron:${message.type()}] ${message.text()}`));
  return app;
}

async function waitForTask(page, taskId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await page.evaluate((id) => window.idle.tasks.get(id), taskId);
    if (task?.status === 'completed' || task?.status === 'failed') return task;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for task ${taskId}`);
}

async function waitForRecovery(taskStorePath, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const persisted = JSON.parse(await readFile(taskStorePath, 'utf8'));
      const task = persisted.tasks?.['recovery-task'];
      if (task?.status === 'paused') return task;
    } catch {
      // Runtime has not persisted the recovery result yet.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Timed out waiting for recovery state to persist');
}

async function testOpenProjectAndSingleAgent() {
  const { directory, project } = await createFixtureCopy();
  const taskStorePath = join(directory, 'tasks.json');
  const app = await launchApp(project, taskStorePath);

  try {
    await app.evaluate(({ dialog }, projectPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projectPath] });
    }, project);

    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Open Project' }).click();
    await assertText(page, 'bug.ts');

    await page.getByRole('button', { name: '+ Quick Task' }).click();
    const taskInput = page.getByPlaceholder(/Ask IDLE/);
    await taskInput.fill('Replace line "return 1;" with "return 2;" in file "src/bug.ts"');
    await taskInput.press('Enter');
    await page.getByText('Completed', { exact: true }).waitFor({ timeout: 15_000 });
    await assertText(page, 'Ready to apply');
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function testMultiAgentTask() {
  const { directory, project } = await createFixtureCopy();
  const taskStorePath = join(directory, 'tasks.json');
  const app = await launchApp(project, taskStorePath);

  try {
    await app.evaluate(({ dialog }, projectPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projectPath] });
    }, project);

    const page = await app.firstWindow();
    const projectResult = await page.evaluate(async () => window.idle.project.openDialog());
    assert.ok(projectResult?.id, 'project should open through the desktop IPC boundary');

    const result = await page.evaluate(async ({ projectId }) => {
      return window.idle.tasks.submit({
        taskId: crypto.randomUUID(),
        projectId,
        prompt: [
          'SUBTASK 1: Create file "src/agent-one.ts" with content:',
          'export const agentOne = true;',
          'SUBTASK 2: Create file "src/agent-two.ts" with content:',
          'export const agentTwo = true;',
        ].join('\\n'),
        orchestration: { enabled: true, maxAgents: 2 },
      });
    }, { projectId: projectResult.id });

    assert.equal(result.status, 'queued');
    const task = await waitForTask(page, result.taskId);
    assert.equal(task.status, 'completed');
    assert.equal(task.changeSet?.changes.length, 2);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function testRuntimeRecoveryOnRestart() {
  const { directory, project } = await createFixtureCopy();
  const taskStorePath = join(directory, 'tasks.json');
  await writeFile(taskStorePath, JSON.stringify({
    tasks: {
      'recovery-task': {
        id: 'recovery-task',
        projectId: 'recovery-project',
        prompt: 'resume me',
        status: 'running',
        repairAttempts: 0,
        repairStatus: 'verifying',
        updatedAt: new Date().toISOString(),
      },
    },
  }), 'utf8');

  const app = await launchApp(project, taskStorePath);
  try {
    await app.firstWindow();
    const recovered = await waitForRecovery(taskStorePath);
    assert.ok(recovered.error, 'unrecoverable task must retain a pause reason');
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function assertText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 });
}

await testOpenProjectAndSingleAgent();
await testMultiAgentTask();
await testRuntimeRecoveryOnRestart();
console.log('Windows E2E passed: open project, single-agent, multi-agent, recovery');
