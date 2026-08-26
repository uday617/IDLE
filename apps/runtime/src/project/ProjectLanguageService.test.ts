import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LanguageAdapterRegistry } from './LanguageAdapterRegistry.js';
import { ProjectLanguageService } from './ProjectLanguageService.js';
import { ProjectScanner } from './ProjectScanner.js';
import { ProjectService } from './ProjectService.js';
import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter.js';

describe('ProjectLanguageService', () => {
  it('parses supported project files and ignores unsupported file types', async () => {
    const root = await mkdtemp(join(tmpdir(), 'idle-project-language-'));
    await writeFile(join(root, 'index.ts'), "import { helper } from './helper.js';\nexport const answer = 42;");
    await writeFile(join(root, 'README.md'), '# IDLE');

    const projects = new ProjectService();
    const project = await projects.open(root);
    const scanner = new ProjectScanner(projects);
    const registry = new LanguageAdapterRegistry([new TypeScriptLanguageAdapter()]);
    const language = new ProjectLanguageService(projects, registry);

    const files = await scanner.scan(project.id);
    await expect(language.parseFiles(project.id, files)).resolves.toEqual([
      {
        path: 'index.ts',
        language: 'typescript',
        imports: ['./helper.js'],
        symbols: ['answer'],
      },
    ]);
  });
});
