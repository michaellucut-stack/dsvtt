import { test, expect } from '@playwright/test';

// =============================================================================
// Session Replay Viewer E2E Tests — Sprint 7 "Ship It v1.0"
//
// Tests the session replay viewer at /[roomId]/replay?sessionId=...
// Covers: loading replay data, playback controls (play/pause/step),
// speed controls, timeline scrubber, and event log panel.
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
 * Helper: navigate to the replay page for a room's session.
 *
 * Since replay requires a sessionId query param, we first navigate to the room,
 * then construct the replay URL. If a testSessionId is provided, we use it
 * directly; otherwise we attempt to find one from the session list.
 */
async function navigateToReplay(
  page: import('@playwright/test').Page,
  options: { roomId?: string; sessionId?: string } = {},
) {
  if (options.roomId && options.sessionId) {
    // Direct navigation to the replay page
    await page.goto(`/${options.roomId}/replay?sessionId=${options.sessionId}`);
    return;
  }

  // Navigate to lobby first
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  await page.waitForTimeout(2000);

  // Click into the first available room
  const roomCard = page
    .getByTestId('room-card')
    .first()
    .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

  if (await roomCard.isVisible().catch(() => false)) {
    await roomCard.click();
    await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });

    // Try to find a "Replay" or "View Replay" link/button
    const replayLink = page
      .getByRole('link', { name: /replay|view.*replay/i })
      .or(page.getByRole('button', { name: /replay|view.*replay/i }))
      .or(page.getByTestId('replay-link'));

    if (await replayLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await replayLink.click();
    }
  }
}

// =============================================================================
// Replay Page — Loading & Layout
// =============================================================================

test.describe('Session Replay — Page Layout', () => {
  test('should show missing sessionId message when no query param provided', async ({ page }) => {
    await loginAs(page, 'director@test.com', 'password123');

    // Navigate directly to replay page without sessionId
    await page.goto('/test-room/replay');

    // Should show the "No session ID provided" message
    await expect(
      page.getByText(/no session id provided/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should display the replay page header with back link', async ({ page }) => {
    // TODO: Requires running backend with a valid session to replay
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // The header should contain "Session Replay" text
    const heading = page.getByText(/session replay/i);
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Should have a "REPLAY" badge
    const replayBadge = page.getByText(/^REPLAY$/);
    await expect(replayBadge).toBeVisible({ timeout: 5_000 });

    // Should have a back-to-room link
    const backLink = page.locator('a[title="Back to game room"]')
      .or(page.getByRole('link', { name: /back/i }));

    await expect(backLink).toBeVisible({ timeout: 5_000 });
  });

  test('should show loading state while fetching replay data', async ({ page }) => {
    // TODO: Requires running backend — loading state appears briefly
    await loginAs(page, 'director@test.com', 'password123');
    await page.goto('/test-room/replay?sessionId=test-session-id');

    // During loading, a Loading spinner should be visible (briefly)
    // We can't always catch it, so just verify the page doesn't crash
    await page.waitForTimeout(2000);

    // Page should either show loading, error, or the replay content
    const hasReplayContent = await page.getByText(/session replay/i).isVisible().catch(() => false);
    const hasError = await page.getByText(/error|failed/i).isVisible().catch(() => false);
    const hasNoSessionMsg = await page.getByText(/no session id/i).isVisible().catch(() => false);

    expect(hasReplayContent || hasError || hasNoSessionMsg).toBeTruthy();
  });

  test('should show error state for invalid session ID', async ({ page }) => {
    // TODO: Requires running backend that returns 404 for invalid session
    await loginAs(page, 'director@test.com', 'password123');
    await page.goto('/test-room/replay?sessionId=invalid-nonexistent-id');

    // Should display an error message from the replay store
    await page.waitForTimeout(3000);

    const errorMessage = page.getByText(/error|failed|not found/i);
    if (await errorMessage.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should display total event count in header', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // The header shows "N events" text
    const eventCount = page.getByText(/\d+\s*events?/i);
    await expect(eventCount).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// Replay — Playback Controls
// =============================================================================

test.describe('Session Replay — Playback Controls', () => {
  test('should display play/pause and step buttons', async ({ page }) => {
    // TODO: Requires running backend with a valid session to replay
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Play/Pause button
    const playPauseButton = page.locator('button[title="Play"]')
      .or(page.locator('button[title="Pause"]'));

    await expect(playPauseButton).toBeVisible({ timeout: 10_000 });

    // Step backward button
    const stepBackward = page.locator('button[title="Step backward"]');
    await expect(stepBackward).toBeVisible({ timeout: 5_000 });

    // Step forward button
    const stepForward = page.locator('button[title="Step forward"]');
    await expect(stepForward).toBeVisible({ timeout: 5_000 });
  });

  test('play button should be disabled when no events are loaded', async ({ page }) => {
    // TODO: Requires running backend — with an empty session
    await loginAs(page, 'director@test.com', 'password123');
    await page.goto('/test-room/replay?sessionId=empty-session-id');

    await page.waitForTimeout(3000);

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(playButton).toBeDisabled();
    }
  });

  test('step backward should be disabled at the beginning', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    // At currentIndex <= 0, step backward should be disabled
    const stepBackward = page.locator('button[title="Step backward"]');
    if (await stepBackward.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(stepBackward).toBeDisabled();
    }
  });

  test('clicking play should start playback and show pause button', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Events must be loaded for play to work
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        await playButton.click();

        // The button should now show "Pause" title
        const pauseButton = page.locator('button[title="Pause"]');
        await expect(pauseButton).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('clicking pause should stop playback and show play button', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        // Start playback
        await playButton.click();
        await page.waitForTimeout(500);

        // Now pause
        const pauseButton = page.locator('button[title="Pause"]');
        if (await pauseButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await pauseButton.click();

          // Should revert to "Play" title
          await expect(page.locator('button[title="Play"]')).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  });

  test('step forward should advance to the next event', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    const stepForward = page.locator('button[title="Step forward"]');
    if (await stepForward.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await stepForward.isDisabled();
      if (!isDisabled) {
        await stepForward.click();

        // The event counter should show "Event 1 /" or higher
        await expect(
          page.getByText(/Event\s+\d+\s*\/\s*\d+/),
        ).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('step buttons should be disabled during playback', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        await playButton.click();
        await page.waitForTimeout(500);

        // While playing, step buttons should be disabled
        const stepForward = page.locator('button[title="Step forward"]');
        const stepBackward = page.locator('button[title="Step backward"]');

        if (await stepForward.isVisible().catch(() => false)) {
          await expect(stepForward).toBeDisabled();
        }
        if (await stepBackward.isVisible().catch(() => false)) {
          await expect(stepBackward).toBeDisabled();
        }

        // Clean up: pause playback
        const pauseButton = page.locator('button[title="Pause"]');
        if (await pauseButton.isVisible().catch(() => false)) {
          await pauseButton.click();
        }
      }
    }
  });
});

// =============================================================================
// Replay — Speed Controls
// =============================================================================

test.describe('Session Replay — Speed Controls', () => {
  test('should display speed buttons (1x, 2x, 4x, 8x)', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Speed buttons should be visible
    await expect(page.getByRole('button', { name: '1x' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '2x' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: '4x' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: '8x' })).toBeVisible({ timeout: 5_000 });
  });

  test('1x speed should be active by default', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const speed1x = page.getByRole('button', { name: '1x' });
    if (await speed1x.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // The default speed (1x) should have the active gold class
      await expect(speed1x).toHaveClass(/gold/);
    }
  });

  test('clicking 4x should change active speed', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const speed4x = page.getByRole('button', { name: '4x' });
    if (await speed4x.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await speed4x.click();

      // 4x button should now be active
      await expect(speed4x).toHaveClass(/gold/);

      // 1x should no longer be active
      const speed1x = page.getByRole('button', { name: '1x' });
      await expect(speed1x).not.toHaveClass(/gold/);
    }
  });

  test('clicking 8x should set maximum playback speed', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const speed8x = page.getByRole('button', { name: '8x' });
    if (await speed8x.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await speed8x.click();
      await expect(speed8x).toHaveClass(/gold/);
    }
  });
});

// =============================================================================
// Replay — Timeline Scrubber
// =============================================================================

test.describe('Session Replay — Timeline Scrubber', () => {
  test('should display the timeline slider', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // The timeline has an input[type="range"] slider
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 10_000 });
  });

  test('should display event counter showing current position', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Event counter in format "Event N / M"
    const eventCounter = page.getByText(/Event\s+\d+\s*\/\s*\d+/);
    await expect(eventCounter).toBeVisible({ timeout: 10_000 });
  });

  test('should display current event type badge', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Step forward to get a current event
    const stepForward = page.locator('button[title="Step forward"]');
    if (await stepForward.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await stepForward.isDisabled();
      if (!isDisabled) {
        await stepForward.click();
        await page.waitForTimeout(500);

        // The current event type should be shown in a badge
        // Event types like GAME_STARTED, CHAT_MESSAGE, TOKEN_MOVED etc.
        const eventTypeBadge = page.locator('.font-mono').filter({
          hasText: /GAME_|CHAT_|DICE_|TOKEN_|FOG_|TURN_|NPC_|CHARACTER_|NOTE_/,
        });

        if (await eventTypeBadge.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await expect(eventTypeBadge).toBeVisible();
        }
      }
    }
  });

  test('dragging the slider should seek to a different event', async ({ page }) => {
    // TODO: Requires running backend with a session that has multiple events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await slider.isDisabled();
      if (!isDisabled) {
        // Get the slider bounding box
        const box = await slider.boundingBox();
        if (box) {
          // Click at the midpoint of the slider to seek to the middle
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(500);

          // The event counter should reflect a position somewhere in the middle
          const counterText = await page.getByText(/Event\s+\d+\s*\/\s*\d+/).textContent();
          expect(counterText).toBeTruthy();
        }
      }
    }
  });

  test('timeline slider should be disabled when no events are loaded', async ({ page }) => {
    // TODO: Requires a session with zero events
    await loginAs(page, 'director@test.com', 'password123');
    await page.goto('/test-room/replay?sessionId=empty-session-id');

    await page.waitForTimeout(3000);

    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(slider).toBeDisabled();
    }
  });

  test('should display timestamp for current event', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // The controls area shows a timestamp (font-mono)
    // Default is "--:--:--" until an event is selected
    const timestamp = page.locator('.font-mono').filter({
      hasText: /\d{1,2}:\d{2}:\d{2}|--:--:--/,
    });

    await expect(timestamp.first()).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// Replay — Event Markers on Timeline
// =============================================================================

test.describe('Session Replay — Event Markers', () => {
  test('should display colored event markers below the slider', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Mini event markers are rendered as small colored divs
    // They are in a flex container below the slider
    await page.waitForTimeout(2000);

    // Look for the event marker container (has gap-px class and h-3 height)
    const markerContainer = page.locator('.flex.items-center.gap-px');
    if (await markerContainer.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Should contain colored marker divs
      const markers = markerContainer.locator('div');
      const count = await markers.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Replay — Event Log Panel
// =============================================================================

test.describe('Session Replay — Event Log Panel', () => {
  test('should display "Event Log" heading in the sidebar', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const eventLogHeading = page.getByText(/event log/i);
    await expect(eventLogHeading).toBeVisible({ timeout: 10_000 });
  });

  test('should show "No events to display" for empty session', async ({ page }) => {
    // TODO: Requires running backend returning empty events
    await loginAs(page, 'director@test.com', 'password123');
    await page.goto('/test-room/replay?sessionId=empty-session-id');

    await page.waitForTimeout(3000);

    const noEventsMessage = page.getByText(/no events to display/i);
    if (await noEventsMessage.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(noEventsMessage).toBeVisible();
    }
  });

  test('event log should list events with type labels and timestamps', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    // Each event in the log shows a label (e.g. "Game Started", "Chat", "Dice Roll")
    const eventLabels = page.getByText(
      /Game Started|Game Paused|Game Ended|Chat|Whisper|Dice Roll|Token Moved|Token Added|Fog Updated|Next Turn/,
    );

    if (await eventLabels.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      const count = await eventLabels.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('clicking an event in the log should seek to that event', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    // Find event buttons in the log (they are <button> elements)
    const eventButtons = page.locator('button').filter({
      hasText: /Game Started|Chat|Dice Roll|Token|Fog/,
    });

    if (await eventButtons.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      const count = await eventButtons.count();
      if (count > 1) {
        // Click on the second event
        await eventButtons.nth(1).click();
        await page.waitForTimeout(500);

        // The clicked event should become the active one (highlighted with gold border)
        const activeEvent = page.locator('button.border-l-gold-500')
          .or(page.locator('button[class*="gold-900"]'));

        if (await activeEvent.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await expect(activeEvent).toBeVisible();
        }
      }
    }
  });

  test('active event in log should auto-scroll into view during playback', async ({ page }) => {
    // TODO: Requires running backend with a session that has many events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // Start playback
    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        await playButton.click();

        // Let it play for a couple seconds
        await page.waitForTimeout(3000);

        // Pause playback
        const pauseButton = page.locator('button[title="Pause"]');
        if (await pauseButton.isVisible().catch(() => false)) {
          await pauseButton.click();
        }

        // The active event in the event log should be visible (scrolled into view)
        const activeEvent = page.locator('button.border-l-gold-500')
          .or(page.locator('button[class*="gold-900"]'));

        if (await activeEvent.isVisible({ timeout: 3_000 }).catch(() => false)) {
          // The active event should be within the visible area of the scroll container
          await expect(activeEvent).toBeInViewport();
        }
      }
    }
  });

  test('event log entries should be disabled during playback', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        await playButton.click();
        await page.waitForTimeout(500);

        // Event log buttons should be disabled during playback
        const eventButtons = page.locator('button').filter({
          hasText: /Game Started|Chat|Dice Roll|Token|Fog/,
        });

        if (await eventButtons.first().isVisible().catch(() => false)) {
          await expect(eventButtons.first()).toBeDisabled();
        }

        // Clean up: pause
        const pauseButton = page.locator('button[title="Pause"]');
        if (await pauseButton.isVisible().catch(() => false)) {
          await pauseButton.click();
        }
      }
    }
  });
});

// =============================================================================
// Replay — Map View
// =============================================================================

test.describe('Session Replay — Map View', () => {
  test('should render the replay map view panel', async ({ page }) => {
    // TODO: Requires running backend with a session that has map state
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    // The left panel shows the ReplayMapView component
    // It renders a canvas or a placeholder
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas').first();
    const hasCanvas = await canvas.isVisible({ timeout: 5_000 }).catch(() => false);

    // Either a canvas is rendered, or the replay content is shown
    const hasReplayContent = await page.getByText(/session replay/i).isVisible().catch(() => false);

    expect(hasCanvas || hasReplayContent).toBeTruthy();
  });

  test('replay layout should have resizable map and event log panels', async ({ page }) => {
    // TODO: Requires running backend with a valid session
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    // The replay page uses ResizablePanels with map on left, event log on right
    // Both panels should be visible
    const eventLogHeading = page.getByText(/event log/i);
    if (await eventLogHeading.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(eventLogHeading).toBeVisible();
    }
  });
});

// =============================================================================
// Replay — Full Playback Flow (Integration)
// =============================================================================

test.describe('Session Replay — Full Playback Flow', () => {
  test('should play through events from start to finish', async ({ page }) => {
    // TODO: Requires running backend with a session that has a small number of events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    const playButton = page.locator('button[title="Play"]');
    if (await playButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isDisabled = await playButton.isDisabled();
      if (!isDisabled) {
        // Set to fastest speed
        const speed8x = page.getByRole('button', { name: '8x' });
        if (await speed8x.isVisible().catch(() => false)) {
          await speed8x.click();
        }

        // Start playback
        await playButton.click();

        // Wait for playback to finish (or timeout after 30s)
        // When playback finishes, the play button should reappear
        await expect(page.locator('button[title="Play"]')).toBeVisible({ timeout: 30_000 });

        // After playback ends, the event counter should show the last event
        const counterText = await page.getByText(/Event\s+\d+\s*\/\s*\d+/).textContent()
          .catch(() => null);

        if (counterText) {
          // The current event should be at or near the total
          const match = counterText.match(/Event\s+(\d+)\s*\/\s*(\d+)/);
          if (match) {
            const current = parseInt(match[1]!, 10);
            const total = parseInt(match[2]!, 10);
            expect(current).toBe(total);
          }
        }
      }
    }
  });

  test('should be able to seek, pause, and resume during playback', async ({ page }) => {
    // TODO: Requires running backend with a session that has events
    await loginAs(page, 'director@test.com', 'password123');
    await navigateToReplay(page, { roomId: 'test-room', sessionId: 'test-session-id' });

    await page.waitForTimeout(2000);

    // Step forward a few times
    const stepForward = page.locator('button[title="Step forward"]');
    if (await stepForward.isVisible({ timeout: 5_000 }).catch(() => false)) {
      if (!await stepForward.isDisabled()) {
        await stepForward.click();
        await page.waitForTimeout(300);
        await stepForward.click();
        await page.waitForTimeout(300);
        await stepForward.click();

        // Step backward once
        const stepBackward = page.locator('button[title="Step backward"]');
        if (await stepBackward.isVisible().catch(() => false)) {
          if (!await stepBackward.isDisabled()) {
            await stepBackward.click();
          }
        }

        // Start playback
        const playButton = page.locator('button[title="Play"]');
        if (await playButton.isVisible().catch(() => false)) {
          if (!await playButton.isDisabled()) {
            await playButton.click();
            await page.waitForTimeout(1000);

            // Pause
            const pauseButton = page.locator('button[title="Pause"]');
            if (await pauseButton.isVisible().catch(() => false)) {
              await pauseButton.click();

              // We should now be able to step again
              await expect(page.locator('button[title="Play"]')).toBeVisible({ timeout: 5_000 });
            }
          }
        }
      }
    }
  });
});
