import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectService } from './ProjectService.js';
import { ProjectScanner, type ProjectFileRecord } from './ProjectScanner.js';

interface FileFingerprint {
  size: number;
  modifiedAtMs: number;
}

export interface ProjectIndexDelta {
  added: string[];
  changed: string[];
  removed: string[];
}

export class ProjectIndexer {
  private readonly snapshots = new Map<string, Map<string, FileFingerprint>>();
  private readonly scanner: ProjectScanner;

  constructor(private readonly projects: ProjectService) {
    this.scanner = new ProjectScanner(projects);
  }

  async update(projectId: string): Promise<ProjectIndexDelta> {
    const project = await this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const records = await this.scanner.scan(projectId);
    const next = new Map<string, FileFingerprint>();

    for (const record of records) {
      next.set(record.path, await this.fingerprint(project.path, record));
    }

    const previous = this.snapshots.get(projectId) ?? new Map<string, FileFingerprint>();
    const added: string[] = [];
    const changed: string[] = [];
    const removed: string[] = [];

    for (const [path, fingerprint] of next) {
      const old = previous.get(path);
      if (!old) {
        added.push(path);
      } else if (old.size !== fingerprint.size || old.modifiedAtMs !== fingerprint.modifiedAtMs) {
        changed.push(path);
      }
    }

    for (const path of previous.keys()) {
      if (!next.has(path)) {
        removed.push(path);
      }
    }

    this.snapshots.set(projectId, next);

    return {
      added: added.sort(),
      changed: changed.sort(),
      removed: removed.sort(),
    };
  }

  clear(projectId: string): void {
    this.snapshots.delete(projectId);
  }

  private async fingerprint(root: string, record: ProjectFileRecord): Promise<FileFingerprint> {
    const info = await stat(join(root, record.path));
    return {
      size: info.size,
      modifiedAtMs: info.mtimeMs,
    };
  }
}
