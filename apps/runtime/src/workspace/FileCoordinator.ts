export interface Reservation {
  id: string;
  agentId: string;
  paths: string[];
}

export interface Conflict {
  agentId: string;
  paths: string[];
}

export class FileCoordinator {
  private readonly reservations = new Map<string, Reservation>();
  private nextReservationId = 1;

  async reserve(agentId: string, paths: string[]): Promise<Reservation> {
    const normalizedPaths = this.normalizePaths(paths);
    const conflicts = await this.conflicts(normalizedPaths);

    if (conflicts.length > 0) {
      const conflictingPaths = conflicts.flatMap((conflict) => conflict.paths).sort();
      throw new Error(`File reservation conflict: ${conflictingPaths.join(', ')}`);
    }

    const reservation: Reservation = {
      id: `reservation-${this.nextReservationId++}`,
      agentId,
      paths: normalizedPaths,
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  async release(reservationId: string): Promise<void> {
    this.reservations.delete(reservationId);
  }

  async conflicts(paths: string[]): Promise<Conflict[]> {
    const requested = new Set(this.normalizePaths(paths));
    if (requested.size === 0) return [];

    return [...this.reservations.values()]
      .map((reservation): Conflict | null => {
        const overlappingPaths = reservation.paths.filter((path) => requested.has(path));
        return overlappingPaths.length > 0
          ? { agentId: reservation.agentId, paths: overlappingPaths }
          : null;
      })
      .filter((conflict): conflict is Conflict => conflict !== null)
      .sort((a, b) => a.agentId.localeCompare(b.agentId));
  }

  private normalizePaths(paths: string[]): string[] {
    return [...new Set(
      paths
        .map((path) => path.replaceAll('\\', '/'))
        .map((path) => path.replace(/^\.\//, ''))
        .filter((path) => path.length > 0),
    )].sort();
  }
}
