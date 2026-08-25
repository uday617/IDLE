import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ProjectService } from './ProjectService.js';
import type { ProjectGraph } from './ProjectGraph.js';
import type { ProjectLanguageService } from './ProjectLanguageService.js';
import type { ProjectScanner } from './ProjectScanner.js';

export interface ContextRetrievalOptions {
  maxFiles?: number;
  maxChars?: number;
  maxTokens?: number;
}

export interface RetrievedContextFile {
  path: string;
  content: string;
  score: number;
  tokensEstimate: number;
}

export interface RetrievedProjectContext {
  files: RetrievedContextFile[];
  totalChars: number;
  totalTokensEstimate: number;
}

interface Candidate {
  path: string;
  symbols: string[];
  score: number;
}

export class ProjectContextRetriever {
  constructor(
    private readonly projects: ProjectService,
    private readonly scanner: ProjectScanner,
    private readonly language: ProjectLanguageService,
    private readonly graph: ProjectGraph,
  ) {}

  async retrieve(
    projectId: string,
    task: string,
    options: ContextRetrievalOptions = {},
  ): Promise<RetrievedProjectContext> {
    const project = await this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const maxFiles = Math.max(1, options.maxFiles ?? 8);
    const maxChars = Math.max(1, options.maxChars ?? 24_000);
    const maxTokens = Math.max(1, options.maxTokens ?? Math.floor(maxChars / 4));
    const files = await this.scanner.scan(projectId);
    const parsed = await this.language.parseFiles(projectId, files);
    await this.graph.update(
      projectId,
      parsed.map((file) => ({ path: file.path, imports: file.imports, symbols: file.symbols })),
    );

    const taskTokens = tokenize(task);
    const candidates: Candidate[] = parsed.map((file) => ({
      path: file.path,
      symbols: file.symbols,
      score: scoreCandidate(file.path, file.symbols, taskTokens),
    }));

    candidates.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

    const result: RetrievedProjectContext = {
      files: [],
      totalChars: 0,
      totalTokensEstimate: 0,
    };

    for (const candidate of candidates.slice(0, maxFiles)) {
      if (result.totalChars >= maxChars || result.totalTokensEstimate >= maxTokens) {
        break;
      }

      const content = await readFile(join(project.path, candidate.path), 'utf8');
      const remainingChars = maxChars - result.totalChars;
      const remainingTokens = maxTokens - result.totalTokensEstimate;
      const maxContentChars = Math.min(remainingChars, remainingTokens * 4);
      if (maxContentChars <= 0) break;

      const boundedContent = content.slice(0, maxContentChars);
      const tokensEstimate = Math.ceil(boundedContent.length / 4);
      result.files.push({
        path: candidate.path,
        content: boundedContent,
        score: candidate.score,
        tokensEstimate,
      });
      result.totalChars += boundedContent.length;
      result.totalTokensEstimate += tokensEstimate;
    }

    return result;
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_$]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreCandidate(path: string, symbols: string[], taskTokens: string[]): number {
  const pathTokens = tokenize(path.replace(/[\\/_.-]/g, ' '));
  let score = 0;

  for (const taskToken of taskTokens) {
    for (const pathToken of pathTokens) {
      if (pathToken === taskToken) score += 5;
      else if (relatedToken(pathToken, taskToken)) score += 3;
    }

    for (const symbol of symbols) {
      const symbolToken = symbol.toLowerCase();
      if (symbolToken === taskToken) score += 4;
      else if (relatedToken(symbolToken, taskToken)) score += 2;
    }
  }

  return score;
}

function relatedToken(left: string, right: string): boolean {
  return left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left));
}
