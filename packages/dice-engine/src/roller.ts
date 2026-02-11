/**
 * A simple seeded pseudo-random number generator (mulberry32).
 * Used for deterministic dice rolls in testing.
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A function that returns a random float in [0, 1). */
export type RandomFn = () => number;

/**
 * Creates a random number generator function.
 * If a seed is provided, returns a deterministic PRNG for reproducible results.
 * Otherwise, returns `Math.random`.
 *
 * @param seed - Optional seed for deterministic output
 * @returns A function that returns a random float in [0, 1)
 */
export function createRng(seed?: number): RandomFn {
  if (seed !== undefined) {
    return mulberry32(seed);
  }
  return Math.random;
}

/**
 * Rolls a single die with the given number of sides.
 *
 * @param sides - Number of sides on the die (must be >= 2)
 * @param rng - Random number generator function
 * @returns An integer in [1, sides]
 */
export function rollDie(sides: number, rng: RandomFn): number {
  return Math.floor(rng() * sides) + 1;
}
