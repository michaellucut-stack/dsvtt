import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  requireRole,
  DIRECTOR_PERMISSIONS,
  PLAYER_PERMISSIONS,
} from '../rbac.js';
import type { Permission } from '../rbac.js';

describe('hasPermission', () => {
  it('returns true for all DIRECTOR_PERMISSIONS when role is director', () => {
    for (const perm of DIRECTOR_PERMISSIONS) {
      expect(hasPermission('director', perm)).toBe(true);
    }
  });

  it('returns true for all PLAYER_PERMISSIONS when role is player', () => {
    for (const perm of PLAYER_PERMISSIONS) {
      expect(hasPermission('player', perm)).toBe(true);
    }
  });

  it('returns false for director-only permission when role is player', () => {
    expect(hasPermission('player', 'manage_npcs')).toBe(false);
  });
});

describe('DIRECTOR_PERMISSIONS is a superset of PLAYER_PERMISSIONS', () => {
  it('every player permission is also a director permission', () => {
    for (const perm of PLAYER_PERMISSIONS) {
      expect(DIRECTOR_PERMISSIONS).toContain(perm);
    }
  });
});

describe('requireRole', () => {
  it('returns a predicate that accepts allowed roles', () => {
    const isDirector = requireRole('director');
    expect(isDirector('director')).toBe(true);
    expect(isDirector('player')).toBe(false);
  });

  it('supports multiple allowed roles', () => {
    const isAny = requireRole('director', 'player');
    expect(isAny('director')).toBe(true);
    expect(isAny('player')).toBe(true);
  });
});
