# DSVTT - Agent Interaction & Handoff Protocol

## Agent Roster Quick Reference

| ID               | Name     | Role                  | Track          | Model            | Personality Trait        |
|------------------|----------|-----------------------|----------------|------------------|--------------------------|
| product_manager  | Sage     | Product Manager       | Coordination   | **Opus 4.6**     | Strategic, user-focused  |
| tech_lead        | Arch     | Tech Lead / Architect | Coordination   | **Opus 4.6**     | Big-picture, pragmatic   |
| ui_designer      | Pixel    | UI/UX Designer        | Frontend       | Sonnet 4.5       | Creative, accessibility  |
| frontend_dev     | React    | Frontend Developer    | Frontend       | Sonnet 4.5       | Pragmatic, perf-obsessed |
| backend_dev      | Forge    | Backend Developer     | Backend        | Sonnet 4.5       | Systems thinker, precise |
| db_architect     | Schema   | Database Architect    | Backend        | **Opus 4.6**     | Data purist, ERD lover   |
| devops_engineer  | Harbor   | DevOps Engineer       | Infrastructure | Sonnet 4.5       | Calm, automate-everything|
| security_engineer| Sentinel | Security Engineer     | Infrastructure | Sonnet 4.5       | Watchful, threat-modeler |
| qa_engineer      | Vigil    | QA / Test Engineer    | Quality        | Sonnet 4.5       | Meticulous, edge-case hunter |
| *documentation*  | *any*    | *Documentation tasks* | *all*          | **Haiku 4.5**    | *All doc output from any agent* |

## Model Assignment Strategy

### Three-Tier Model Architecture

```
┌─────────────────────────────────────────────────────────┐
│  OPUS 4.6 (Premium Reasoning)                           │
│  Arch, Sage, Schema                                     │
│                                                         │
│  Used for: Architecture decisions, data modeling,       │
│  complex planning, TTRPG rule analysis, cross-system    │
│  design, conflict resolution, sprint planning           │
├─────────────────────────────────────────────────────────┤
│  SONNET 4.5 (Implementation)                            │
│  Pixel, React, Forge, Harbor, Sentinel, Vigil           │
│                                                         │
│  Used for: Writing code, UI components, API handlers,   │
│  Dockerfiles, Jenkinsfiles, test suites, security       │
│  middleware, Socket.IO events, canvas rendering          │
├─────────────────────────────────────────────────────────┤
│  HAIKU 4.5 (Documentation)                              │
│  Any agent's documentation output                       │
│                                                         │
│  Used for: ADRs, OpenAPI specs, JSDoc, README, user     │
│  stories, test plans, runbooks, data dictionaries,      │
│  sprint reports, PR descriptions, changelogs,           │
│  acceptance criteria, commit messages, inline comments   │
└─────────────────────────────────────────────────────────┘
```

### Routing Rule

When a task is received:
1. **Is it documentation?** -> Route to Haiku 4.5 (regardless of agent)
2. **Is the agent Arch, Sage, or Schema?** -> Route to Opus 4.6
3. **Otherwise** -> Route to Sonnet 4.5

### Escalation

Sonnet agents can escalate to Opus via Arch when they encounter:
- Cross-system architectural questions
- Complex state machine design decisions
- Performance tradeoffs requiring system-wide analysis
- Conflicting requirements between tracks

---

## Communication Protocol

### How Agents Communicate

Each agent communicates via structured handoff documents. When an agent completes work that another agent depends on, they produce a **Handoff Artifact** with the following structure:

```markdown
## Handoff: {Source Agent} -> {Target Agent(s)}

**Date:** YYYY-MM-DD
**Sprint:** {N}
**Status:** Ready for Review | Ready for Implementation | Needs Discussion

### What Was Done
Brief description of completed work.

### Artifacts Produced
- List of files created or modified
- Links to relevant specs/docs

### What's Needed Next
Specific ask for the receiving agent.

### Dependencies / Blockers
Any unresolved issues that may affect the next step.

### Notes
Additional context, edge cases discovered, or open questions.
```

---

## Interaction Matrix

This matrix defines who interacts with whom and why:

```
            Sage  Arch  Pixel React Forge Schema Harbor Sentinel Vigil
Sage         -     H     H    L     L     L      L      L       H
Arch         H     -     M    H     H     H      H      H       M
Pixel        H     M     -    H     L     -      -      -       L
React        L     H     H    -     H     -      L      -       M
Forge        L     H     L    H     -     H      M      H       M
Schema       L     H     -    -     H     -      L      M       L
Harbor       L     H     -    L     M     L      -      H       M
Sentinel     L     H     -    -     H     M      H      -       M
Vigil        H     M     L    M     M     L      M      M       -

H = High interaction (frequent handoffs)
M = Medium interaction (periodic sync)
L = Low interaction (as needed)
-  = No direct interaction
```

---

## Handoff Flows (Key Workflows)

### 1. Feature Development Flow

```
Sage (PM)                    Define user story + acceptance criteria
    │
    ▼
Arch (Tech Lead)             Technical design + ADR (if needed)
    │
    ├──────────────────┐
    ▼                  ▼
Pixel (Design)         Schema (DB)          Design UI        Design schema
    │                  │
    ▼                  ▼
React (Frontend)       Forge (Backend)      Implement UI     Implement API
    │                  │
    └──────┬───────────┘
           ▼
    Vigil (QA)                               Write tests
           │
           ▼
    Sentinel (Security)                      Security review
           │
           ▼
    Harbor (DevOps)                          Deploy to staging
           │
           ▼
    Sage (PM)                                Acceptance verification
```

### 2. API Contract Flow

```
Arch defines Socket.IO event schema in packages/events/
    │
    ├──► Forge implements server-side handler
    │
    └──► React implements client-side handler
    
Both reference the same type definitions from packages/events/
Vigil writes integration tests that verify both sides
```

### 3. Security Review Flow

```
Any agent writes code touching:
  - Authentication / Authorization
  - User input handling
  - WebSocket connections
  - AI prompt construction
  - File uploads
  - Database queries
    │
    ▼
Sentinel reviews before merge
    │
    ├── Approved ──► Merge
    │
    └── Issues found ──► Return to author with security notes
```

### 4. Database Change Flow

```
Feature requires new data
    │
    ▼
Schema designs Prisma schema changes
    │
    ▼
Arch reviews for architectural fit
    │
    ▼
Schema creates migration
    │
    ▼
Forge implements API/service changes
    │
    ▼
Vigil updates test fixtures/factories
    │
    ▼
Harbor ensures migration runs in CI pipeline
```

---

## Conflict Resolution Protocol

When agents disagree on approach:

1. **Level 1 - Track Level:** Agents within the same track discuss and resolve
2. **Level 2 - Arch Mediates:** If track-level fails, Arch (Tech Lead) mediates
3. **Level 3 - ADR:** If the decision is significant, Arch writes an ADR documenting the tradeoffs and final decision
4. **Level 4 - User Decision:** For product/business decisions, Sage escalates to the user

### Decision Authority

| Decision Type               | Authority    | Consulted     |
|-----------------------------|-------------|---------------|
| Product features/priority   | Sage (PM)   | User, Arch    |
| Architecture/tech decisions | Arch        | Forge, Schema |
| UI/UX decisions             | Pixel       | Sage, React   |
| Database schema             | Schema      | Arch, Forge   |
| Security policy             | Sentinel    | Arch, Harbor  |
| Infrastructure/deployment   | Harbor      | Arch, Sentinel|
| Test strategy               | Vigil       | Arch, all     |
| API contract design         | Arch + Forge| React         |
| Code style/conventions      | Arch        | All           |

---

## Agent Invocation Guide

### How to Invoke an Agent

When working with the team, invoke an agent by referencing their name and role. Each agent should stay in character and apply their expertise:

```
@Sage - Define user stories, prioritize backlog, verify acceptance criteria
@Arch - Make architecture decisions, review cross-cutting concerns, write ADRs
@Pixel - Design UI components, define user flows, create Tailwind themes
@React - Implement frontend, build components, integrate Socket.IO client
@Forge - Build APIs, game engine, AI integration, Socket.IO server
@Schema - Design database, write migrations, optimize queries
@Harbor - Docker, Jenkins, ELK, deployment, infrastructure
@Sentinel - Security audit, auth review, vulnerability assessment
@Vigil - Write tests, define test strategy, verify quality
```

### Multi-Agent Tasks

Some tasks require multiple agents working together:

| Task                        | Primary    | Supporting            |
|-----------------------------|-----------|------------------------|
| New game feature            | Sage + Arch| Pixel, React, Forge   |
| Real-time event system      | Forge     | Arch, React, Vigil     |
| Database migration          | Schema    | Forge, Vigil, Harbor   |
| Security hardening          | Sentinel  | Forge, Harbor          |
| Performance optimization    | Arch      | React, Forge, Vigil    |
| CI/CD pipeline update       | Harbor    | Vigil, Sentinel        |
| AI integration feature      | Forge     | Arch, React, Sentinel  |
| Config schema from rules    | Forge     | Sage, Schema           |

---

## Sprint Boundary Protocol

At each sprint boundary (every 2 weeks):

### End of Sprint
1. Each track produces a **Sprint Track Report**:
   - What was completed
   - What was deferred (and why)
   - Blockers encountered
   - Cross-track dependencies resolved/unresolved

2. **Vigil** produces a **Quality Report**:
   - Test coverage metrics
   - Bugs found and fixed
   - Open bugs with severity
   - E2E test pass rate

3. **Sage** produces a **Sprint Review Summary**:
   - Sprint goal: met / partially met / missed
   - Velocity achieved
   - User story completion rate
   - Updated backlog priorities

### Start of Next Sprint
1. **Sage** presents sprint goal and prioritized stories
2. **Arch** identifies cross-track dependencies and technical risks
3. Each track commits to deliverables
4. **Vigil** defines test milestones for the sprint
5. All agents update their track backlogs

---

## Escalation Path

```
Individual Agent Issue
    │
    ▼
Track Lead (Arch for Backend/Infra, React for Frontend)
    │
    ▼
Arch (Tech Lead) - Technical escalation
    │
    ▼
Sage (PM) - Product/priority escalation
    │
    ▼
User - Final authority on all decisions
```
