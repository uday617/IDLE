import type { CoordinationEvent } from '@idle/contracts';

type CoordinationListener = (event: CoordinationEvent) => void;

export class CoordinationEventEmitter {
  private readonly listeners = new Set<CoordinationListener>();

  on(listener: CoordinationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: CoordinationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
