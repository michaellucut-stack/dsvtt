import { test, expect } from '@playwright/test';
import { loginViaApi, registerViaApi } from '../helpers/auth';
import { createRoomViaApi, joinRoomViaApi, startGameViaApi } from '../helpers/room';

// =============================================================================
// Game Room E2E Tests — Map canvas, sidebar tabs, chat, dice
// =============================================================================

const timestamp = Date.now();

const directorEmail = `e2e-game-dir-${timestamp}@example.com`;
const directorName = 'Game Director';
const directorPassword = 'TestPassword123!';

const playerEmail = `e2e-game-player-${timestamp}@example.com`;
const playerName = 'Game Player';
const playerPassword = 'TestPassword123!';

test.describe('Game Room', () => {
  let roomId: string;

  test.beforeAll(async ({ browser }) => {
    // Seed director
    const dirPage = await browser.newPage();
    await dirPage.goto('/login');
    await registerViaApi(dirPage, {
      email: directorEmail,
      displayName: directorName,
      password: directorPassword,
    });

    // Create and start a room
    roomId = await createRoomViaApi(dirPage, `Game Room ${timestamp}`, 6);

    // Seed player and have them join
    const playerPage = await browser.newPage();
    await playerPage.goto('/login');
    await registerViaApi(playerPage, {
      email: playerEmail,
      displayName: playerName,
      password: playerPassword,
    });
    await joinRoomViaApi(playerPage, roomId);
    await playerPage.close();

    // Start the game
    await startGameViaApi(dirPage, roomId);
    await dirPage.close();
  });

  test('should load game room with header and sidebar', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);

    // Navigate directly to the game room
    await page.goto(`/${roomId}`);

    // The header should show the room name
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // Sidebar tabs should be visible: CHAT, DICE, PARTY, NOTES
    await expect(page.getByText('CHAT')).toBeVisible();
    await expect(page.getByText('DICE')).toBeVisible();
    await expect(page.getByText('PARTY')).toBeVisible();
    await expect(page.getByText('NOTES')).toBeVisible();

    // Director should also see the DM tab
    await expect(page.getByText('DM')).toBeVisible();
  });

  test('should switch sidebar tabs', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);
    await page.goto(`/${roomId}`);

    // Wait for the room to load
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // CHAT tab is active by default — chat input placeholder should be visible
    await expect(
      page.getByPlaceholder(/Speak in character|Type a message/i),
    ).toBeVisible({ timeout: 5_000 });

    // Click DICE tab
    await page.getByText('DICE').click();

    // Dice roller should show "Quick Roll" label and formula input
    await expect(page.getByText(/Quick Roll/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder('2d6+3')).toBeVisible();

    // Click PARTY tab
    await page.getByText('PARTY').click();

    // Party tab content should be visible (CharacterSheet component)
    // Wait a moment for content to render
    await page.waitForTimeout(500);

    // Click NOTES tab
    await page.getByText('NOTES').click();
    await page.waitForTimeout(500);

    // Click back to CHAT
    await page.getByText('CHAT').click();
    await expect(
      page.getByPlaceholder(/Speak in character|Type a message/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should send a chat message and see it appear', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);
    await page.goto(`/${roomId}`);

    // Wait for game room to load
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // CHAT tab is active by default — switch to OOC for simpler testing
    await page.getByText('OOC').click();

    // Type a message
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
    await chatInput.fill('Hello from E2E!');

    // Submit via the send button (SVG icon button next to input)
    await chatInput.press('Enter');

    // The message should appear in the chat
    await expect(page.getByText('Hello from E2E!')).toBeVisible({
      timeout: 10_000,
    });

    // Sender name should appear near the message
    await expect(page.getByText(directorName)).toBeVisible();
  });

  test('should roll dice with formula and see result', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);
    await page.goto(`/${roomId}`);

    // Wait for game room to load
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // Switch to DICE tab
    await page.getByText('DICE').click();

    // Wait for dice roller to appear
    await expect(page.getByPlaceholder('2d6+3')).toBeVisible({ timeout: 5_000 });

    // Type a formula
    const formulaInput = page.getByPlaceholder('2d6+3');
    await formulaInput.fill('1d20');

    // Click Roll button
    await page.getByRole('button', { name: /^Roll$/i }).click();

    // A roll result should appear in the history — the formula "1d20" should show
    await expect(page.getByText('1d20').first()).toBeVisible({ timeout: 10_000 });

    // The roller name should appear
    await expect(page.getByText(directorName).first()).toBeVisible();
  });

  test('should roll dice via quick-roll buttons', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, directorEmail, directorPassword);
    await page.goto(`/${roomId}`);

    // Wait for game room
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // Switch to DICE tab
    await page.getByText('DICE').click();
    await expect(page.getByText(/Quick Roll/i)).toBeVisible({ timeout: 5_000 });

    // Click the d20 quick-roll button
    await page.getByRole('button', { name: 'd20' }).click();

    // Should show a roll result for 1d20
    await expect(page.getByText('1d20').first()).toBeVisible({ timeout: 10_000 });
  });

  test('player should not see DM tab', async ({ page }) => {
    await page.goto('/login');
    await loginViaApi(page, playerEmail, playerPassword);
    await page.goto(`/${roomId}`);

    // Wait for game room to load
    await expect(
      page.getByRole('heading', { name: new RegExp(`Game Room ${timestamp}`) }),
    ).toBeVisible({ timeout: 15_000 });

    // Player should see CHAT, DICE, PARTY, NOTES
    await expect(page.getByText('CHAT')).toBeVisible();
    await expect(page.getByText('DICE')).toBeVisible();
    await expect(page.getByText('PARTY')).toBeVisible();
    await expect(page.getByText('NOTES')).toBeVisible();

    // Player should NOT see DM tab
    await expect(page.getByText('DM')).not.toBeVisible();
  });
});
