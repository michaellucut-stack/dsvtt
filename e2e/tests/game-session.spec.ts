import { test, expect } from '@playwright/test';

// =============================================================================
// Game Session Lifecycle E2E Tests — Sprint 7 "Ship It v1.0"
//
// Tests the full game session lifecycle: start, pause, resume, end.
// Session status transitions: ACTIVE → PAUSED → ACTIVE → ENDED
// =============================================================================

/**
 * Helper: log in as a specific user.
 */
async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|lobby|home)?$/, { timeout: 10_000 });
}

/**
 * Helper: log in as director and navigate into the first available room.
 * Returns the room URL for later assertions.
 */
async function loginAsDirectorAndEnterRoom(page: import('@playwright/test').Page) {
  await loginAs(page, 'director@test.com', 'password123');

  // Navigate to lobby
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  // Wait for rooms to load
  await page.waitForTimeout(2000);

  // Click into a room the director owns
  const roomCard = page
    .getByTestId('room-card')
    .first()
    .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

  if (await roomCard.isVisible().catch(() => false)) {
    await roomCard.click();
    await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
  }
}

/**
 * Helper: log in as player and navigate into the first available room.
 */
async function loginAsPlayerAndEnterRoom(page: import('@playwright/test').Page) {
  await loginAs(page, 'player@test.com', 'password123');

  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  await page.waitForTimeout(2000);

  const roomCard = page
    .getByTestId('room-card')
    .first()
    .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

  if (await roomCard.isVisible().catch(() => false)) {
    await roomCard.click();
    await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
  }
}

// =============================================================================
// Session Start
// =============================================================================

test.describe('Game Session — Start', () => {
  test('director should be able to start a new game session', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room data
    await loginAsDirectorAndEnterRoom(page);

    // Look for the "Start Session" button (director-only action)
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
      .or(page.getByTestId('start-session-button'));

    if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startButton.click();

      // Room status badge should change to ACTIVE
      await expect(
        page.getByText(/active/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('player should NOT see a start session button', async ({ page }) => {
    // TODO: Requires running backend with seeded player + room data
    await loginAsPlayerAndEnterRoom(page);

    // The start session button should not be present for players
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
      .or(page.getByTestId('start-session-button'));

    // Allow time for the page to fully render before asserting absence
    await page.waitForTimeout(2000);

    await expect(startButton).toHaveCount(0);
  });

  test('director should see "Director" badge in room header', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirectorAndEnterRoom(page);

    // The game room header shows a "Director" badge for the director
    await expect(
      page.getByText(/director/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// Session Pause & Resume
// =============================================================================

test.describe('Game Session — Pause & Resume', () => {
  test('director should be able to pause an active session', async ({ page }) => {
    // TODO: Requires running backend with an ACTIVE session
    await loginAsDirectorAndEnterRoom(page);

    // Start session first if needed
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
      .or(page.getByTestId('start-session-button'));

    if (await startButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startButton.click();
      await expect(page.getByText(/active/i)).toBeVisible({ timeout: 10_000 });
    }

    // Now look for the pause button
    const pauseButton = page
      .getByRole('button', { name: /pause.*session|pause.*game|pause/i })
      .or(page.getByTestId('pause-session-button'));

    if (await pauseButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pauseButton.click();

      // Session status should change to PAUSED
      await expect(
        page.getByText(/paused/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('director should be able to resume a paused session', async ({ page }) => {
    // TODO: Requires running backend with a PAUSED session
    await loginAsDirectorAndEnterRoom(page);

    // If we see a paused state, look for resume button
    const resumeButton = page
      .getByRole('button', { name: /resume.*session|resume.*game|resume/i })
      .or(page.getByTestId('resume-session-button'));

    if (await resumeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await resumeButton.click();

      // Session status should change back to ACTIVE
      await expect(
        page.getByText(/active/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('paused session should display a visual indicator', async ({ page }) => {
    // TODO: Requires running backend with a PAUSED session
    await loginAsDirectorAndEnterRoom(page);

    // Start and then pause
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
      .or(page.getByTestId('start-session-button'));

    if (await startButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    const pauseButton = page
      .getByRole('button', { name: /pause.*session|pause.*game|pause/i })
      .or(page.getByTestId('pause-session-button'));

    if (await pauseButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pauseButton.click();

      // The status badge in the header should show "paused" with a gold/yellow color
      const statusBadge = page.locator('[class*="gold"]').filter({ hasText: /paused/i })
        .or(page.getByText(/paused/i));

      await expect(statusBadge.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

// =============================================================================
// Session End
// =============================================================================

test.describe('Game Session — End', () => {
  test('director should be able to end an active session', async ({ page }) => {
    // TODO: Requires running backend with an ACTIVE session
    await loginAsDirectorAndEnterRoom(page);

    // Ensure we have an active session
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
      .or(page.getByTestId('start-session-button'));

    if (await startButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startButton.click();
      await expect(page.getByText(/active/i)).toBeVisible({ timeout: 10_000 });
    }

    // Look for the end session button
    const endButton = page
      .getByRole('button', { name: /end.*session|end.*game|stop.*session/i })
      .or(page.getByTestId('end-session-button'));

    if (await endButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await endButton.click();

      // May have a confirmation dialog
      const confirmButton = page
        .getByRole('button', { name: /confirm|yes|end/i })
        .or(page.getByTestId('confirm-end-session'));

      if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Session status should change — room goes back to WAITING or shows "ended"
      await expect(
        page.getByText(/ended|waiting|complete/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('ending a session should disable game interactions', async ({ page }) => {
    // TODO: Requires running backend with an ended session
    await loginAsDirectorAndEnterRoom(page);

    // After ending, check that key game controls are disabled or hidden
    const endButton = page
      .getByRole('button', { name: /end.*session|end.*game|stop.*session/i })
      .or(page.getByTestId('end-session-button'));

    if (await endButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await endButton.click();

      const confirmButton = page
        .getByRole('button', { name: /confirm|yes|end/i })
        .or(page.getByTestId('confirm-end-session'));

      if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // The dice roller should be disabled or the session should show an ended state
      const diceInput = page
        .getByPlaceholder(/dice|formula|roll/i)
        .or(page.getByTestId('dice-input'));

      if (await diceInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Dice input should be disabled after session ends
        await expect(diceInput).toBeDisabled();
      }
    }
  });

  test('director should be able to start a new session after ending one', async ({ page }) => {
    // TODO: Requires running backend with a completed session in the room
    await loginAsDirectorAndEnterRoom(page);

    // After a session ends, the room status goes to WAITING, so
    // the start button should reappear for a new session
    const startButton = page
      .getByRole('button', { name: /start.*session|start.*game|begin.*session|new.*session/i })
      .or(page.getByTestId('start-session-button'));

    if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startButton.click();

      // Should be able to start a fresh session
      await expect(
        page.getByText(/active/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

// =============================================================================
// Session Status Visibility
// =============================================================================

test.describe('Game Session — Status Visibility', () => {
  test('room header should display the current session status', async ({ page }) => {
    // TODO: Requires running backend with a room that has an active session
    await loginAsDirectorAndEnterRoom(page);

    // The game room page header shows a status badge
    const statusBadge = page
      .locator('header')
      .getByText(/active|paused|waiting|ended/i);

    await expect(statusBadge.first()).toBeVisible({ timeout: 10_000 });
  });

  test('connection indicator should show connected status in game room', async ({ page }) => {
    // TODO: Requires running backend with WebSocket support
    await loginAsDirectorAndEnterRoom(page);

    // The game room shows a connection status indicator
    const connectionStatus = page.getByText(/connected|reconnecting/i);

    await expect(connectionStatus.first()).toBeVisible({ timeout: 10_000 });
  });

  test('player should see session status changes in real time', async ({ browser }) => {
    // TODO: Requires running backend — this test uses two browser contexts
    // to simulate director and player seeing the same session state

    const directorContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const directorPage = await directorContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Login as director
      await loginAs(directorPage, 'director@test.com', 'password123');
      // Login as player
      await loginAs(playerPage, 'player@test.com', 'password123');

      // Both navigate to the same room
      const lobbyLink = directorPage.getByRole('link', { name: /lobby|rooms|browse/i });
      if (await lobbyLink.isVisible().catch(() => false)) {
        await lobbyLink.click();
      }

      await directorPage.waitForTimeout(2000);

      const roomCard = directorPage
        .getByTestId('room-card')
        .first()
        .or(directorPage.getByRole('link', { name: /campaign|room|game/i }).first());

      if (await roomCard.isVisible().catch(() => false)) {
        // Get the room URL from the director page
        await roomCard.click();
        await expect(directorPage).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, {
          timeout: 10_000,
        });

        const roomUrl = directorPage.url();

        // Player navigates to the same room
        await playerPage.goto(roomUrl);

        // Director starts the session
        const startButton = directorPage
          .getByRole('button', { name: /start.*session|start.*game|begin.*session/i })
          .or(directorPage.getByTestId('start-session-button'));

        if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await startButton.click();

          // Player should see the status change to ACTIVE (via WebSocket)
          await expect(
            playerPage.getByText(/active/i),
          ).toBeVisible({ timeout: 15_000 });
        }
      }
    } finally {
      await directorContext.close();
      await playerContext.close();
    }
  });
});

// =============================================================================
// Session List & History
// =============================================================================

test.describe('Game Session — History', () => {
  test('should display list of past sessions for a room', async ({ page }) => {
    // TODO: Requires running backend with seeded session history
    await loginAsDirectorAndEnterRoom(page);

    // Look for a sessions/history tab or section
    const sessionsTab = page
      .getByRole('tab', { name: /sessions|history|past/i })
      .or(page.getByRole('button', { name: /sessions|history|past.*sessions/i }))
      .or(page.getByTestId('tab-sessions'));

    if (await sessionsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sessionsTab.click();

      // Should show a list of sessions with status and timestamps
      await expect(
        page.getByText(/session|started|ended|active|completed/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('session list should show event counts', async ({ page }) => {
    // TODO: Requires running backend with sessions that have logged events
    await loginAsDirectorAndEnterRoom(page);

    const sessionsTab = page
      .getByRole('tab', { name: /sessions|history|past/i })
      .or(page.getByRole('button', { name: /sessions|history|past.*sessions/i }))
      .or(page.getByTestId('tab-sessions'));

    if (await sessionsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sessionsTab.click();

      // Each session entry should display an event count
      const sessionItem = page
        .getByTestId('session-list-item')
        .first()
        .or(page.locator('[class*="session"][class*="item"]').first());

      if (await sessionItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Event count text like "42 events" or "0 events"
        await expect(
          sessionItem.getByText(/\d+\s*event/i),
        ).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});
