import { test, expect } from '@playwright/test';
import { loginViaApi, registerViaApi } from '../helpers/auth';
import { createRoomViaApi, navigateToRoom, joinRoomViaApi } from '../helpers/room';

// =============================================================================
// Room Detail E2E Tests — Room info, player list, join/leave, start game
// =============================================================================

const timestamp = Date.now();

// Director account
const directorEmail = `e2e-director-${timestamp}@example.com`;
const directorName = 'Director Tester';
const directorPassword = 'TestPassword123!';

// Player account
const playerEmail = `e2e-player-${timestamp}@example.com`;
const playerName = 'Player Tester';
const playerPassword = 'TestPassword123!';

test.describe('Room Detail', () => {
  let sharedRoomId: string;

  test.beforeAll(async ({ browser }) => {
    // Seed director user and create a room
    const directorPage = await browser.newPage();
    await directorPage.goto('/login');
    await registerViaApi(directorPage, {
      email: directorEmail,
      displayName: directorName,
      password: directorPassword,
    });
    sharedRoomId = await createRoomViaApi(directorPage, `Detail Room ${timestamp}`, 6);
    await directorPage.close();

    // Seed player user
    const playerPage = await browser.newPage();
    await playerPage.goto('/login');
    await registerViaApi(playerPage, {
      email: playerEmail,
      displayName: playerName,
      password: playerPassword,
    });
    await playerPage.close();
  });

  test('should show room name and status', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);

    await navigateToRoom(page, sharedRoomId);

    // Room name heading
    await expect(
      page.getByRole('heading', { name: new RegExp(`Detail Room ${timestamp}`) }),
    ).toBeVisible();

    // Status badge: "Waiting for Players"
    await expect(page.getByText(/Waiting for Players/i)).toBeVisible();

    // Player count: X/6
    await expect(page.getByText(/\/6 players/i)).toBeVisible();
  });

  test('should show player list with director', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);

    await navigateToRoom(page, sharedRoomId);

    // The "Players" heading should be visible
    await expect(page.getByRole('heading', { name: /Players/i })).toBeVisible();

    // Director should appear in the player list with "Director" badge
    await expect(page.getByText(directorName)).toBeVisible();
    await expect(page.getByText('Director')).toBeVisible();
  });

  test('should show "Join as Player" button for non-members', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, playerEmail, playerPassword);

    await navigateToRoom(page, sharedRoomId);

    // Player (not yet a member) should see Join button
    await expect(
      page.getByRole('button', { name: /Join as Player/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should join room and appear in player list', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, playerEmail, playerPassword);

    await navigateToRoom(page, sharedRoomId);

    // Click Join
    await page.getByRole('button', { name: /Join as Player/i }).click();

    // After joining, the player name should appear in the player list
    await expect(page.getByText(playerName)).toBeVisible({ timeout: 10_000 });

    // "Leave Room" button should now be visible
    await expect(
      page.getByRole('button', { name: /Leave Room/i }),
    ).toBeVisible();

    // "Join as Player" button should disappear
    await expect(
      page.getByRole('button', { name: /Join as Player/i }),
    ).not.toBeVisible();
  });

  test('should show "Start Game" button for director when room has players', async ({ page }) => {
    // Ensure the player has joined (from previous test or via API)
    const playerPage = await page.context().newPage();
    await playerPage.goto('/login');
    await loginViaApi(playerPage, playerEmail, playerPassword);
    // Join via API to be safe
    await joinRoomViaApi(playerPage, sharedRoomId).catch(() => {
      // Already joined — that's fine
    });
    await playerPage.close();

    // Login as director
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);

    await navigateToRoom(page, sharedRoomId);

    // Director should see the Start Game button when there are players
    await expect(
      page.getByRole('button', { name: /Start Game/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should start game and change room status', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);

    // Create a fresh room to avoid state issues with other tests
    const freshRoomId = await createRoomViaApi(page, `Start Room ${timestamp}`, 4);

    // Have player join this room
    const playerPage = await page.context().newPage();
    await playerPage.goto('/login');
    await loginViaApi(playerPage, playerEmail, playerPassword);
    await joinRoomViaApi(playerPage, freshRoomId);
    await playerPage.close();

    // Navigate to room as director
    await navigateToRoom(page, freshRoomId);

    // Click Start Game
    await page.getByRole('button', { name: /Start Game/i }).click();

    // Status should change — "Waiting for Players" should disappear,
    // replaced by "Game in Progress" or similar
    await expect(page.getByText(/Game in Progress/i)).toBeVisible({
      timeout: 10_000,
    });

    // Start Game button should no longer be visible
    await expect(
      page.getByRole('button', { name: /Start Game/i }),
    ).not.toBeVisible();
  });

  test('should allow player to leave room', async ({ page }) => {
    // Create a fresh room for this test
    const dirPage = await page.context().newPage();
    await dirPage.goto('/login');
    await loginViaApi(dirPage, directorEmail, directorPassword);
    const leaveRoomId = await createRoomViaApi(dirPage, `Leave Room ${timestamp}`, 4);
    await dirPage.close();

    // Login as player and join
    await page.goto('/login');
    await loginViaApi(page, playerEmail, playerPassword);
    await joinRoomViaApi(page, leaveRoomId);

    await navigateToRoom(page, leaveRoomId);

    // Click Leave Room
    await page.getByRole('button', { name: /Leave Room/i }).click();

    // Should redirect back to lobby
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
  });
});
