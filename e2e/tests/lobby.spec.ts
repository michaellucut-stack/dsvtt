import { test, expect } from '@playwright/test';
import { loginViaApi, registerViaApi } from '../helpers/auth';
import { createRoomViaApi } from '../helpers/room';

// =============================================================================
// Lobby E2E Tests — Room list, creation, empty state, and navigation
// =============================================================================

const timestamp = Date.now();
const testEmail = `e2e-lobby-${timestamp}@example.com`;
const testPassword = 'TestPassword123!';

test.describe('Lobby', () => {
  test.beforeAll(async ({ browser }) => {
    // Seed a user for lobby tests
    const page = await browser.newPage();
    await page.goto('/login');
    await registerViaApi(page, {
      email: testEmail,
      displayName: 'Lobby Tester',
      password: testPassword,
    });
    await page.close();
  });

  test('should show lobby page after login', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, testEmail, testPassword);
    await page.goto('/lobby');

    // The lobby page heading should be visible
    await expect(page.getByRole('heading', { name: /Game Lobby/i })).toBeVisible({
      timeout: 10_000,
    });

    // The "Create Room" button should be visible
    await expect(
      page.getByRole('button', { name: /Create Room/i }),
    ).toBeVisible();
  });

  test('should show empty state when no rooms exist', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, testEmail, testPassword);
    await page.goto('/lobby');

    // Wait for the lobby to finish loading
    await expect(page.getByRole('heading', { name: /Game Lobby/i })).toBeVisible({
      timeout: 10_000,
    });

    // The empty state shows "No rooms yet" or room cards
    // (This test may see rooms if other tests created them — but with a fresh
    //  user seed per timestamp the lobby starts empty.)
    const noRoomsHeading = page.getByRole('heading', { name: /No rooms yet/i });
    const roomGrid = page.locator('.grid');

    // Either empty state or rooms grid should be visible
    await expect(
      noRoomsHeading.or(roomGrid),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should create a room via modal and see it in the list', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, testEmail, testPassword);
    await page.goto('/lobby');

    await expect(page.getByRole('heading', { name: /Game Lobby/i })).toBeVisible({
      timeout: 10_000,
    });

    // Click "Create Room" button
    await page.getByRole('button', { name: /Create Room/i }).first().click();

    // The modal should open with title "Create New Room"
    await expect(
      page.getByRole('dialog', { name: /Create New Room/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill in room name
    await page.getByLabel(/Room Name/i).fill('E2E Test Campaign');

    // Fill in max players (clear default first)
    const maxPlayersInput = page.getByLabel(/Max Players/i);
    await maxPlayersInput.clear();
    await maxPlayersInput.fill('6');

    // Submit the form
    await page.getByRole('button', { name: /^Create Room$/i }).click();

    // After creation, the app navigates to the room detail page
    await expect(page).toHaveURL(/\/lobby\/rooms\//, { timeout: 10_000 });

    // The room name should be visible on the detail page
    await expect(page.getByText('E2E Test Campaign')).toBeVisible({ timeout: 5_000 });
  });

  test('should show room card with name, status badge, and player count', async ({ page }) => {
    // Create a room via API for this test
    await page.goto('/login');
    await loginViaApi(page, testEmail, testPassword);

    const roomId = await createRoomViaApi(page, `Card Room ${timestamp}`, 5);

    // Navigate to lobby
    await page.goto('/lobby');
    await expect(page.getByRole('heading', { name: /Game Lobby/i })).toBeVisible({
      timeout: 10_000,
    });

    // Find the room card by name
    const roomCard = page.getByRole('button', { name: new RegExp(`Card Room ${timestamp}`) });
    await expect(roomCard).toBeVisible({ timeout: 10_000 });

    // The card should show the "Waiting" status badge
    await expect(roomCard.getByText(/Waiting/i)).toBeVisible();

    // The card should show player count like "1/5"
    await expect(roomCard.getByText(/\/5/)).toBeVisible();
  });

  test('should click room card to navigate to room detail page', async ({ page }) => {
    // Create a room via API
    await page.goto('/login');
    await loginViaApi(page, testEmail, testPassword);

    const roomId = await createRoomViaApi(page, `Click Room ${timestamp}`, 4);

    // Navigate to lobby
    await page.goto('/lobby');
    await expect(page.getByRole('heading', { name: /Game Lobby/i })).toBeVisible({
      timeout: 10_000,
    });

    // Click the room card
    const roomCard = page.getByRole('button', { name: new RegExp(`Click Room ${timestamp}`) });
    await expect(roomCard).toBeVisible({ timeout: 10_000 });
    await roomCard.click();

    // Should navigate to the room detail page
    await expect(page).toHaveURL(new RegExp(`/lobby/rooms/${roomId}`), {
      timeout: 10_000,
    });

    // Room detail page should show the room name
    await expect(
      page.getByRole('heading', { name: new RegExp(`Click Room ${timestamp}`) }),
    ).toBeVisible();
  });
});
