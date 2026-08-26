import type { ProjectContextRetriever, ContextRetrievalOptions, RetrievedProjectContext } from './ProjectContextRetriever.js';
import { ProjectContextRetriever as ContextRetriever } from './ProjectContextRetriever.js';
import type { ProjectGraph } from './ProjectGraph.js';
import type { ProjectIndexer, ProjectIndexDelta } from './ProjectIndexer.js';
import type { ProjectLanguageService } from './ProjectLanguageService.js';
import type { ProjectScanner } from './ProjectScanner.js';
import type { ProjectService } from './ProjectService.js';

export class ProjectIntelligenceService {
  private readonly retriever: ProjectContextRetriever;

  constructor(
    private readonly projects: ProjectService,
    private readonly scanner: ProjectScanner,
    private readonly indexer: ProjectIndexer,
    private readonly language: ProjectLanguageService,
    private readonly graph: ProjectGraph,
  ) {
    this.retriever = new ContextRetriever(projects, scanner, language, graph);
  }

  async index(projectId: string): Promise<ProjectIndexDelta> {
    const delta = await this.indexer.update(projectId);
    const files = await this.scanner.scan(projectId);
    const parsed = await this.language.parseFiles(projectId, files);
    await this.graph.update(
      projectId,
      parsed.map((file) => ({ path: file.path, imports: file.imports, symbols: file.symbols })),
    );
    return delta;
  }

  async retrieve(
    projectId: string,
    task: string,
    options: ContextRetrievalOptions = {},
  ): Promise<RetrievedProjectContext> {
    return this.retriever.retrieve(projectId, task, options);
  }

  async load(projectId: string): Promise<void> {
    await this.graph.load(projectId);
  }

  async clear(projectId: string): Promise<void> {
    this.indexer.clear(projectId);
    await this.graph.clear(projectId);
  }
}
