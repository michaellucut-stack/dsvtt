import type { PlayerRole } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * All permissions recognised by the RBAC system.
 *
 * Director permissions come from the `team-config.json` spec under
 * `gameArchitecture.roles.director.permissions`.
 * Player permissions combine the base and configurable sets from
 * `gameArchitecture.roles.player`.
 */
export type Permission =
  // Director
  | 'manage_npcs'
  | 'modify_world_state'
  | 'override_rules'
  | 'control_all_tokens'
  | 'manage_fog_of_war'
  | 'send_private_messages'
  | 'trigger_events'
  | 'approve_ai_suggestions'
  | 'manage_session'
  // Player (base)
  | 'move_own_tokens'
  | 'roll_dice'
  | 'send_chat_messages'
  | 'view_own_character_sheet'
  | 'perform_actions_on_turn'
  | 'request_ai_assistance'
  // Player (configurable — granted by default so Directors can revoke)
  | 'act_out_of_turn'
  | 'move_tokens_out_of_turn'
  | 'view_other_character_sheets'
  | 'modify_shared_notes'
  | 'place_markers_on_map'
  | 'whisper_to_other_players';

// ---------------------------------------------------------------------------
// Role → permission mapping
// ---------------------------------------------------------------------------

/** Permissions granted to the Director role. */
export const DIRECTOR_PERMISSIONS: readonly Permission[] = [
  'manage_npcs',
  'modify_world_state',
  'override_rules',
  'control_all_tokens',
  'manage_fog_of_war',
  'send_private_messages',
  'trigger_events',
  'approve_ai_suggestions',
  'manage_session',
  // Directors implicitly have every player permission as well.
  'move_own_tokens',
  'roll_dice',
  'send_chat_messages',
  'view_own_character_sheet',
  'perform_actions_on_turn',
  'request_ai_assistance',
  'act_out_of_turn',
  'move_tokens_out_of_turn',
  'view_other_character_sheets',
  'modify_shared_notes',
  'place_markers_on_map',
  'whisper_to_other_players',
] as const;

/** Permissions granted to the Player role (base + configurable defaults). */
export const PLAYER_PERMISSIONS: readonly Permission[] = [
  'move_own_tokens',
  'roll_dice',
  'send_chat_messages',
  'view_own_character_sheet',
  'perform_actions_on_turn',
  'request_ai_assistance',
  'act_out_of_turn',
  'move_tokens_out_of_turn',
  'view_other_character_sheets',
  'modify_shared_notes',
  'place_markers_on_map',
  'whisper_to_other_players',
] as const;

/** Lookup from role to its granted permissions. */
const ROLE_PERMISSIONS: Record<PlayerRole, readonly Permission[]> = {
  director: DIRECTOR_PERMISSIONS,
  player: PLAYER_PERMISSIONS,
};

// ---------------------------------------------------------------------------
// Authorisation helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a role has a specific permission.
 *
 * @param role       - The role to check.
 * @param permission - The permission to test for.
 * @returns `true` if the role includes the given permission.
 */
export function hasPermission(
  role: PlayerRole,
  permission: Permission,
): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes(permission);
}

/**
 * Create a predicate that checks whether a role is one of the allowed roles.
 *
 * Useful as middleware or guard logic:
 *
 * @example
 * ```ts
 * const isDirector = requireRole('director');
 * if (!isDirector(user.role)) throw new ForbiddenError();
 * ```
 *
 * @param roles - One or more roles that are permitted.
 * @returns A function `(role: PlayerRole) => boolean`.
 */
export function requireRole(
  ...roles: PlayerRole[]
): (role: PlayerRole) => boolean {
  const allowed = new Set<PlayerRole>(roles);
  return (role: PlayerRole): boolean => allowed.has(role);
}
