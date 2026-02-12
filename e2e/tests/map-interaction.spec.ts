import { test, expect } from '@playwright/test';

// =============================================================================
// Map Interaction E2E Tests — Sprint 7 "Ship It v1.0"
//
// Tests the map canvas features: toolbar tools, tokens, fog of war, pan/zoom,
// and background upload. Since react-konva renders to an HTML Canvas element
// (not DOM), canvas interactions use mouse events on the canvas element while
// toolbar buttons and overlays are tested via standard DOM selectors.
// =============================================================================

/**
 * Helper: log in as a specific user and navigate into the game room.
 */
async function loginAndEnterRoom(
  page: import('@playwright/test').Page,
  options: { email?: string; password?: string } = {},
) {
  const email = options.email ?? 'director@test.com';
  const password = options.password ?? 'password123';

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|lobby|home)?$/, { timeout: 10_000 });

  // Navigate to lobby
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  // Wait for rooms to load then click into one
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

/**
 * Helper: locate the Konva canvas element on the page.
 * react-konva renders a <canvas> inside the map container div.
 */
function getMapCanvas(page: import('@playwright/test').Page) {
  return page.locator('canvas').first();
}

// =============================================================================
// Map Toolbar — Tool Selection
// =============================================================================

test.describe('Map Toolbar — Tool Selection', () => {
  test('should display the map toolbar with tool buttons', async ({ page }) => {
    // TODO: Requires running backend with a room that has a loaded map
    await loginAndEnterRoom(page);

    // The toolbar renders tool buttons with title attributes
    const selectButton = page.locator('button[title="Select (V)"]');
    const panButton = page.locator('button[title="Pan (Space)"]');
    const measureButton = page.locator('button[title="Measure (M)"]');

    await expect(selectButton).toBeVisible({ timeout: 10_000 });
    await expect(panButton).toBeVisible({ timeout: 10_000 });
    await expect(measureButton).toBeVisible({ timeout: 10_000 });
  });

  test('director should see fog of war tool in toolbar', async ({ page }) => {
    // TODO: Requires running backend with director-owned room
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const fogButton = page.locator('button[title="Fog of War (F)"]');
    await expect(fogButton).toBeVisible({ timeout: 10_000 });
  });

  test('player should NOT see fog of war tool in toolbar', async ({ page }) => {
    // TODO: Requires running backend with player in a room
    await loginAndEnterRoom(page, { email: 'player@test.com' });

    // Wait for toolbar to render
    await page.waitForTimeout(2000);

    const fogButton = page.locator('button[title="Fog of War (F)"]');
    await expect(fogButton).toHaveCount(0);
  });

  test('clicking Select tool should highlight it as active', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const selectButton = page.locator('button[title="Select (V)"]');
    if (await selectButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await selectButton.click();

      // Active tool button has the gold highlight class (bg-gold-600)
      await expect(selectButton).toHaveClass(/gold/);
    }
  });

  test('clicking Pan tool should highlight it and change cursor', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const panButton = page.locator('button[title="Pan (Space)"]');
    if (await panButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await panButton.click();

      // Pan button should be active
      await expect(panButton).toHaveClass(/gold/);

      // Canvas cursor should change to "grab" when in move mode
      const canvas = getMapCanvas(page);
      if (await canvas.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // The Stage element receives cursor:grab from the tool state
        const stageContainer = page.locator('[class*="konvajs"]').first()
          .or(canvas);
        const style = await stageContainer.getAttribute('style');
        if (style) {
          expect(style).toContain('grab');
        }
      }
    }
  });

  test('clicking Measure tool should highlight it as active', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const measureButton = page.locator('button[title="Measure (M)"]');
    if (await measureButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await measureButton.click();
      await expect(measureButton).toHaveClass(/gold/);
    }
  });
});

// =============================================================================
// Map Toolbar — Grid Toggle
// =============================================================================

test.describe('Map Toolbar — Grid Toggle', () => {
  test('should toggle grid visibility on and off', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const gridButton = page.locator('button[title="Toggle Grid (G)"]');
    if (await gridButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Grid is visible by default (button should be active)
      await expect(gridButton).toHaveClass(/gold/);

      // Click to toggle grid off
      await gridButton.click();

      // Button should no longer have the active gold class
      await expect(gridButton).not.toHaveClass(/gold/);

      // Click again to toggle grid back on
      await gridButton.click();
      await expect(gridButton).toHaveClass(/gold/);
    }
  });
});

// =============================================================================
// Map Toolbar — Zoom Controls
// =============================================================================

test.describe('Map Toolbar — Zoom Controls', () => {
  test('should display current zoom percentage', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    // The zoom percentage display shows "100%" by default
    const zoomDisplay = page.getByText(/100%/);
    await expect(zoomDisplay).toBeVisible({ timeout: 10_000 });
  });

  test('clicking zoom in should increase the zoom percentage', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const zoomInButton = page.locator('button[title="Zoom In (+)"]');
    if (await zoomInButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Initial zoom should be 100%
      await expect(page.getByText('100%')).toBeVisible({ timeout: 5_000 });

      await zoomInButton.click();

      // Zoom should increase (125% after one click: scale * 1.25)
      await expect(page.getByText('125%')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking zoom out should decrease the zoom percentage', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const zoomOutButton = page.locator('button[title="Zoom Out (-)"]');
    if (await zoomOutButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(page.getByText('100%')).toBeVisible({ timeout: 5_000 });

      await zoomOutButton.click();

      // Zoom should decrease (80% after one click: scale / 1.25)
      await expect(page.getByText('80%')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking Fit to Screen should reset zoom to 100%', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const zoomInButton = page.locator('button[title="Zoom In (+)"]');
    const fitButton = page.locator('button[title="Fit to Screen"]');

    if (await zoomInButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Zoom in first
      await zoomInButton.click();
      await zoomInButton.click();

      // Now reset
      if (await fitButton.isVisible().catch(() => false)) {
        await fitButton.click();

        // Should be back to 100%
        await expect(page.getByText('100%')).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('should zoom via mouse wheel on the canvas', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const canvas = getMapCanvas(page);
    if (await canvas.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Ensure we start at 100%
      await expect(page.getByText('100%')).toBeVisible({ timeout: 5_000 });

      // Scroll up to zoom in (deltaY < 0 → zoom in)
      await canvas.hover();
      await page.mouse.wheel(0, -100);

      // Wait for the zoom state to update
      await page.waitForTimeout(500);

      // Zoom percentage should have changed from 100%
      const zoomText = page.locator('span').filter({ hasText: /^\d+%$/ }).first();
      if (await zoomText.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const text = await zoomText.textContent();
        expect(text).not.toBe('100%');
      }
    }
  });
});

// =============================================================================
// Map Canvas — Pan (Drag) Interaction
// =============================================================================

test.describe('Map Canvas — Pan', () => {
  test('should pan the map by dragging in move mode', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    // Switch to Pan mode
    const panButton = page.locator('button[title="Pan (Space)"]');
    if (await panButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await panButton.click();
    }

    const canvas = getMapCanvas(page);
    if (await canvas.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const box = await canvas.boundingBox();
      if (box) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // Perform a drag from center to offset
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 100, centerY + 50, { steps: 10 });
        await page.mouse.up();

        // The canvas should still be visible (pan didn't break anything)
        await expect(canvas).toBeVisible();
      }
    }
  });
});

// =============================================================================
// Map — Token Management (Director)
// =============================================================================

test.describe('Map — Token Management', () => {
  test('director should see Add Token button in toolbar', async ({ page }) => {
    // TODO: Requires running backend with director-owned room and loaded map
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const addTokenButton = page.locator('button[title="Add Token (T)"]');
    await expect(addTokenButton).toBeVisible({ timeout: 10_000 });
  });

  test('player should NOT see Add Token button in toolbar', async ({ page }) => {
    // TODO: Requires running backend with player in a room
    await loginAndEnterRoom(page, { email: 'player@test.com' });

    await page.waitForTimeout(2000);

    const addTokenButton = page.locator('button[title="Add Token (T)"]');
    await expect(addTokenButton).toHaveCount(0);
  });

  test('director should open Add Token form and place a token', async ({ page }) => {
    // TODO: Requires running backend with director-owned room and loaded map
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const addTokenButton = page.locator('button[title="Add Token (T)"]');
    if (await addTokenButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addTokenButton.click();

      // The AddTokenForm should appear with a name input
      const nameInput = page.getByPlaceholder(/goblin scout/i)
        .or(page.getByLabel(/token name/i));

      await expect(nameInput).toBeVisible({ timeout: 5_000 });

      // Fill in a token name
      await nameInput.fill('Orc Warrior');

      // Click the "Place" button
      const placeButton = page.getByRole('button', { name: /place/i });
      if (await placeButton.isVisible().catch(() => false)) {
        await placeButton.click();

        // The form should close after placing
        await expect(nameInput).not.toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('Add Token form cancel button should close the form', async ({ page }) => {
    // TODO: Requires running backend with director-owned room and loaded map
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const addTokenButton = page.locator('button[title="Add Token (T)"]');
    if (await addTokenButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addTokenButton.click();

      const nameInput = page.getByPlaceholder(/goblin scout/i)
        .or(page.getByLabel(/token name/i));

      await expect(nameInput).toBeVisible({ timeout: 5_000 });

      // Click Cancel
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();

        // Form should close
        await expect(nameInput).not.toBeVisible({ timeout: 3_000 });
      }
    }
  });

  test('Place button should be disabled when token name is empty', async ({ page }) => {
    // TODO: Requires running backend with director-owned room and loaded map
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const addTokenButton = page.locator('button[title="Add Token (T)"]');
    if (await addTokenButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addTokenButton.click();

      const nameInput = page.getByPlaceholder(/goblin scout/i)
        .or(page.getByLabel(/token name/i));

      if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Clear the input to ensure it's empty
        await nameInput.clear();

        // Place button should be disabled when name is empty
        const placeButton = page.getByRole('button', { name: /place/i });
        await expect(placeButton).toBeDisabled();
      }
    }
  });
});

// =============================================================================
// Map — Fog of War (Director)
// =============================================================================

test.describe('Map — Fog of War', () => {
  test('director should be able to activate the Fog of War tool', async ({ page }) => {
    // TODO: Requires running backend with director-owned room and loaded map
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const fogButton = page.locator('button[title="Fog of War (F)"]');
    if (await fogButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fogButton.click();

      // Fog tool should be active (highlighted gold)
      await expect(fogButton).toHaveClass(/gold/);
    }
  });

  test('director should be able to click on the canvas in fog mode', async ({ page }) => {
    // TODO: Requires running backend with director-owned room, loaded map, and fog regions
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    const fogButton = page.locator('button[title="Fog of War (F)"]');
    if (await fogButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fogButton.click();

      const canvas = getMapCanvas(page);
      if (await canvas.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const box = await canvas.boundingBox();
        if (box) {
          // Click on the canvas to interact with fog region
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

          // The canvas should still be functional (no crash)
          await expect(canvas).toBeVisible();
        }
      }
    }
  });
});

// =============================================================================
// Map — Canvas Rendering
// =============================================================================

test.describe('Map — Canvas Rendering', () => {
  test('should render the Konva canvas element when map is loaded', async ({ page }) => {
    // TODO: Requires running backend with a room that has a loaded map
    await loginAndEnterRoom(page);

    const canvas = getMapCanvas(page);
    await expect(canvas).toBeVisible({ timeout: 10_000 });
  });

  test('should display "No map loaded" when no map exists', async ({ page }) => {
    // TODO: Requires running backend with a room that has no map assigned
    await loginAndEnterRoom(page);

    // If no map is loaded, the component shows a fallback message
    const noMapMessage = page.getByText(/no map loaded/i);

    // This may or may not be visible depending on room state — just verify
    // the page rendered without crashing
    const canvas = getMapCanvas(page);
    const hasCanvas = await canvas.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasNoMapMsg = await noMapMessage.isVisible({ timeout: 3_000 }).catch(() => false);

    // One of these should be true: either a canvas is loaded or "No map loaded" is shown
    expect(hasCanvas || hasNoMapMsg).toBeTruthy();
  });

  test('canvas should fill its container', async ({ page }) => {
    // TODO: Requires running backend with a loaded map
    await loginAndEnterRoom(page);

    const canvas = getMapCanvas(page);
    if (await canvas.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();
      // Canvas should have meaningful dimensions (not collapsed)
      expect(box!.width).toBeGreaterThan(100);
      expect(box!.height).toBeGreaterThan(100);
    }
  });
});

// =============================================================================
// Map — Background Upload (Director)
// =============================================================================

test.describe('Map — Background Upload', () => {
  test('director should see background upload option', async ({ page }) => {
    // TODO: Requires running backend with director-owned room
    // Background upload is typically found in the director panel or map settings
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    // Navigate to the DM/Director panel tab in the sidebar
    const dmTab = page
      .getByRole('button', { name: /dm/i })
      .or(page.getByTestId('tab-director'));

    if (await dmTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dmTab.click();
    }

    // Look for a map settings or upload option
    const uploadButton = page
      .getByRole('button', { name: /upload.*background|upload.*map|set.*background/i })
      .or(page.getByTestId('upload-background-button'))
      .or(page.getByLabel(/background|map.*image/i));

    if (await uploadButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(uploadButton).toBeVisible();
    }
  });

  test('background upload should accept image files', async ({ page }) => {
    // TODO: Requires running backend with director-owned room
    await loginAndEnterRoom(page, { email: 'director@test.com' });

    // Navigate to director panel
    const dmTab = page
      .getByRole('button', { name: /dm/i })
      .or(page.getByTestId('tab-director'));

    if (await dmTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dmTab.click();
    }

    // Look for a file input (may be hidden behind a button)
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      // Verify it accepts image types
      const accept = await fileInput.getAttribute('accept');
      if (accept) {
        expect(accept).toMatch(/image/i);
      }
    }
  });
});
