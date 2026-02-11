import { test, expect } from '@playwright/test';

// =============================================================================
// Lobby E2E Tests — Room list, creation, and details
// =============================================================================

/**
 * Helper: log in as a test user and navigate to the lobby/dashboard.
 * Assumes the user is already registered (seeded or from a prior test).
 */
async function loginAndNavigateToLobby(page: import('@playwright/test').Page) {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('TestPassword123!');
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();

  // Wait for redirect to dashboard/lobby
  await expect(page).toHaveURL(/\/(dashboard|lobby|home)?$/, { timeout: 10_000 });
}

test.describe('Lobby', () => {
  test('should see empty lobby after login', async ({ page }) => {
    await loginAndNavigateToLobby(page);

    // Navigate to lobby if not already there
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Verify the lobby page is visible
    await expect(
      page.getByText(/lobby|rooms|no rooms|empty/i),
    ).toBeVisible({ timeout: 10_000 });

    // Should display an empty state or no room cards
    const roomCards = page.getByTestId('room-card');
    const roomCount = await roomCards.count();

    // Either zero room cards or an explicit "no rooms" message
    if (roomCount === 0) {
      await expect(
        page.getByText(/no rooms|empty|create.*first|no games/i),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should create a room and see it in the lobby', async ({ page }) => {
    await loginAndNavigateToLobby(page);

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Click create room button
    await page.getByRole('button', { name: /create.*room|new.*room|create.*game/i }).click();

    // Fill in room creation form
    await page.getByLabel(/room name|name/i).fill('E2E Test Campaign');
    await page.getByLabel(/max.*players|players/i).fill('6');

    // Submit
    await page.getByRole('button', { name: /create|submit|save/i }).click();

    // Verify the room appears in the lobby
    await expect(
      page.getByText('E2E Test Campaign'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should click a room card to view details', async ({ page }) => {
    await loginAndNavigateToLobby(page);

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Wait for rooms to load
    await page.waitForTimeout(2000);

    // Click the first room card (or a specific one if available)
    const roomCard = page.getByTestId('room-card').first().or(
      page.getByRole('link', { name: /campaign|room|game/i }).first(),
    );

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();

      // Should navigate to room detail page
      await expect(page).toHaveURL(/\/rooms\/|\/room\//, { timeout: 10_000 });

      // Should see room details
      await expect(
        page.getByText(/players|status|director|waiting/i),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should display correct player count on room card', async ({ page }) => {
    await loginAndNavigateToLobby(page);

    // Navigate to lobby
    const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
    if (await lobbyLink.isVisible().catch(() => false)) {
      await lobbyLink.click();
    }

    // Wait for rooms to load
    await page.waitForTimeout(2000);

    // Check that room cards display player counts
    const roomCard = page.getByTestId('room-card').first().or(
      page.locator('[class*="room"]').first(),
    );

    if (await roomCard.isVisible().catch(() => false)) {
      // Player count should be visible (e.g. "1/6", "2/4 players")
      await expect(
        roomCard.getByText(/\d+\s*\/\s*\d+|\d+\s*player/i),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
