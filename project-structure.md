# DSVTT - Project Structure

## Monorepo Layout (Turborepo + pnpm)

```
dsvtt/
├── apps/
│   ├── web/                          # Next.js 14+ frontend (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/               # Auth routes (login, register)
│   │   │   ├── (lobby)/              # Lobby and room listing
│   │   │   ├── (game)/               # Game session routes
│   │   │   │   ├── [roomId]/
│   │   │   │   │   ├── page.tsx      # Main game view (resizable panels)
│   │   │   │   │   ├── map/          # Map canvas component (react-konva)
│   │   │   │   │   ├── chat/         # Chat panel (IC/OOC/whisper)
│   │   │   │   │   ├── dice/         # Dice roller
│   │   │   │   │   ├── turns/        # Turn tracker bar
│   │   │   │   │   ├── characters/   # Character sheet panel
│   │   │   │   │   ├── director/     # Director control panel (NPCs, events)
│   │   │   │   │   ├── config/       # Game config editor (Phase 2)
│   │   │   │   │   └── ai-director/  # AI Director panel (Phase 3)
│   │   │   │   └── replay/
│   │   │   │       └── [sessionId]/  # Session replay viewer
│   │   │   ├── (adventures)/         # Adventure browser (Phase 3)
│   │   │   │   ├── page.tsx          # Adventure list/browser
│   │   │   │   ├── upload/           # Adventure upload flow
│   │   │   │   └── [adventureId]/    # Adventure detail/preview
│   │   │   ├── (admin)/              # Admin/config pages
│   │   │   ├── api/                  # Next.js API routes (BFF layer)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx              # Director landing page
│   │   ├── components/               # App-specific components
│   │   │   ├── character-sheet/      # Character sheet renderer (Phase 2)
│   │   │   │   ├── stat-block.tsx    # Stats section with skills last
│   │   │   │   ├── ability-tabs.tsx  # 3-tab browser (Actions/Maneuvers/Triggered)
│   │   │   │   ├── ability-card.tsx  # Expandable ability card
│   │   │   │   └── sheet-renderer.tsx # Template -> React renderer
│   │   │   ├── ai/                   # AI-related components (Phase 3)
│   │   │   │   ├── ai-approval-panel.tsx    # Approve/reject/edit AI actions
│   │   │   │   ├── ai-narration.tsx         # Read-aloud text display
│   │   │   │   ├── ai-config-panel.tsx      # Provider/model selection
│   │   │   │   ├── override-toggle.tsx      # Human/AI Director toggle
│   │   │   │   └── npc-dialogue.tsx         # NPC speech display
│   │   │   └── adventure/            # Adventure components (Phase 3)
│   │   │       ├── adventure-card.tsx
│   │   │       ├── adventure-browser.tsx
│   │   │       └── upload-wizard.tsx
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── stores/                   # Zustand stores
│   │   │   ├── game-store.ts         # Game state
│   │   │   ├── chat-store.ts         # Chat state
│   │   │   ├── map-store.ts          # Map/canvas state
│   │   │   ├── auth-store.ts         # Auth state
│   │   │   ├── character-store.ts    # Character sheet state (Phase 2)
│   │   │   ├── ai-store.ts           # AI Director state (Phase 3)
│   │   │   └── adventure-store.ts    # Adventure state (Phase 3)
│   │   ├── lib/                      # Utilities
│   │   ├── styles/                   # Global styles
│   │   ├── public/                   # Static assets
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── server/                       # Express + Socket.IO backend
│       ├── src/
│       │   ├── api/                  # REST API routes
│       │   │   ├── auth/             # Auth endpoints
│       │   │   ├── rooms/            # Room management
│       │   │   ├── sessions/         # Game session management
│       │   │   ├── characters/       # Character CRUD
│       │   │   ├── maps/             # Map management
│       │   │   ├── npcs/             # NPC management
│       │   │   ├── search/           # Full-text search
│       │   │   ├── replay/           # Session replay
│       │   │   ├── config/           # Game config endpoints (Phase 2)
│       │   │   ├── game-systems/     # Game system management (Phase 2)
│       │   │   ├── abilities/        # Ability queries (Phase 2)
│       │   │   ├── adventures/       # Adventure CRUD (Phase 3)
│       │   │   └── ai/              # AI provider config (Phase 3)
│       │   ├── socket/               # Socket.IO event handlers
│       │   │   ├── connection.ts     # Connection/auth handshake
│       │   │   ├── game-events.ts    # Game state events
│       │   │   ├── chat-events.ts    # Chat events
│       │   │   ├── dice-events.ts    # Dice rolling events
│       │   │   ├── map-events.ts     # Map/token events
│       │   │   ├── turn-events.ts    # Turn management events
│       │   │   └── ai-events.ts      # AI streaming events (Phase 3)
│       │   ├── engine/               # Game engine core
│       │   │   ├── state-machine.ts  # Game state machine
│       │   │   ├── event-store.ts    # Event sourcing store
│       │   │   ├── turn-manager.ts   # Turn order logic
│       │   │   ├── constraint-engine.ts  # Rule constraint evaluator (Phase 2)
│       │   │   └── snapshot.ts       # Periodic state snapshots
│       │   ├── ai/                   # AI Director (Phase 3)
│       │   │   ├── director-engine.ts    # AI Director state machine
│       │   │   ├── narrative-engine.ts   # Read-aloud, scene descriptions
│       │   │   ├── npc-dialogue.ts       # NPC in-character dialogue
│       │   │   ├── combat-manager.ts     # AI NPC turn management
│       │   │   ├── approval-pipeline.ts  # Propose->Preview->Approve flow
│       │   │   ├── context-manager.ts    # Conversation history, pruning
│       │   │   └── override-handler.ts   # Human takeover/hand-back
│       │   ├── adventure/            # Adventure processing (Phase 3)
│       │   │   ├── folder-validator.ts   # Validate adventure folder structure
│       │   │   ├── pdf-extractor.ts      # PDF text extraction
│       │   │   ├── section-detector.ts   # Identify chapters, encounters, NPCs
│       │   │   ├── structure-builder.ts  # Parsed text -> adventure model
│       │   │   ├── map-ingestor.ts       # Associate maps with encounters
│       │   │   ├── pregen-loader.ts      # Load pregen characters
│       │   │   └── processing-queue.ts   # Async adventure processing jobs
│       │   ├── middleware/           # Express middleware
│       │   │   ├── auth.ts           # JWT verification
│       │   │   ├── rbac.ts           # Role-based access
│       │   │   ├── rate-limit.ts     # Rate limiting
│       │   │   ├── validation.ts     # Zod validation middleware
│       │   │   └── error-handler.ts  # Global error handler
│       │   ├── services/             # Business logic services
│       │   ├── utils/                # Utility functions
│       │   ├── config/               # Server configuration
│       │   └── index.ts              # Server entry point
│       ├── openapi/                  # OpenAPI 3.1 specs
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── packages/
│   ├── shared/                       # Shared types and constants
│   │   ├── src/
│   │   │   ├── types/               # TypeScript type definitions
│   │   │   │   ├── game.ts          # Game-related types
│   │   │   │   ├── user.ts          # User/auth types
│   │   │   │   ├── room.ts          # Room/lobby types
│   │   │   │   ├── chat.ts          # Chat message types
│   │   │   │   ├── dice.ts          # Dice types
│   │   │   │   ├── map.ts           # Map/token types
│   │   │   │   └── config.ts        # Game config types
│   │   │   ├── constants/           # Shared constants
│   │   │   ├── enums/               # Shared enums
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── events/                       # Socket.IO event definitions
│   │   ├── src/
│   │   │   ├── event-types.ts       # All event type definitions
│   │   │   ├── event-schemas.ts     # Zod schemas for events
│   │   │   ├── client-events.ts     # Client -> Server events
│   │   │   └── server-events.ts     # Server -> Client events
│   │   └── tsconfig.json
│   │
│   ├── game-engine/                  # Core game logic (isomorphic)
│   │   ├── src/
│   │   │   ├── state/               # Game state management
│   │   │   ├── rules/               # Rule evaluation engine
│   │   │   ├── turns/               # Turn order system
│   │   │   └── events/              # Event sourcing core
│   │   └── tsconfig.json
│   │
│   ├── dice-engine/                  # Dice formula parser & roller
│   │   ├── src/
│   │   │   ├── parser.ts            # Dice notation parser (e.g., "2d6+3")
│   │   │   ├── roller.ts            # Random number generation
│   │   │   ├── evaluator.ts         # Expression evaluation
│   │   │   └── types.ts             # Dice types
│   │   └── tsconfig.json
│   │
│   ├── rule-parser/                  # TTRPG Markdown -> constraints (Phase 2)
│   │   ├── src/
│   │   │   ├── md-parser.ts         # Markdown rule file parser
│   │   │   ├── section-parser.ts    # Parse sections, tables, stat blocks
│   │   │   ├── ability-parser.ts    # Extract & categorize abilities (A/M/T)
│   │   │   ├── constraint-builder.ts # Build constraint rules from parsed MD
│   │   │   ├── schema-generator.ts  # JSON Schema generator for config
│   │   │   ├── config-validator.ts  # Config validation against schema
│   │   │   ├── folder-loader.ts     # game_rules/ folder loader + validator
│   │   │   └── types.ts
│   │   └── tsconfig.json
│   │
│   ├── ai-providers/                 # Multi-provider AI abstraction (Phase 3)
│   │   ├── src/
│   │   │   ├── base-provider.ts     # Abstract provider interface
│   │   │   ├── anthropic.ts         # Claude SDK wrapper with streaming
│   │   │   ├── openai.ts            # OpenAI SDK wrapper with streaming
│   │   │   ├── ollama.ts            # Ollama HTTP client with streaming
│   │   │   ├── provider-factory.ts  # Provider factory
│   │   │   └── types.ts
│   │   └── tsconfig.json
│   │
│   ├── ui/                           # Shared UI components (shadcn/ui)
│   │   ├── src/
│   │   │   ├── components/          # Reusable UI components
│   │   │   ├── primitives/          # Base primitives (shadcn)
│   │   │   └── theme/               # Theme tokens and config
│   │   └── tsconfig.json
│   │
│   └── auth/                         # Authentication module
│       ├── src/
│       │   ├── strategies/          # Passport strategies
│       │   ├── jwt.ts               # JWT utilities
│       │   ├── password.ts          # bcrypt utilities
│       │   ├── rbac.ts              # Role-based access control
│       │   └── types.ts
│       └── tsconfig.json
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── migrations/                   # Migration files
│   └── seed.ts                       # Seed data
│
├── game_rules/                       # TTRPG rule files (Phase 2)
│   ├── README.md                     # How to add game systems
│   └── {system-name}/               # One folder per game system
│       ├── system.json               # System metadata (name, version, author)
│       ├── character-sheet.pdf       # PDF template for visual reference
│       ├── core-rules.md             # Core mechanics, stats, skills
│       ├── combat.md                 # Combat rules, action economy
│       ├── abilities.md              # All abilities (actions, maneuvers, triggered)
│       ├── classes.md                # Class definitions and progression
│       ├── races.md                  # Race/ancestry features
│       ├── skills.md                 # Skill list and mechanics
│       └── generated/                # Auto-generated (gitignored)
│           ├── config.schema.json    # Generated JSON Schema for game config
│           └── constraints.json      # Generated constraint definitions
│
├── adventures/                       # Adventure folders (Phase 3)
│   ├── README.md                     # Adventure folder format spec
│   └── {adventure-name}/            # One folder per adventure
│       ├── adventure.json            # Metadata: title, system, level range, description
│       ├── story/
│       │   └── adventure-book.pdf    # Main adventure PDF
│       ├── maps/
│       │   ├── enc-01-{name}.png     # Battle map per encounter
│       │   ├── enc-02-{name}.png
│       │   └── world-map.png         # Optional overview map
│       ├── pregens/                  # Optional pregen characters
│       │   └── {character-name}.json
│       └── handouts/                 # Optional player handouts
│           └── {handout-name}.png
│
├── docker/
│   ├── Dockerfile.web                # Frontend Docker image
│   ├── Dockerfile.server             # Backend Docker image
│   ├── docker-compose.dev.yml        # Development environment
│   ├── docker-compose.prod.yml       # Production environment
│   └── docker-compose.elk.yml        # ELK stack
│
├── jenkins/
│   ├── Jenkinsfile                   # Main CI/CD pipeline
│   └── scripts/                      # Pipeline helper scripts
│
├── nginx/
│   ├── nginx.conf                    # Production Nginx config
│   └── ssl/                          # SSL certificates (gitignored)
│
├── elk/
│   ├── elasticsearch/                # ES config
│   ├── logstash/                     # Logstash pipelines
│   │   └── pipeline.conf
│   └── kibana/                       # Kibana config
│
├── e2e/                              # End-to-end tests (Playwright)
│   ├── tests/
│   │   ├── auth.spec.ts              # Phase 1
│   │   ├── lobby.spec.ts             # Phase 1
│   │   ├── game-session.spec.ts      # Phase 1
│   │   ├── map-interaction.spec.ts   # Phase 1
│   │   ├── chat.spec.ts              # Phase 1
│   │   ├── dice-rolling.spec.ts      # Phase 1
│   │   ├── director-tools.spec.ts    # Phase 1
│   │   ├── session-replay.spec.ts    # Phase 1
│   │   ├── character-sheet.spec.ts   # Phase 2
│   │   ├── abilities.spec.ts         # Phase 2
│   │   ├── rules-enforcement.spec.ts # Phase 2
│   │   ├── adventure-upload.spec.ts  # Phase 3
│   │   ├── ai-director.spec.ts       # Phase 3
│   │   └── ai-override.spec.ts       # Phase 3
│   └── playwright.config.ts
│
├── k6/                               # Load tests
│   ├── websocket-load.js
│   └── api-load.js
│
├── docs/
│   ├── architecture/
│   │   ├── adr/                      # Architecture Decision Records
│   │   │   ├── 001-monorepo-turborepo.md
│   │   │   ├── 002-event-sourcing.md
│   │   │   ├── 003-socket-io-protocol.md
│   │   │   ├── 004-map-rendering.md
│   │   │   ├── 005-event-sourcing-impl.md
│   │   │   ├── 006-rules-engine.md           # Phase 2
│   │   │   ├── 007-character-sheet-rendering.md # Phase 2
│   │   │   ├── 008-ai-provider-abstraction.md  # Phase 3
│   │   │   └── 009-ai-director-architecture.md  # Phase 3
│   │   ├── adventure-folder-spec.md  # Standard adventure format (Phase 3)
│   │   ├── c4-system-context.md
│   │   ├── c4-container.md
│   │   └── c4-component.md
│   ├── database/
│   │   ├── erd.md                    # Entity Relationship Diagram
│   │   └── data-dictionary.md
│   ├── security/
│   │   ├── threat-model.md
│   │   └── incident-response.md
│   ├── testing/
│   │   └── test-strategy.md
│   └── infrastructure/
│       ├── deployment-runbook.md
│       └── elk-setup.md
│
├── scripts/
│   ├── setup.sh                      # Initial project setup
│   ├── dev.sh                        # Start dev environment
│   └── deploy.sh                     # Deploy to production
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # pnpm workspace config
├── package.json                      # Root package.json
├── tsconfig.base.json                # Base TypeScript config
├── .eslintrc.js                      # ESLint config
├── .prettierrc                       # Prettier config
├── .commitlintrc.js                  # Commitlint config
├── .husky/                           # Git hooks
├── .env.example                      # Environment variable template
└── .gitignore
```

## Architecture Overview (C4 - Container Level)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            DSVTT System                                   │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │    Next.js        │    │   Express +      │    │   PostgreSQL 16   │  │
│  │    Frontend       │◄──►│   Socket.IO      │◄──►│   (Prisma ORM)   │  │
│  │   (App Router)    │WS  │   Backend        │    │                   │  │
│  │                   │REST│                  │    │  Phase 1:         │  │
│  │  Phase 1:         │    │  Phase 1:        │    │  - users, rooms   │  │
│  │  - react-konva    │    │  - Game engine   │    │  - sessions       │  │
│  │  - Zustand stores │    │  - Event store   │    │  - event_log      │  │
│  │  - shadcn/ui      │    │  - Dice engine   │    │  - maps, tokens   │  │
│  │  - Map/Chat/Dice  │    │  - Turn manager  │    │  - chat, npcs     │  │
│  │                   │    │                  │    │                   │  │
│  │  Phase 2:         │    │  Phase 2:        │    │  Phase 2:         │  │
│  │  - Sheet renderer │    │  - Rule parser   │    │  - game_systems   │  │
│  │  - Ability tabs   │    │  - Constraints   │    │  - abilities      │  │
│  │  - Config editor  │    │  - Ability API   │    │  - char_templates │  │
│  │                   │    │                  │    │  - constraints    │  │
│  │  Phase 3:         │    │  Phase 3:        │    │                   │  │
│  │  - AI Director UI │    │  - AI Director   │    │  Phase 3:         │  │
│  │  - Adventure UI   │    │  - Adventure     │    │  - adventures     │  │
│  │  - Override panel │    │    processor     │    │  - ai_state       │  │
│  │                   │    │  - PDF extractor  │    │  - ai_history     │  │
│  └──────────────────┘    └────────┬─────────┘    └───────────────────┘  │
│                                   │                                      │
│                    ┌──────────────┼──────────────┐                      │
│                    │              │              │                        │
│             ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐                │
│             │ AI Providers │ │  File   │ │  ELK Stack  │                │
│             │  (Phase 3)  │ │ Storage │ │             │                 │
│             │             │ │         │ │ Elasticsearch│                │
│             │ - Claude    │ │ - Maps  │ │ Logstash     │                │
│             │ - GPT       │ │ - PDFs  │ │ Kibana       │                │
│             │ - Ollama    │ │ - Assets│ │              │                │
│             └─────────────┘ └─────────┘ └──────────────┘                │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐                                   │
│  │    Nginx     │    │   Jenkins    │                                    │
│  │  (Reverse    │    │   (CI/CD)    │                                    │
│  │   Proxy+SSL) │    │              │                                    │
│  └──────────────┘    └──────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Socket.IO Event Protocol

```
PHASE 1: Core VTT Events
─────────────────────────
CLIENT -> SERVER                    SERVER -> CLIENT
────────────────                    ────────────────
ROOM_JOIN                           ROOM_JOINED
ROOM_LEAVE                          ROOM_LEFT
ROOM_CREATE                         ROOM_CREATED

GAME_ACTION                         GAME_STATE_UPDATE
GAME_START                          GAME_STARTED
GAME_PAUSE                          GAME_PAUSED

TOKEN_MOVE                          TOKEN_MOVED
TOKEN_ADD                           TOKEN_ADDED
TOKEN_REMOVE                        TOKEN_REMOVED

DICE_ROLL                           DICE_RESULT
DICE_ROLL_PRIVATE                   DICE_RESULT_PRIVATE

CHAT_MESSAGE                        CHAT_MESSAGE_BROADCAST
CHAT_WHISPER                        CHAT_WHISPER_RECEIVED

TURN_END                            TURN_CHANGED
TURN_SKIP                           TURN_ORDER_UPDATED

FOG_UPDATE                          FOG_UPDATED
NPC_ACTION                          NPC_ACTION_BROADCAST

MAP_LOAD                            MAP_LOADED
MAP_UPDATE                          MAP_UPDATED

CHARACTER_UPDATE                    CHARACTER_UPDATED

PHASE 2: Game System Events
────────────────────────────
CONFIG_UPDATE                       CONFIG_UPDATED
CONSTRAINT_VIOLATION                CONSTRAINT_VIOLATION_NOTICE
ABILITY_USE                         ABILITY_USED
ACTION_VALIDATE                     ACTION_VALIDATION_RESULT

PHASE 3: AI Director Events
─────────────────────────────
AI_DIRECTOR_START                   AI_DIRECTOR_STARTED
AI_DIRECTOR_STOP                    AI_DIRECTOR_STOPPED
                                    AI_ACTION_PROPOSED
AI_ACTION_APPROVE                   AI_ACTION_EXECUTED
AI_ACTION_REJECT                    AI_ACTION_REJECTED
AI_ACTION_MODIFY                    AI_ACTION_MODIFIED
                                    AI_STREAM_START
                                    AI_STREAM_CHUNK
                                    AI_STREAM_END
                                    AI_NARRATION
                                    AI_NPC_DIALOGUE
AI_OVERRIDE_TAKE                    AI_OVERRIDE_HUMAN
AI_OVERRIDE_RETURN                  AI_OVERRIDE_AI
```

## Event Sourcing Model

```
GameEvent {
  id: UUID
  sessionId: UUID
  sequenceNumber: number      # Monotonically increasing per session
  eventType: string           # Discriminated union key
  payload: JSON               # Event-specific data
  actorId: UUID               # User or AI who triggered the event
  actorType: "director" | "player" | "ai" | "system"
  timestamp: DateTime
  metadata: JSON              # Additional context (IP, client version)
}

# State is reconstructed by replaying events in sequence order
# Snapshots taken every N events for performance
```
