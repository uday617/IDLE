import { describe, expect, it } from 'vitest';
import { ProjectGraph, type GraphFile } from './ProjectGraph.js';

describe('ProjectGraph', () => {
  it('builds file and symbol relationships and resolves relative imports', async () => {
    const graph = new ProjectGraph();
    const files: GraphFile[] = [
      {
        path: 'src/index.ts',
        imports: ['./helper.js'],
        symbols: ['run'],
      },
      {
        path: 'src/helper.ts',
        imports: [],
        symbols: ['helper'],
      },
    ];

    await graph.update('project-1', files);

    expect(graph.relatedFiles('project-1', 'src/index.ts', 1)).toEqual(['src/helper.ts']);
    expect(graph.symbols('project-1', 'src/index.ts')).toEqual(['run']);
  });

  it('replaces a changed file without leaving stale graph edges', async () => {
    const graph = new ProjectGraph();

    await graph.update('project-1', [
      { path: 'src/index.ts', imports: ['./old.ts'], symbols: ['run'] },
      { path: 'src/old.ts', imports: [], symbols: ['old'] },
      { path: 'src/new.ts', imports: [], symbols: ['new'] },
    ]);

    await graph.update('project-1', [
      { path: 'src/index.ts', imports: ['./new.ts'], symbols: ['run'] },
      { path: 'src/new.ts', imports: [], symbols: ['new'] },
    ]);

    expect(graph.relatedFiles('project-1', 'src/index.ts', 1)).toEqual(['src/new.ts']);
  });
});
