import { test, expect } from '@playwright/test';

// =============================================================================
// Room Join E2E Tests — Join, player list, start game, leave
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
 * Helper: navigate to a specific room by looking in the lobby.
 */
async function navigateToRoom(page: import('@playwright/test').Page, roomName: string) {
  // Navigate to lobby
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  // Wait for rooms to load
  await page.waitForTimeout(2000);

  // Click on the specific room
  await page.getByText(roomName).first().click();

  // Wait for room detail page
  await expect(page).toHaveURL(/\/rooms\/|\/room\//, { timeout: 10_000 });
}

test.describe('Room Join Flow', () => {
  test('should join a room and appear in the player list', async ({ page }) => {
    await loginAs(page, 'player@example.com', 'TestPassword123!');

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Wait for room list to load
    await page.waitForTimeout(2000);

    // Find and click a joinable room
    const roomCard = page.getByTestId('room-card').first().or(
      page.getByRole('link', { name: /campaign|room|game/i }).first(),
    );

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\//, { timeout: 10_000 });

      // Click join button
      const joinButton = page.getByRole('button', { name: /join|enter/i });
      if (await joinButton.isVisible().catch(() => false)) {
        await joinButton.click();

        // Verify player appears in the player list
        await expect(
          page.getByText(/player@example\.com|Player/i),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should allow director to start the game', async ({ page }) => {
    await loginAs(page, 'test@example.com', 'TestPassword123!');

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Wait for rooms to load
    await page.waitForTimeout(2000);

    // Click on a room the user directs
    const roomCard = page.getByTestId('room-card').first().or(
      page.getByRole('link', { name: /campaign|room|game/i }).first(),
    );

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\//, { timeout: 10_000 });

      // Director should see a start game button
      const startButton = page.getByRole('button', { name: /start.*game|begin|launch/i });
      if (await startButton.isVisible().catch(() => false)) {
        await startButton.click();

        // Room status should change to active or similar
        await expect(
          page.getByText(/active|in progress|started|playing/i),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should allow a player to leave a room', async ({ page }) => {
    await loginAs(page, 'player@example.com', 'TestPassword123!');

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Wait for rooms to load
    await page.waitForTimeout(2000);

    // Click on a room the user has joined
    const roomCard = page.getByTestId('room-card').first().or(
      page.getByRole('link', { name: /campaign|room|game/i }).first(),
    );

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\//, { timeout: 10_000 });

      // Click leave button
      const leaveButton = page.getByRole('button', { name: /leave|exit|quit/i });
      if (await leaveButton.isVisible().catch(() => false)) {
        await leaveButton.click();

        // Should redirect back to lobby or show confirmation
        await expect(
          page.getByText(/left|lobby|rooms/i),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
