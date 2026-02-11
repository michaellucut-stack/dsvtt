/** A complete dice roll result including all individual die outcomes. */
export interface DiceRoll {
  id: string;
  sessionId: string;
  playerId: string;
  /** The original dice notation string (e.g., "2d6+3"). */
  formula: string;
  results: SingleDie[];
  total: number;
  /** Whether the roll is only visible to the director. */
  isPrivate: boolean;
  timestamp: Date;
}

/** The outcome of a single die within a roll. */
export interface SingleDie {
  /** Number of faces on the die (e.g., 6, 8, 20). */
  sides: number;
  /** The face-up result. */
  result: number;
  /** Whether this die was dropped (e.g., by keep-highest). */
  dropped: boolean;
  /** Whether this die exploded (rolled max and re-rolled). */
  exploded: boolean;
}
