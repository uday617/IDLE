import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LanguageAdapterRegistry } from './LanguageAdapterRegistry.js';
import { ProjectGraph } from './ProjectGraph.js';
import { ProjectGraphRepository } from './ProjectGraphRepository.js';
import { ProjectIndexer } from './ProjectIndexer.js';
import { ProjectIntelligenceService } from './ProjectIntelligenceService.js';
import { ProjectLanguageService } from './ProjectLanguageService.js';
import { ProjectScanner } from './ProjectScanner.js';
import { ProjectService } from './ProjectService.js';
import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter.js';

describe('ProjectIntelligenceService', () => {
  it('indexes a project and retrieves bounded task context through one service boundary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-intelligence-'));
    await writeFile(join(root, 'auth.ts'), 'export function authenticate() { return true; }');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const scanner = new ProjectScanner(projects);
    const indexer = new ProjectIndexer(projects);
    const language = new ProjectLanguageService(
      projects,
      new LanguageAdapterRegistry([new TypeScriptLanguageAdapter()]),
    );
    const graph = new ProjectGraph(new ProjectGraphRepository(await mkdtemp(join(tmpdir(), 'idle-graph-'))));
    const intelligence = new ProjectIntelligenceService(projects, scanner, indexer, language, graph);

    await expect(intelligence.index(project.id)).resolves.toMatchObject({ added: ['auth.ts'] });
    await expect(intelligence.retrieve(project.id, 'fix authentication timeout', { maxFiles: 1 })).resolves.toMatchObject({
      files: [{ path: 'auth.ts' }],
    });
  });
});
