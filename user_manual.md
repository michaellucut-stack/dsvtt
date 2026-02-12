# VTT Forge -- User Manual

VTT Forge is a web-based virtual tabletop for playing tabletop RPGs online. One user acts as the **Director** (game master) and the others join as **Players**. Everything happens in real time -- map changes, dice rolls, chat messages, and token movements are instantly visible to everyone in the session.

This manual covers every feature from both the Director and Player perspectives.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Creating an Account](#11-creating-an-account)
   - [Signing In](#12-signing-in)
   - [Logging Out](#13-logging-out)
2. [The Lobby](#2-the-lobby)
   - [Browsing Rooms](#21-browsing-rooms)
   - [Creating a Room (Director)](#22-creating-a-room-director)
   - [Joining a Room (Player)](#23-joining-a-room-player)
   - [The Room Detail Page](#24-the-room-detail-page)
   - [Leaving a Room](#25-leaving-a-room)
3. [Starting a Game Session](#3-starting-a-game-session)
   - [Uploading a Battle Map](#31-uploading-a-battle-map)
   - [Starting the Game (Director)](#32-starting-the-game-director)
   - [Entering the Game (Player)](#33-entering-the-game-player)
4. [The Game Room](#4-the-game-room)
   - [Screen Layout](#41-screen-layout)
   - [Top Bar](#42-top-bar)
   - [Sidebar Tabs](#43-sidebar-tabs)
5. [The Map](#5-the-map)
   - [Navigating the Map](#51-navigating-the-map)
   - [Grid Settings (Director)](#52-grid-settings-director)
   - [Grid Toggle (Player)](#53-grid-toggle-player)
   - [Zoom Controls](#54-zoom-controls)
6. [Tokens](#6-tokens)
   - [Adding Tokens (Director)](#61-adding-tokens-director)
   - [Selecting Tokens](#62-selecting-tokens)
   - [Moving Tokens (Director)](#63-moving-tokens-director)
   - [Token Context Menu (Director)](#64-token-context-menu-director)
   - [Token Detail Panel (Director)](#65-token-detail-panel-director)
   - [Deleting Tokens (Director)](#66-deleting-tokens-director)
7. [Fog of War (Director)](#7-fog-of-war-director)
8. [Chat](#8-chat)
   - [Chat Channels](#81-chat-channels)
   - [Sending Messages](#82-sending-messages)
   - [Whispers](#83-whispers)
   - [Message Types](#84-message-types)
9. [Dice Roller](#9-dice-roller)
   - [Quick Roll Buttons](#91-quick-roll-buttons)
   - [Custom Formulas](#92-custom-formulas)
   - [Private Rolls](#93-private-rolls)
   - [Roll History](#94-roll-history)
10. [Character Sheets (Player)](#10-character-sheets-player)
    - [Creating a Character](#101-creating-a-character)
    - [Editing Your Character](#102-editing-your-character)
    - [Stats](#103-stats)
    - [Notes](#104-notes)
    - [Inventory](#105-inventory)
11. [Turn Tracker](#11-turn-tracker)
    - [How Turns Work](#111-how-turns-work)
    - [Director Controls](#112-director-controls)
12. [Shared Notes](#12-shared-notes)
    - [Creating Notes](#121-creating-notes)
    - [Editing Notes](#122-editing-notes)
    - [Deleting Notes (Director)](#123-deleting-notes-director)
13. [Director Panel](#13-director-panel)
    - [NPCs](#131-npcs)
    - [World Events](#132-world-events)
    - [Secret Notes](#133-secret-notes)
14. [Session Management](#14-session-management)
    - [Pausing and Resuming (Director)](#141-pausing-and-resuming-director)
    - [Ending a Session (Director)](#142-ending-a-session-director)
    - [Leaving a Session (Player)](#143-leaving-a-session-player)
15. [Search](#15-search)
16. [Connection Status](#16-connection-status)
17. [Quick Reference](#17-quick-reference)
    - [Director Capabilities](#171-director-capabilities)
    - [Player Capabilities](#172-player-capabilities)

---

## 1. Getting Started

### 1.1 Creating an Account

1. Open VTT Forge in your browser. The homepage shows two buttons: **Sign In** and **Create Account**.
2. Click **Create Account** to go to the registration page.
3. Fill in the form:

   | Field                | What to Enter                             |
   | -------------------- | ----------------------------------------- |
   | **Display Name**     | Your in-game name (at least 2 characters) |
   | **Email**            | A valid email address                     |
   | **Password**         | At least 8 characters                     |
   | **Confirm Password** | Re-enter your password exactly            |

4. Click **Create Account**.
5. On success you will be redirected to the Sign In page.

### 1.2 Signing In

1. On the Sign In page, enter your **Email** and **Password**.
2. Click **Sign In**.
3. On success you are redirected to the **Lobby**.

Your session is saved in your browser. You will remain signed in until you explicitly log out, even if you close the tab.

### 1.3 Logging Out

Click the **Logout** button in the top-right corner of the Lobby navigation bar. You will be returned to the Sign In page.

---

## 2. The Lobby

The Lobby is your home screen. It shows all available game rooms and lets you create new ones.

### 2.1 Browsing Rooms

The Lobby displays a grid of room cards. Each card shows:

- **Room name**
- **Status badge** -- the current state of the room:
  - **Waiting** (yellow) -- the room is open and accepting players.
  - **In Progress** (green) -- a game session is active.
  - **Paused** (blue) -- the session is paused by the Director.
  - **Ended** (gray) -- the session has concluded.
- **Player count** -- e.g. "3/6" (current players / maximum capacity).
- **Director name** -- who created and runs the room.

Click any room card to open its detail page.

### 2.2 Creating a Room (Director)

1. Click the **Create Room** button in the top-right corner of the Lobby.
2. A dialog appears with two fields:

   | Field           | Description                              | Limits            |
   | --------------- | ---------------------------------------- | ----------------- |
   | **Room Name**   | Give your adventure a name               | 1--64 characters  |
   | **Max Players** | How many people can join (including you) | 1--8 (default: 4) |

3. Click **Create Room**.
4. You are automatically redirected to the new room's detail page. You are the Director.

### 2.3 Joining a Room (Player)

1. In the Lobby, click the room card you want to join.
2. On the room detail page, click **Join as Player**.
3. You can join a room only when:
   - The room status is **Waiting**.
   - The room is not full.
   - You are not already a member.

### 2.4 The Room Detail Page

This page shows full information about a room:

- **Room name and status badge** at the top.
- **Player count** (e.g. "3/6 players").
- **Action buttons** (see table below).
- **Player list** showing every member with their role (Director or Player) and an online indicator.

| Button             | Visible To    | When                                      |
| ------------------ | ------------- | ----------------------------------------- |
| **Join as Player** | Non-members   | Room is Waiting and not full              |
| **Start Game**     | Director only | Room is Waiting and has at least 1 player |
| **Leave Room**     | All members   | Always (redirects to Lobby)               |

### 2.5 Leaving a Room

Click **Leave Room** on the room detail page. You will be removed from the player list and returned to the Lobby.

If the Director leaves, the room status changes to **Ended**.

---

## 3. Starting a Game Session

### 3.1 Uploading a Battle Map

Before starting the game, the Director can optionally upload a battle map image:

1. On the room detail page (while the room is in **Waiting** status), a **Battle Map** section appears below the room header.
2. Click the file picker and select a JPG or PNG image.
3. The selected file name appears in the picker. Click **Remove** to clear it.

The map upload is optional. You can start a game without a map and add one later.

### 3.2 Starting the Game (Director)

1. Make sure at least one player has joined.
2. Click **Start Game**.
3. If you selected a map image, it will be uploaded and configured with a default 20-column by 15-row grid.
4. You are redirected to the Game Room.

### 3.3 Entering the Game (Player)

When the Director starts the game, all players on the room detail page are **automatically redirected** to the Game Room. No action is needed -- just wait on the room detail page.

---

## 4. The Game Room

### 4.1 Screen Layout

The Game Room fills your entire browser window and is divided into:

```
+================================================================+
|  TOP BAR (room name, status, controls)                         |
+================================================================+
|  TURN TRACKER BAR (visible during combat)                      |
+----------------------------------+-----------------------------+
|                                  |                             |
|         MAP CANVAS               |        SIDEBAR              |
|    (interactive battle map)      |    (chat, dice, party,      |
|                                  |     notes, DM panel)        |
|                                  |                             |
+----------------------------------+-----------------------------+
```

- The **sidebar** is resizable by dragging the vertical handle between the map and sidebar.
- The sidebar can be collapsed entirely using the toggle button in the top bar.

### 4.2 Top Bar

The top bar contains (left to right):

- **Room name** and **status badge** (active/paused).
- **Director badge** -- shown only to the Director.
- **Search** (magnifying glass icon, shortcut: `Ctrl+K`) -- search across chat, notes, and characters.
- **Connection indicator** -- green dot when connected, red when reconnecting.
- **End Session** (Director) or **Leave** (Player) button.
- **Sidebar toggle** button.

### 4.3 Sidebar Tabs

The sidebar has five tabs along the top:

| Tab   | Label            | Available To  | Purpose                                    |
| ----- | ---------------- | ------------- | ------------------------------------------ |
| CHAT  | Chat bubble icon | Everyone      | Real-time chat with IC/OOC channels        |
| DICE  | Die icon         | Everyone      | Dice roller with formula input and history |
| PARTY | Person icon      | Everyone      | Character sheet creation and editing       |
| NOTES | Document icon    | Everyone      | Shared collaborative notes                 |
| DM    | Star icon        | Director only | NPC management, world events, secret notes |

---

## 5. The Map

The map is a zoomable, pannable canvas that displays the battle map background, a grid overlay, tokens, and fog of war.

### 5.1 Navigating the Map

- **Pan**: Click and drag on empty space to move the map around. You can also select the Pan tool (hand icon) from the toolbar.
- **Zoom**: Scroll the mouse wheel to zoom in and out (10% to 500%). The zoom centers on your cursor position.

### 5.2 Grid Settings (Director)

The Director controls the grid dimensions:

1. Click the **Grid Settings** button (grid icon) in the map toolbar.
2. A dropdown appears with two number fields:
   - **Columns** (1--200)
   - **Rows** (1--200)
3. Click **Update** to apply the new grid.

Grid changes are saved to the server and broadcast to all players in real time. The grid dimensions persist across sessions.

If the grid is hidden, the button label changes to **Show Grid** and applies the dimensions while also making the grid visible.

### 5.3 Grid Toggle (Player)

Players see a simpler grid button that toggles grid visibility on and off. Players cannot change grid dimensions.

### 5.4 Zoom Controls

The floating toolbar at the top-left of the map includes zoom controls:

| Control                         | Action                                 |
| ------------------------------- | -------------------------------------- |
| **-** (minus)                   | Zoom out                               |
| **Percentage display**          | Shows current zoom level (e.g. "100%") |
| **+** (plus)                    | Zoom in                                |
| **Fit to Screen** (expand icon) | Reset zoom and position to default     |

---

## 6. Tokens

Tokens represent characters, NPCs, and objects on the map. They appear as colored circles with the token name's initials inside. Each token's color is deterministically generated from its name so the same name always produces the same color.

### 6.1 Adding Tokens (Director)

1. Click the **Add Token** button (plus-circle icon) in the map toolbar.
2. Enter a name in the text field (e.g. "Goblin Scout").
3. Click **Place**.
4. The token appears at the top-left corner of the grid (column 0, row 0).
5. Use the context menu or click-to-move to reposition it.

### 6.2 Selecting Tokens

Click a token to select it. The selected token is highlighted. Click empty space to deselect.

### 6.3 Moving Tokens (Director)

There are two ways to move a token:

**Click-to-Move:**

1. Right-click a token and choose **Move** from the context menu.
2. The cursor changes to a crosshair and a banner appears: "Click a cell to move token -- Cancel".
3. Click the destination grid cell.
4. The token snaps to that cell.
5. Press **Escape** or click **Cancel** to abort.

**Direct Drag:** Tokens can also be repositioned through the token detail panel by viewing the current coordinates.

### 6.4 Token Context Menu (Director)

Right-click any token to open a context menu with:

| Option           | Action                                   |
| ---------------- | ---------------------------------------- |
| **View Details** | Opens the token detail panel             |
| **Edit**         | Opens the token detail panel for editing |
| **Move**         | Enters click-to-move mode                |
| **Delete**       | Removes the token from the map           |

The context menu shows the token name and its current layer.

### 6.5 Token Detail Panel (Director)

The detail panel appears as a floating card over the top-right corner of the map. It shows:

| Field        | Description                                | Editable       |
| ------------ | ------------------------------------------ | -------------- |
| **Name**     | Token display name                         | Yes            |
| **Position** | Column and Row (grid coordinates)          | Read-only      |
| **Layer**    | One of: Token, Background, Effect, GM Only | Yes (dropdown) |
| **Visible**  | Whether players can see this token         | Yes (checkbox) |

The panel also has **Save**, **Move**, and **Delete** buttons.

### 6.6 Deleting Tokens (Director)

Delete a token from either:

- The context menu (right-click > **Delete**).
- The detail panel (**Delete** button).

Deleted tokens are removed for all players in real time.

---

## 7. Fog of War (Director)

Fog of war obscures portions of the map from players. The Director can reveal or hide fog regions during play.

**How it looks:**

| Viewer       | Unrevealed Region                               | Revealed Region                        |
| ------------ | ----------------------------------------------- | -------------------------------------- |
| **Director** | Semi-transparent dark overlay with a red border | Faint green tint with a green border   |
| **Player**   | Solid black (completely obscured)               | Fully transparent (normal map visible) |

**Toggling fog regions:**

1. Select the **Fog of War** tool (cloud icon) from the toolbar. This tool is only visible to the Director.
2. Click any fog region on the map to toggle it between revealed and unrevealed.
3. The change is instantly broadcast to all players.

Players cannot interact with fog in any way.

> **Note:** Fog regions must be pre-defined when the map is created. The current version does not support drawing new fog polygons during a session.

---

## 8. Chat

The Chat tab provides real-time messaging between all session participants.

### 8.1 Chat Channels

Two channel tabs appear at the top of the chat panel:

| Channel                    | Purpose                                | Text Style                     |
| -------------------------- | -------------------------------------- | ------------------------------ |
| **In Character** (IC)      | Dialogue and in-character actions      | Italic, leather-themed styling |
| **OOC** (Out of Character) | Table talk, rules questions, logistics | Normal text                    |

System messages and whispers appear in both channels regardless of which is selected.

### 8.2 Sending Messages

1. Select a channel tab (**In Character** or **OOC**).
2. Type your message in the input field at the bottom.
3. Press **Enter** or click the send button (arrow icon).

The placeholder text changes to reflect your current mode:

- _"Speak in character..."_ (IC channel)
- _"Type a message..."_ (OOC channel)
- _"Whisper to [name]..."_ (whisper mode)

### 8.3 Whispers

Whispers are private messages visible only to you and one other player.

1. Click on a player's name in a chat message to set them as the whisper target.
2. A purple indicator bar appears above the input: _"Whispering to [name]"_.
3. Type and send your message. It will only be seen by you and the target player.
4. Click **Cancel** on the whisper bar to return to normal chat.

Whisper messages appear with a purple border and a lock icon.

### 8.4 Message Types

| Type                 | Appearance                                                           |
| -------------------- | -------------------------------------------------------------------- |
| **In Character**     | Leather-themed card, sender name in heading font, message in italics |
| **Out of Character** | Plain style with sender name and message                             |
| **System**           | Centered, small italic gray text (no sender name)                    |
| **Whisper**          | Purple-tinted card with lock icon, shows "whisper to/from [name]"    |
| **Dice Roll**        | Gold-themed card with die icon, formula and result in monospace      |

All messages show a timestamp on hover.

---

## 9. Dice Roller

The Dice tab provides tools for rolling dice with full formula support.

### 9.1 Quick Roll Buttons

Seven common dice are available as one-click buttons:

| Button   | Roll  |
| -------- | ----- |
| **d4**   | 1d4   |
| **d6**   | 1d6   |
| **d8**   | 1d8   |
| **d10**  | 1d10  |
| **d12**  | 1d12  |
| **d20**  | 1d20  |
| **d100** | 1d100 |

Click any button to roll immediately. The result appears in the roll history below and is broadcast to all players.

### 9.2 Custom Formulas

For more complex rolls:

1. Type a formula in the input field (e.g. `2d6+3`, `4d6kh3`, `1d20+5`).
2. Click **Roll** or press Enter.

The dice engine supports:

- Standard notation: `NdS` (e.g. `2d6`, `1d20`)
- Arithmetic modifiers: `+` and `-` (e.g. `2d6+3`)
- Keep/drop mechanics (e.g. roll 4d6, keep highest 3)
- Exploding dice (re-roll on max value)

### 9.3 Private Rolls

Check the **"Private roll (Director only)"** checkbox before rolling. Private rolls are only visible to you and the Director. They appear with a lock icon and purple-tinted card in the history.

### 9.4 Roll History

All rolls appear in the history panel (most recent first, up to 50 entries). Each entry shows:

- **Who rolled** and when.
- **Formula** and individual die results (e.g. `2d6+3 [4, 2]`).
- **Dropped dice** shown with strikethrough. **Exploded dice** marked with `!`.
- **Total** in large gold text.

---

## 10. Character Sheets (Player)

The Party tab is where players create and manage their characters.

### 10.1 Creating a Character

If you don't have a character yet, the Party tab shows a creation form:

1. Enter your **character name**.
2. Click **Create Character**.
3. Your character sheet opens in edit mode.

Each player has one character per session. The Director can view all characters.

### 10.2 Editing Your Character

The character sheet is divided into four sections. All changes **auto-save** after 1 second of inactivity -- there is no manual save button.

### 10.3 Stats

The **Abilities & Stats** section holds freeform key-value pairs:

1. Click **Add Stat** to add a new row.
2. Enter a stat name (e.g. "Strength") and a value (e.g. "18").
3. Hover over a stat row and click the **X** button to delete it.

Stats are stored as a dictionary -- each stat name must be unique.

### 10.4 Notes

A free-text area for backstory, goals, and session notes. Write anything you like.

### 10.5 Inventory

The **Inventory** section tracks items:

1. Click **Add Item** to add a new row.
2. Enter an **item name** and an optional **description**.
3. Hover and click **X** to remove an item.

---

## 11. Turn Tracker

The turn tracker appears as a horizontal bar between the top bar and the map when combat is active.

### 11.1 How Turns Work

The turn tracker displays:

- **Round number** -- the current combat round.
- **Active combatant** -- whose turn it is (gold for players, red for NPCs).
- **Turn order chips** -- a scrollable row of all combatants in initiative order. The current combatant's chip has a gold border and glow.

Each chip shows the combatant's **initiative number** and **name**.

### 11.2 Director Controls

The Director sees two additional buttons on the right side of the turn tracker:

| Button        | Action                            |
| ------------- | --------------------------------- |
| **Skip**      | Skip the current combatant's turn |
| **Next Turn** | Advance to the next combatant     |

When all combatants have acted, the round number increments and the tracker cycles back to the first combatant.

---

## 12. Shared Notes

The Notes tab provides a collaborative notepad visible to all session members.

### 12.1 Creating Notes

1. Click the **New Note** button (gold, with plus icon).
2. A new untitled note is created and selected for editing.

### 12.2 Editing Notes

The notes panel has two columns:

- **Left column** -- a scrollable list of all notes. Click any note to select it.
- **Right column** -- the editor for the selected note with:
  - An editable **title** field.
  - A **content** text area (placeholder: _"Start writing..."_).
  - A footer showing who last edited the note and when.

Changes **auto-save** after 1.5 seconds of inactivity. Edits by other players appear in real time.

### 12.3 Deleting Notes (Director)

Only the Director can delete notes. A red **Delete** link appears in the note editor footer for the Director.

---

## 13. Director Panel

The **DM** tab in the sidebar is exclusive to the Director. It contains three sub-tabs: **NPCs**, **Events**, and **Secrets**.

### 13.1 NPCs

Manage non-player characters for the session.

**Creating an NPC:**

1. Click **Add NPC**.
2. Fill in the inline form:
   - **NPC Name** (required)
   - **Stats** -- click **+ Add** to add key-value stat rows (e.g. "HP: 45", "AC: 16").
   - **Notes** -- free text for behavior, tactics, personality.
3. Click **Create NPC**.

**Editing an NPC:**

Click any NPC card to expand it. The expanded view shows editable fields for name, stats, and notes. Click **Save** to persist changes.

**Assigning an NPC to a Map Token:**

Inside the expanded NPC editor, use the **"Assign to Token"** dropdown to link the NPC to a token currently on the map. This associates the NPC data with a visual token on the battlefield.

**Deleting an NPC:**

Click the red **Delete** button inside the expanded NPC editor.

### 13.2 World Events

Tools for narrating and controlling the flow of the game:

| Control            | Action                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Roll d20**       | Immediately rolls a public 1d20 (the result is visible to all players)                                                                      |
| **Pause / Resume** | Toggles the game session between active and paused. Sends a system message to all players (e.g. _"The Director has paused the game."_)      |
| **Narrate Event**  | Type a narration in the text area and click **Send as Narration**. The text appears as a system message in the chat visible to all players. |

### 13.3 Secret Notes

Private notes visible only to the Director.

1. Click **New** to create a secret note.
2. Enter a **title** and **content**.
3. Click **Save**.

Secret notes are never shown to players. Use them for plot twists, hidden monster stats, encounter plans, or anything you want to keep hidden.

---

## 14. Session Management

### 14.1 Pausing and Resuming (Director)

The Director can pause and resume the session from the **Events** sub-tab of the DM panel:

- Click **Pause** to pause the game. A system message is broadcast: _"The Director has paused the game."_
- Click **Resume** to continue. A system message is broadcast: _"The Director has resumed the game."_

The room status badge in the top bar updates accordingly.

### 14.2 Ending a Session (Director)

1. Click the red **End Session** button in the top bar.
2. The session ends and you are redirected to the Lobby.
3. The room status returns to **Waiting**, allowing you to start a new session later.

### 14.3 Leaving a Session (Player)

1. Click the **Leave** button in the top bar.
2. You are removed from the room and returned to the Lobby.

---

## 15. Search

The search feature lets you find content across chat messages, notes, and characters.

1. Click the **search icon** in the top bar, or press **Ctrl+K** (Cmd+K on Mac).
2. Type your search query.
3. Results appear in a dropdown grouped by type.
4. Filter results using the toggle chips: **Chat**, **Note**, **Character**.
5. Click a result to navigate to it.
6. Press **Escape** to close the search.

---

## 16. Connection Status

A small colored dot in the top bar indicates your connection status:

| Indicator             | Meaning                                               |
| --------------------- | ----------------------------------------------------- |
| Green dot (with glow) | Connected -- real-time updates are active             |
| Red dot               | Disconnected -- attempting to reconnect automatically |

The connection uses WebSocket with automatic reconnection. If disconnected, the client retries with exponential backoff (1 second initial delay, up to 30 seconds between retries) with unlimited retry attempts.

---

## 17. Quick Reference

### 17.1 Director Capabilities

| Feature                               | Details                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| Create rooms                          | Set name and max players (1--8)                             |
| Upload battle maps                    | JPG/PNG, before starting the game                           |
| Start / Pause / Resume / End sessions | Full session lifecycle control                              |
| Configure grid                        | Set columns and rows (1--200 each); persisted and broadcast |
| Add tokens                            | Place named tokens on the map                               |
| Move tokens                           | Right-click > Move, then click destination cell             |
| Edit tokens                           | Change name, layer, visibility via detail panel             |
| Delete tokens                         | Right-click > Delete, or via detail panel                   |
| Toggle fog of war                     | Click fog regions to reveal/hide for players                |
| Manage NPCs                           | Create, edit, delete, assign to map tokens                  |
| Control turn tracker                  | Skip turns, advance to next turn                            |
| Send narrations                       | Write text that appears as a system message to all          |
| Roll public d20                       | One-click quick roll from the Events panel                  |
| Secret notes                          | Private notes hidden from players                           |
| Delete shared notes                   | Only the Director can delete shared notes                   |
| Whisper                               | Send private messages to individual players                 |
| View all characters                   | See every player's character sheet                          |
| End session                           | Returns room to Waiting status                              |

### 17.2 Player Capabilities

| Feature                 | Details                                                |
| ----------------------- | ------------------------------------------------------ |
| Join rooms              | Join any Waiting room that isn't full                  |
| Create & edit character | Name, stats, notes, inventory (auto-saves)             |
| Chat (IC & OOC)         | In Character and Out of Character channels             |
| Whisper                 | Private messages to other players                      |
| Roll dice               | Quick rolls (d4--d100), custom formulas, private rolls |
| Toggle grid             | Show/hide grid overlay (cannot change dimensions)      |
| Pan & zoom the map      | Scroll to zoom, drag to pan                            |
| View shared notes       | Read and edit collaborative notes                      |
| View turn tracker       | See initiative order and whose turn it is              |
| Search                  | Search chat, notes, and characters                     |
| Leave session           | Return to the Lobby at any time                        |
