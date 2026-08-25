import type { TaskOutcome } from '../memory/TaskMemoryRecorder.js';
import type { ProjectMemory } from '../memory/ProjectMemory.js';
import type { ProjectFact } from '../memory/MemoryRepository.js';
import { TaskLearningExtractor, type ProjectLesson } from './TaskLearningExtractor.js';

export class TaskLearningService {
  constructor(
    private readonly memory: ProjectMemory<ProjectLesson>,
    private readonly extractor = new TaskLearningExtractor(),
  ) {}

  async learnFromOutcome(outcome: TaskOutcome): Promise<ProjectFact<ProjectLesson> | undefined> {
    if (outcome.status !== 'completed' || outcome.verification !== 'passed') return undefined;
    const lesson = this.extractor.extract(outcome);
    if (!lesson) return undefined;
    return this.memory.saveFact(lesson, {
      confidence: 0.9,
      source: 'verification',
      validated: true,
    });
  }

  async recall(query: string, limit = 5): Promise<ProjectFact<ProjectLesson>[]> {
    return this.memory.retrieveFacts(query, limit);
  }
}
