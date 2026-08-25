import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LanguageAdapterRegistry } from './LanguageAdapterRegistry.js';
import { ProjectContextRetriever } from './ProjectContextRetriever.js';
import { ProjectGraph } from './ProjectGraph.js';
import { ProjectLanguageService } from './ProjectLanguageService.js';
import { ProjectScanner } from './ProjectScanner.js';
import { ProjectService } from './ProjectService.js';
import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter.js';

describe('ProjectContextRetriever', () => {
  it('ranks task-relevant project files and enforces a context budget', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-context-'));
    await writeFile(join(root, 'auth.ts'), 'export function authenticate() { return true; }');
    await writeFile(join(root, 'payments.ts'), 'export function chargePayment() { return true; }');
    await writeFile(join(root, 'index.ts'), "import { authenticate } from './auth.js';");

    const projects = new ProjectService();
    const project = await projects.open(root);
    const scanner = new ProjectScanner(projects);
    const language = new ProjectLanguageService(
      projects,
      new LanguageAdapterRegistry([new TypeScriptLanguageAdapter()]),
    );
    const graph = new ProjectGraph();
    const retriever = new ProjectContextRetriever(projects, scanner, language, graph);

    const result = await retriever.retrieve(project.id, 'fix authentication timeout', {
      maxFiles: 2,
      maxChars: 120,
    });

    expect(result.files[0]?.path).toBe('auth.ts');
    expect(result.files.length).toBeLessThanOrEqual(2);
    expect(result.totalChars).toBeLessThanOrEqual(120);
  });
});
