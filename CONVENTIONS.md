# DSVTT - Coding Conventions & Standards

## TypeScript

### Strict Mode (Enforced)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Type Definitions
- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and computed types
- Suffix types descriptively: `GameEvent`, `PlayerAction`, `RoomState`, `DiceRollResult`
- Export all shared types from `packages/shared`
- Use discriminated unions for events and actions:

```typescript
type GameEvent =
  | { type: 'TOKEN_MOVED'; payload: TokenMovedPayload }
  | { type: 'DICE_ROLLED'; payload: DiceRolledPayload }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload };
```

### No `any` - Use `unknown` Instead
```typescript
// BAD
function parse(data: any): GameEvent { ... }

// GOOD
function parse(data: unknown): GameEvent {
  const validated = gameEventSchema.parse(data);
  return validated;
}
```

### Zod for Runtime Validation
- Every API endpoint input validated with Zod
- Every Socket.IO event payload validated with Zod
- Zod schemas co-located with their TypeScript types
- Use `z.infer<typeof schema>` to derive types from schemas

---

## Naming Conventions

| Element              | Convention       | Example                          |
|----------------------|------------------|----------------------------------|
| Files (general)      | kebab-case       | `game-state-store.ts`            |
| React components     | PascalCase       | `DiceRoller.tsx`                 |
| Variables/functions  | camelCase        | `const playerCount = 5`          |
| Constants            | SCREAMING_SNAKE  | `const MAX_PLAYERS = 8`          |
| Types/Interfaces     | PascalCase       | `interface GameSession {}`       |
| Enums                | PascalCase       | `enum PlayerRole { Director }`   |
| DB tables            | snake_case       | `game_sessions`                  |
| DB columns           | snake_case       | `created_at`                     |
| Socket.IO events     | SCREAMING_SNAKE  | `GAME_STATE_UPDATE`              |
| API routes           | kebab-case       | `/api/game-sessions/:id`         |
| CSS classes          | Tailwind utility  | `className="flex items-center"`  |
| Test files           | `*.test.ts`      | `dice-parser.test.ts`            |
| E2E test files       | `*.spec.ts`      | `game-session.spec.ts`           |
| Storybook stories    | `*.stories.tsx`  | `DiceRoller.stories.tsx`         |

---

## Git Conventions

### Branch Naming
```
{type}/{ticket-id}-{short-description}

Examples:
feature/VTT-42-dice-rolling-engine
bugfix/VTT-99-token-snap-to-grid
hotfix/VTT-101-auth-token-expiry
release/v0.2.0
chore/VTT-55-update-dependencies
```

### Commit Messages (Conventional Commits)
```
type(scope): description

feat(dice): add support for exploding dice notation
fix(map): correct token z-index ordering on grid
refactor(auth): extract JWT utils into shared package
test(chat): add E2E tests for whisper messages
docs(adr): add ADR-005 for AI provider abstraction
chore(deps): update Socket.IO to 4.8.x
perf(map): optimize canvas re-renders with useMemo
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `style`

**Scopes:** `auth`, `map`, `chat`, `dice`, `game`, `lobby`, `config`, `ai`, `db`, `infra`, `ci`

### Pull Request Template
```markdown
## What
Brief description of the change.

## Why
Business/technical rationale.

## How
Implementation approach and key decisions.

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if UI change)
- [ ] Manual testing performed

## Screenshots (if UI change)
Before | After

## Checklist
- [ ] TypeScript strict mode clean
- [ ] ESLint clean
- [ ] Tests passing
- [ ] ADR written (if architectural change)
- [ ] API docs updated (if API change)
```

---

## ESLint Configuration (Strict)

Key rules enforced:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/explicit-function-return-type`: error (for exported functions)
- `@typescript-eslint/no-unused-vars`: error
- `@typescript-eslint/strict-boolean-expressions`: error
- `import/order`: enforced (groups: builtin, external, internal, parent, sibling)
- `no-console`: warn (use structured logger instead)
- `react-hooks/exhaustive-deps`: error
- `react/no-array-index-key`: warn

---

## Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## Project Structure Rules

### Package Boundaries
- `packages/shared` - NO external dependencies, types and constants only
- `packages/events` - depends on `shared` only
- `packages/game-engine` - depends on `shared` and `events` only (isomorphic)
- `packages/dice-engine` - ZERO dependencies (pure logic)
- `packages/rule-parser` - depends on `shared` only
- `packages/ai-providers` - depends on `shared`, external AI SDKs
- `packages/ui` - depends on `shared`, React, shadcn/ui, Tailwind
- `packages/auth` - depends on `shared`, Passport, JWT libs
- `apps/web` - can depend on any package
- `apps/server` - can depend on any package except `ui`

### Import Rules
```typescript
// GOOD - import from package index
import { GameEvent, PlayerRole } from '@dsvtt/shared';
import { GAME_STATE_UPDATE } from '@dsvtt/events';

// BAD - deep imports into package internals
import { GameEvent } from '@dsvtt/shared/src/types/game';
```

---

## Error Handling

### Backend - Explicit Error Types
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational: boolean = true,
  ) {
    super(message);
  }
}

// Usage
throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
throw new AppError('Not your turn', 403, 'OUT_OF_TURN_ACTION');
```

### Frontend - Error Boundaries + Toast
- React Error Boundaries for component-level crashes
- Toast notifications for API/Socket.IO errors
- Retry logic for transient WebSocket failures

---

## Logging Standards

### Structured Logging (Backend)
```typescript
// Use structured JSON logs for ELK ingestion
logger.info('Game session started', {
  sessionId: session.id,
  roomId: room.id,
  playerCount: players.length,
  configSchemaVersion: config.version,
});

logger.error('AI provider failed', {
  provider: 'anthropic',
  error: err.message,
  sessionId: session.id,
  retryCount: 3,
});
```

### Log Levels
- `error` - Unrecoverable errors, service failures
- `warn` - Recoverable errors, degraded functionality
- `info` - Key business events (session start, player join, dice roll)
- `debug` - Detailed technical events (state transitions, SQL queries)

---

## Testing Standards

### Test File Location
- Unit tests: co-located with source (`dice-parser.test.ts` next to `dice-parser.ts`)
- Integration tests: `__tests__/` directory in each app
- E2E tests: top-level `e2e/` directory
- Load tests: top-level `k6/` directory

### Test Naming
```typescript
describe('DiceParser', () => {
  describe('parse', () => {
    it('should parse simple dice notation like "2d6"', () => { ... });
    it('should handle modifiers like "2d6+3"', () => { ... });
    it('should throw on invalid notation', () => { ... });
  });
});
```

### Coverage Targets
| Scope              | Target |
|--------------------|--------|
| packages/*         | 80%+   |
| apps/server (API)  | 75%+   |
| apps/web           | 70%+   |
| Critical paths     | 90%+   |

Critical paths: auth, dice rolling, game state sync, event sourcing, turn management.

---

## Documentation Standards

### ADR Format (Architecture Decision Records)
```markdown
# ADR-{number}: {title}

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-{n}

## Context
What is the issue that we're seeing that motivates this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or harder because of this change?
```

### API Documentation
- OpenAPI 3.1 specs maintained in `apps/server/openapi/`
- Auto-generated from Zod schemas where possible
- Every endpoint documented with request/response examples

### Code Comments
- JSDoc for all exported functions
- Inline comments for non-obvious business logic
- `// TODO(agent-name):` for tracked technical debt
- `// HACK:` with explanation for temporary workarounds

```typescript
/**
 * Evaluates a dice formula and returns the result.
 *
 * @param formula - Dice notation string (e.g., "2d6+3", "4d8kh3")
 * @param seed - Optional RNG seed for deterministic testing
 * @returns Evaluated dice result with individual rolls
 * @throws {DiceParseError} If the formula syntax is invalid
 */
export function evaluateDice(formula: string, seed?: number): DiceResult {
  // ...
}
```
