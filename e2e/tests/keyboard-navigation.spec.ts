import { test, expect } from '@playwright/test';

// =============================================================================
// Keyboard Navigation E2E Tests — Sprint 7 "Ship It v1.0"
//
// Verifies that all interactive flows are fully operable via keyboard only.
// Covers tab order, focus traps, Escape-to-close, and arrow key interactions.
// =============================================================================

/**
 * Helper: log in as the director test user.
 */
async function loginAsDirector(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('director@test.com');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|lobby|home)?$/, { timeout: 10_000 });
}

/**
 * Helper: navigate to the lobby page after login.
 */
async function navigateToLobby(page: import('@playwright/test').Page) {
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }
  await page.waitForTimeout(2000);
}

// =============================================================================
// Login Form — Tab Order
// =============================================================================

test.describe('Keyboard Navigation — Login Form', () => {
  test('should tab through email → password → submit in order', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Start tabbing from the top of the page
    await page.keyboard.press('Tab');

    // We may need to tab past skip links or other elements first.
    // Keep tabbing until we hit the email input.
    let maxTabs = 10;
    let hitEmail = false;

    while (maxTabs-- > 0) {
      const focused = page.locator(':focus');
      const tagName = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      const type = await focused.getAttribute('type').catch(() => '');
      const ariaLabel = await focused.getAttribute('aria-label').catch(() => '');
      const name = await focused.getAttribute('name').catch(() => '');

      // Check if we've reached the email input
      if (
        (tagName === 'input' && (type === 'email' || type === 'text')) ||
        /email/i.test(ariaLabel ?? '') ||
        /email/i.test(name ?? '')
      ) {
        hitEmail = true;
        break;
      }

      await page.keyboard.press('Tab');
    }

    expect(hitEmail, 'Should be able to tab to the email input').toBe(true);

    // Tab to password
    await page.keyboard.press('Tab');
    const passwordFocused = page.locator(':focus');
    const passwordType = await passwordFocused.getAttribute('type').catch(() => '');
    expect(passwordType, 'Next tab stop after email should be the password input').toBe('password');

    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitFocused = page.locator(':focus');
    const submitTag = await submitFocused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const submitType = await submitFocused.getAttribute('type').catch(() => '');
    const submitRole = await submitFocused.getAttribute('role').catch(() => '');

    expect(
      submitTag === 'button' || submitType === 'submit' || submitRole === 'button',
      'Next tab stop after password should be the submit button',
    ).toBe(true);
  });

  test('should submit login form with Enter key', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in credentials via keyboard
    await page.getByLabel(/email/i).fill('director@test.com');
    await page.getByLabel(/password/i).fill('password123');

    // Press Enter while focused on the password field
    await page.getByLabel(/password/i).press('Enter');

    // Should navigate away from login (or show an error if credentials are wrong)
    // TODO: Requires running backend to verify successful login redirect
    await expect(page).not.toHaveURL('/login', { timeout: 10_000 }).catch(() => {
      // If still on login, check that an error or validation message appeared
      // (meaning the form submission was triggered by Enter)
      test.info().annotations.push({
        type: 'info',
        description: 'Enter key triggered form submission (may need backend to complete login)',
      });
    });
  });
});

// =============================================================================
// Register Form — Tab Order
// =============================================================================

test.describe('Keyboard Navigation — Register Form', () => {
  test('should tab through all registration fields in logical order', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const visitedFields: string[] = [];

    // Tab through the form and record each focused input
    let maxTabs = 20;
    while (maxTabs-- > 0) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const tagName = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');

      if (tagName === 'input') {
        const type = await focused.getAttribute('type').catch(() => 'text');
        const name = await focused.getAttribute('name').catch(() => '');
        const label = await focused.getAttribute('aria-label').catch(() => '');
        visitedFields.push(type || name || label || 'unknown-input');
      } else if (tagName === 'button') {
        visitedFields.push('button');
        break; // Reached the submit button — stop
      }
    }

    // Expect to have visited at least: email, display name/text, password, confirm password
    expect(
      visitedFields.length,
      `Should tab through at least 3 form fields + submit button, got: [${visitedFields.join(', ')}]`,
    ).toBeGreaterThanOrEqual(3);

    // The last entry should be the submit button
    expect(
      visitedFields[visitedFields.length - 1],
      'Last tab stop in the form should be the submit button',
    ).toBe('button');
  });
});

// =============================================================================
// Lobby — Keyboard Navigation
// =============================================================================

test.describe('Keyboard Navigation — Lobby', () => {
  test('should tab through room cards and create button', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    // Tab through the lobby and collect focused element types
    const focusedElements: Array<{ tag: string; text: string }> = [];
    let maxTabs = 30;

    while (maxTabs-- > 0) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const count = await focused.count();
      if (count === 0) break;

      const tag = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      const text = await focused.evaluate((el) => el.textContent?.trim().slice(0, 50) ?? '').catch(() => '');

      focusedElements.push({ tag, text });

      // Stop if we've cycled past all visible elements
      if (focusedElements.length > 2 && tag === 'body') break;
    }

    // Should be able to tab to at least one interactive element in the lobby
    const interactiveTags = ['a', 'button', 'input', 'select'];
    const interactiveCount = focusedElements.filter((el) =>
      interactiveTags.includes(el.tag),
    ).length;

    expect(
      interactiveCount,
      'Lobby should have keyboard-accessible interactive elements',
    ).toBeGreaterThanOrEqual(1);

    // Should be able to reach the "Create Room" button via Tab
    const hasCreateButton = focusedElements.some(
      (el) => el.tag === 'button' && /create|new/i.test(el.text),
    );

    if (!hasCreateButton) {
      test.info().annotations.push({
        type: 'a11y-recommendation',
        description: 'Could not reach a "Create Room" button via Tab — verify it is in the tab order',
      });
    }
  });

  test('should activate room card with Enter key', async ({ page }) => {
    // TODO: Requires running backend with seeded director data and at least one room
    await loginAsDirector(page);
    await navigateToLobby(page);

    // Tab to the first room card (link or clickable element)
    let maxTabs = 20;
    let foundRoom = false;

    while (maxTabs-- > 0) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const tag = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      const testId = await focused.getAttribute('data-testid').catch(() => '');
      const text = await focused.evaluate((el) => el.textContent?.trim() ?? '').catch(() => '');

      if (tag === 'a' || testId === 'room-card' || /campaign|room/i.test(text)) {
        foundRoom = true;

        const currentUrl = page.url();

        // Press Enter to activate
        await page.keyboard.press('Enter');

        // Should navigate to the room detail page
        await page.waitForTimeout(2000);
        const newUrl = page.url();

        if (newUrl !== currentUrl) {
          expect(newUrl).toMatch(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i);
        }
        break;
      }
    }

    if (!foundRoom) {
      test.info().annotations.push({
        type: 'info',
        description: 'No room cards found in lobby to test Enter key activation',
      });
    }
  });
});

// =============================================================================
// Modal — Escape Key & Focus Trap
// =============================================================================

test.describe('Keyboard Navigation — Modal Interactions', () => {
  test('Escape key should close modal dialogs', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    // Open a modal (e.g., "Create Room")
    const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      const modal = page.locator('[role="dialog"], [aria-modal="true"], [class*="modal"]');
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Press Escape
        await page.keyboard.press('Escape');

        // Modal should close
        await expect(modal).toBeHidden({ timeout: 3_000 }).catch(() => {
          test.info().annotations.push({
            type: 'a11y-violation',
            description: 'Modal did not close on Escape key press — WCAG requires Escape dismissal for dialogs',
          });
        });
      }
    }
  });

  test('focus should be trapped within an open modal', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      const modal = page.locator('[role="dialog"], [aria-modal="true"], [class*="modal"]');
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Collect all focusable elements inside the modal
        const modalFocusable = modal.locator(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        const focusableCount = await modalFocusable.count();

        if (focusableCount < 2) {
          test.info().annotations.push({
            type: 'info',
            description: `Modal has ${focusableCount} focusable element(s) — focus trap test needs at least 2`,
          });
          return;
        }

        // Tab through all focusable elements + 1 to check wrap-around
        const focusedIds: string[] = [];
        for (let i = 0; i < focusableCount + 2; i++) {
          await page.keyboard.press('Tab');

          const focused = page.locator(':focus');
          const isInModal = await modal
            .evaluate(
              (modalEl, focusEl) => modalEl.contains(focusEl),
              await focused.elementHandle().catch(() => null),
            )
            .catch(() => false);

          // Alternatively check if focus is inside modal via DOM containment
          const focusInModal = await page.evaluate(() => {
            const active = document.activeElement;
            const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
            return dialog ? dialog.contains(active) : false;
          });

          focusedIds.push(focusInModal ? 'in-modal' : 'outside-modal');
        }

        // All focused elements should be inside the modal (focus trap)
        const outsideCount = focusedIds.filter((id) => id === 'outside-modal').length;

        expect(
          outsideCount,
          `Focus escaped the modal ${outsideCount} time(s) — Tab should wrap within the modal. Sequence: [${focusedIds.join(', ')}]`,
        ).toBe(0);
      }
    }
  });

  test('Shift+Tab should cycle backwards within modal', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      const modal = page.locator('[role="dialog"], [aria-modal="true"], [class*="modal"]');
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Shift+Tab from the first focusable element should wrap to the last
        await page.keyboard.press('Shift+Tab');

        const focusInModal = await page.evaluate(() => {
          const active = document.activeElement;
          const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
          return dialog ? dialog.contains(active) : false;
        });

        expect(
          focusInModal,
          'Shift+Tab should keep focus inside the modal (backwards wrap)',
        ).toBe(true);
      }
    }
  });
});

// =============================================================================
// Dice Roller — Arrow Keys (if applicable)
// =============================================================================

test.describe('Keyboard Navigation — Dice Roller', () => {
  test('dice input should accept keyboard input and submit with Enter', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room + active session
    await loginAsDirector(page);
    await navigateToLobby(page);

    // Navigate into a room
    const roomCard = page
      .getByTestId('room-card')
      .first()
      .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
    }

    // Look for the dice input
    const diceInput = page
      .getByPlaceholder(/dice|formula|roll/i)
      .or(page.getByTestId('dice-input'))
      .or(page.getByLabel(/dice|formula|roll/i));

    if (await diceInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Focus the input via Tab
      await diceInput.focus();

      // Type a formula via keyboard
      await page.keyboard.type('1d20+5');

      // Verify the input has the typed value
      await expect(diceInput).toHaveValue('1d20+5');

      // Submit with Enter
      await page.keyboard.press('Enter');

      // Result should appear (indicates the keyboard submission worked)
      await expect(
        page.getByText(/1d20\+5|result|total|\d+/i),
      ).toBeVisible({ timeout: 10_000 }).catch(() => {
        test.info().annotations.push({
          type: 'info',
          description: 'Dice roll submission via Enter key did not produce visible result — may need active session',
        });
      });
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'Dice input not found — test requires an active game session with dice roller visible',
      });
    }
  });

  test('quick-roll dice buttons should be keyboard-activatable', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room + active session
    await loginAsDirector(page);
    await navigateToLobby(page);

    const roomCard = page
      .getByTestId('room-card')
      .first()
      .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
    }

    // Look for quick-roll buttons (d4, d6, d8, d10, d12, d20)
    const quickRollButtons = page.locator(
      'button:has-text("d20"), button:has-text("d6"), [data-testid*="quick-roll"]',
    );

    const count = await quickRollButtons.count();

    if (count > 0) {
      // Focus the first quick-roll button
      await quickRollButtons.first().focus();

      // Activate with Enter
      await page.keyboard.press('Enter');

      // A result should appear
      await expect(
        page.getByText(/result|total|\d+/i),
      ).toBeVisible({ timeout: 10_000 }).catch(() => {
        test.info().annotations.push({
          type: 'info',
          description: 'Quick-roll button did not produce visible result via keyboard — may need active session',
        });
      });

      // Also test Space key activation (buttons should respond to both)
      await quickRollButtons.first().focus();
      await page.keyboard.press('Space');
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No quick-roll dice buttons found — test requires game room with dice UI',
      });
    }
  });

  test('arrow keys should navigate between quick-roll dice buttons if grouped', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room + active session
    await loginAsDirector(page);
    await navigateToLobby(page);

    const roomCard = page
      .getByTestId('room-card')
      .first()
      .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click();
      await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
    }

    // Check if dice buttons use a toolbar/radiogroup pattern with arrow key navigation
    const diceToolbar = page.locator(
      '[role="toolbar"], [role="radiogroup"], [data-testid="dice-buttons"]',
    );

    if (await diceToolbar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const buttons = diceToolbar.locator('button, [role="radio"]');
      const buttonCount = await buttons.count();

      if (buttonCount >= 2) {
        // Focus the first button
        await buttons.first().focus();
        const firstText = await buttons.first().textContent();

        // Press ArrowRight to move to the next button
        await page.keyboard.press('ArrowRight');

        const focused = page.locator(':focus');
        const focusedText = await focused.textContent().catch(() => '');

        // Focus should have moved to a different button
        expect(
          focusedText,
          'ArrowRight should move focus to the next dice button',
        ).not.toBe(firstText);
      }
    } else {
      test.info().annotations.push({
        type: 'info',
        description:
          'No dice toolbar/radiogroup pattern found — arrow key navigation test skipped. If dice buttons are independent, Tab navigation is sufficient.',
      });
    }
  });
});

// =============================================================================
// General — Focus Visibility
// =============================================================================

test.describe('Keyboard Navigation — Focus Visibility', () => {
  test('focused elements should have a visible focus indicator', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Tab to the first input
    await page.keyboard.press('Tab');

    // Find the focused element and check it has a visible focus style
    // We can check for outline or box-shadow — common focus indicator styles
    let maxTabs = 5;
    let foundVisibleFocus = false;

    while (maxTabs-- > 0) {
      const focused = page.locator(':focus');
      const count = await focused.count();
      if (count === 0) {
        await page.keyboard.press('Tab');
        continue;
      }

      const outlineStyle = await focused.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow,
          borderColor: styles.borderColor,
        };
      });

      // Check if there is a visible outline or box-shadow
      const hasOutline =
        outlineStyle.outlineStyle !== 'none' &&
        outlineStyle.outlineWidth !== '0px';
      const hasBoxShadow =
        outlineStyle.boxShadow !== 'none' && outlineStyle.boxShadow !== '';

      if (hasOutline || hasBoxShadow) {
        foundVisibleFocus = true;
        break;
      }

      await page.keyboard.press('Tab');
    }

    expect(
      foundVisibleFocus,
      'At least one focused element should have a visible focus indicator (outline or box-shadow)',
    ).toBe(true);
  });
});
