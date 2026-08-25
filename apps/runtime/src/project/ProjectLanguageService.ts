import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LanguageAdapterRegistry, ParsedSource } from './LanguageAdapterRegistry.js';
import type { ProjectService } from './ProjectService.js';
import type { ProjectFileRecord } from './ProjectScanner.js';

export interface ParsedProjectFile extends ParsedSource {
  path: string;
  language: string;
}

export class ProjectLanguageService {
  constructor(
    private readonly projects: ProjectService,
    private readonly adapters: LanguageAdapterRegistry,
  ) {}

  async parseFiles(projectId: string, files: ProjectFileRecord[]): Promise<ParsedProjectFile[]> {
    const project = await this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const parsed: ParsedProjectFile[] = [];
    for (const file of files) {
      const adapter = this.adapters.forPath(file.path);
      if (!adapter) {
        continue;
      }

      const source = await readFile(join(project.path, file.path), 'utf8');
      parsed.push({
        path: file.path,
        language: adapter.id,
        ...adapter.parse(source),
      });
    }

    return parsed;
  }
}
