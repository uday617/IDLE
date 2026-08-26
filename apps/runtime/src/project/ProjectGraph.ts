import { dirname, extname, join, posix } from 'node:path';
import type { ProjectGraphRepository } from './ProjectGraphRepository.js';

export interface GraphFile {
  path: string;
  imports: string[];
  symbols: string[];
}

interface ProjectGraphState {
  files: Map<string, GraphFile>;
  imports: Map<string, Set<string>>;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export class ProjectGraph {
  private readonly projects = new Map<string, ProjectGraphState>();

  constructor(private readonly repository?: ProjectGraphRepository) {}

  async update(projectId: string, files: GraphFile[]): Promise<void> {
    const state = this.buildState(files);
    this.projects.set(projectId, state);
    if (this.repository) {
      await this.repository.save(projectId, files);
    }
  }

  async load(projectId: string): Promise<void> {
    if (!this.repository) return;
    const files = await this.repository.load(projectId);
    this.projects.set(projectId, this.buildState(files));
  }

  relatedFiles(projectId: string, path: string, maxDepth = 1): string[] {
    const state = this.projects.get(projectId);
    if (!state) {
      return [];
    }

    const start = normalizePath(path);
    if (!state.files.has(start) || maxDepth < 1) {
      return [];
    }

    const result = new Set<string>();
    let frontier = new Set([start]);

    for (let depth = 0; depth < maxDepth && frontier.size > 0; depth += 1) {
      const next = new Set<string>();
      for (const current of frontier) {
        for (const target of state.imports.get(current) ?? []) {
          if (!result.has(target)) {
            result.add(target);
            next.add(target);
          }
        }
      }
      frontier = next;
    }

    return [...result].sort();
  }

  symbols(projectId: string, path: string): string[] {
    const file = this.projects.get(projectId)?.files.get(normalizePath(path));
    return file ? [...file.symbols].sort() : [];
  }

  async clear(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    if (this.repository) {
      await this.repository.delete(projectId);
    }
  }

  private buildState(files: GraphFile[]): ProjectGraphState {
    const fileMap = new Map(files.map((file) => [normalizePath(file.path), cloneGraphFile(file)]));
    const imports = new Map<string, Set<string>>();

    for (const file of fileMap.values()) {
      const targets = new Set<string>();
      for (const specifier of file.imports) {
        const target = resolveRelativeImport(file.path, specifier, fileMap);
        if (target) {
          targets.add(target);
        }
      }
      imports.set(file.path, targets);
    }

    return { files: fileMap, imports };
  }
}

function cloneGraphFile(file: GraphFile): GraphFile {
  return {
    path: file.path,
    imports: [...file.imports],
    symbols: [...file.symbols],
  };
}

function normalizePath(path: string): string {
  return posix.normalize(path.replace(/\\/g, '/')).replace(/^\.\//, '');
}

function resolveRelativeImport(
  fromPath: string,
  specifier: string,
  files: Map<string, GraphFile>,
): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }

  const base = normalizePath(join(dirname(fromPath), specifier));
  const candidates = [base];

  if (extname(base)) {
    const extensionless = base.slice(0, -extname(base).length);
    candidates.push(...SOURCE_EXTENSIONS.map((extension) => `${extensionless}${extension}`));
  } else {
    candidates.push(...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`));
  }

  candidates.push(...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`));

  return candidates.find((candidate) => files.has(normalizePath(candidate)));
}
