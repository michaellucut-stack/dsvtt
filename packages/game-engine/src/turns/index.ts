/** A single entry in the turn order. */
export interface TurnOrderEntry {
  userId: string;
  initiative: number;
}

/** Immutable snapshot of turn order state. */
export interface TurnOrder {
  entries: TurnOrderEntry[];
  currentIndex: number;
  roundNumber: number;
}

/**
 * Manages turn order for a game session.
 * Handles initiative-based ordering, advancing turns, and skipping.
 */
export class TurnManager {
  private entries: TurnOrderEntry[] = [];
  private currentIndex = 0;
  private roundNumber = 0;

  /**
   * Sets the initiative order, sorting entries by initiative descending.
   *
   * @param entries - Array of user IDs with their initiative values
   */
  setOrder(entries: TurnOrderEntry[]): void {
    this.entries = [...entries].sort((a, b) => b.initiative - a.initiative);
    this.currentIndex = 0;
    this.roundNumber = 1;
  }

  /**
   * Returns the user ID of the player whose turn it currently is.
   *
   * @returns The current player's user ID, or null if no turn order is set
   */
  getCurrentPlayerId(): string | null {
    if (this.entries.length === 0) {
      return null;
    }
    return this.entries[this.currentIndex]?.userId ?? null;
  }

  /**
   * Advances to the next turn. Increments the round number when wrapping around.
   *
   * @returns The new current player's user ID, or null if no turn order is set
   */
  nextTurn(): string | null {
    if (this.entries.length === 0) {
      return null;
    }

    this.currentIndex++;
    if (this.currentIndex >= this.entries.length) {
      this.currentIndex = 0;
      this.roundNumber++;
    }

    return this.getCurrentPlayerId();
  }

  /**
   * Skips a specific player's turn. If it's their current turn, advances to the next.
   *
   * @param userId - The user ID of the player to skip
   * @returns The current player's user ID after the skip
   */
  skipPlayer(userId: string): string | null {
    const currentPlayer = this.getCurrentPlayerId();
    if (currentPlayer === userId) {
      return this.nextTurn();
    }
    return currentPlayer;
  }

  /**
   * Removes a player from the turn order entirely.
   *
   * @param userId - The user ID of the player to remove
   */
  removePlayer(userId: string): void {
    const removeIndex = this.entries.findIndex((entry) => entry.userId === userId);
    if (removeIndex === -1) {
      return;
    }

    this.entries.splice(removeIndex, 1);

    if (this.entries.length === 0) {
      this.currentIndex = 0;
      return;
    }

    // Adjust current index if the removed player was before or at current position
    if (removeIndex < this.currentIndex) {
      this.currentIndex--;
    } else if (removeIndex === this.currentIndex && this.currentIndex >= this.entries.length) {
      this.currentIndex = 0;
      this.roundNumber++;
    }
  }

  /** Returns an immutable snapshot of the current turn order state. */
  getState(): TurnOrder {
    return {
      entries: [...this.entries],
      currentIndex: this.currentIndex,
      roundNumber: this.roundNumber,
    };
  }

  /** Returns the current round number. */
  getRoundNumber(): number {
    return this.roundNumber;
  }
}
