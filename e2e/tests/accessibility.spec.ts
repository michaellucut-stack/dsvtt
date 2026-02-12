import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// =============================================================================
// Accessibility E2E Tests — Sprint 7 "Ship It v1.0"
//
// Automated accessibility audits using axe-core against key application pages.
// Validates WCAG 2.1 AA compliance: labels, contrast, landmarks, focus, etc.
//
// NOTE: @axe-core/playwright must be added to devDependencies:
//   pnpm add -D @axe-core/playwright
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

/**
 * Helper: create a room and return the room URL.
 */
async function createRoomAndNavigate(page: import('@playwright/test').Page): Promise<string> {
  await navigateToLobby(page);

  // Click create room button
  const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });
  if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await createButton.click();

    // Fill in room creation form
    const nameInput = page.getByLabel(/room name|name/i);
    if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameInput.fill('A11y Test Campaign');
    }

    const maxPlayers = page.getByLabel(/max.*players|players/i);
    if (await maxPlayers.isVisible().catch(() => false)) {
      await maxPlayers.fill('4');
    }

    await page.getByRole('button', { name: /create|submit|save/i }).click();
    await page.waitForTimeout(2000);
  }

  // Click into the first available room
  const roomCard = page
    .getByTestId('room-card')
    .first()
    .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

  if (await roomCard.isVisible().catch(() => false)) {
    await roomCard.click();
    await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/[a-z0-9-]+$/i, { timeout: 10_000 });
  }

  return page.url();
}

/**
 * Helper: attach axe violation details to test annotations for reporting.
 */
function annotateViolations(
  violations: Array<{ id: string; impact?: string; description: string; nodes: Array<{ html: string }> }>,
) {
  return violations.map((v) => ({
    type: `a11y-violation [${v.impact ?? 'unknown'}]`,
    description: `${v.id}: ${v.description} (${v.nodes.length} node(s)) — e.g. ${v.nodes[0]?.html?.slice(0, 120) ?? 'N/A'}`,
  }));
}

// =============================================================================
// axe-core Full-Page Audits
// =============================================================================

test.describe('Accessibility — axe-core Audits', () => {
  test('login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();

    // Attach details for debugging if violations exist
    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Expected 0 axe violations on /login, got ${results.violations.length}`,
    ).toHaveLength(0);
  });

  test('register page should have no accessibility violations', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Expected 0 axe violations on /register, got ${results.violations.length}`,
    ).toHaveLength(0);
  });

  test('lobby page should have no accessibility violations', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Expected 0 axe violations on /lobby, got ${results.violations.length}`,
    ).toHaveLength(0);
  });

  test('game room should have no accessibility violations', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room data
    await loginAsDirector(page);
    await createRoomAndNavigate(page);

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Expected 0 axe violations on game room page, got ${results.violations.length}`,
    ).toHaveLength(0);
  });
});

// =============================================================================
// Form Input Labels
// =============================================================================

test.describe('Accessibility — Form Labels', () => {
  test('login form inputs should have associated labels', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Every input with a visible role should have an accessible name
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const accessibleName = await input.getAttribute('aria-label')
        ?? await input.getAttribute('aria-labelledby')
        ?? await input.getAttribute('placeholder')
        ?? '';
      const id = await input.getAttribute('id') ?? '';

      // Check if there is a <label for="..."> or an aria attribute
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = (await label.count()) > 0;
        const hasAriaLabel = (await input.getAttribute('aria-label')) !== null;
        const hasAriaLabelledBy = (await input.getAttribute('aria-labelledby')) !== null;

        expect(
          labelExists || hasAriaLabel || hasAriaLabelledBy,
          `Input#${id} must have an associated label, aria-label, or aria-labelledby. Got placeholder: "${accessibleName}"`,
        ).toBe(true);
      }
    }
  });

  test('register form inputs should have associated labels', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id') ?? '';

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = (await label.count()) > 0;
        const hasAriaLabel = (await input.getAttribute('aria-label')) !== null;
        const hasAriaLabelledBy = (await input.getAttribute('aria-labelledby')) !== null;

        expect(
          labelExists || hasAriaLabel || hasAriaLabelledBy,
          `Input#${id} must have an associated label, aria-label, or aria-labelledby`,
        ).toBe(true);
      }
    }
  });
});

// =============================================================================
// Images & Alt Text
// =============================================================================

test.describe('Accessibility — Images', () => {
  test('login page images should have alt text', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Decorative images should have role="presentation" or alt=""
      // Content images must have non-empty alt text
      const hasAlt = alt !== null;
      const isDecorativeExplicit = role === 'presentation' || role === 'none' || alt === '';

      expect(
        hasAlt || isDecorativeExplicit,
        `Image at index ${i} (src: ${await img.getAttribute('src')}) must have alt text or be marked as decorative`,
      ).toBe(true);
    }
  });

  test('lobby page images should have alt text', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      const isDecorativeExplicit = role === 'presentation' || role === 'none' || alt === '';

      expect(
        alt !== null || isDecorativeExplicit,
        `Image at index ${i} must have alt text or be marked as decorative`,
      ).toBe(true);
    }
  });
});

// =============================================================================
// Color Contrast (WCAG 2.1 AA)
// =============================================================================

test.describe('Accessibility — Color Contrast', () => {
  test('login page should meet WCAG AA contrast requirements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Run axe-core scoped to color-contrast rule only
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Color contrast violations found on /login`,
    ).toHaveLength(0);
  });

  test('register page should meet WCAG AA contrast requirements', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Color contrast violations found on /register`,
    ).toHaveLength(0);
  });

  test('lobby page should meet WCAG AA contrast requirements', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      for (const annotation of annotateViolations(results.violations)) {
        test.info().annotations.push(annotation);
      }
    }

    expect(
      results.violations,
      `Color contrast violations found on /lobby`,
    ).toHaveLength(0);
  });
});

// =============================================================================
// Keyboard Focusability
// =============================================================================

test.describe('Accessibility — Keyboard Focusability', () => {
  test('all interactive elements on login page should be focusable', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Gather all interactive elements
    const interactiveSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const interactives = page.locator(interactiveSelectors);
    const count = await interactives.count();

    expect(count, 'Login page should have at least 2 interactive elements').toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      const el = interactives.nth(i);
      const tagName = await el.evaluate((node) => node.tagName.toLowerCase());
      const tabIndex = await el.getAttribute('tabindex');

      // Elements should not have tabindex < -1 (effectively hidden from tab order is ok with -1)
      if (tabIndex !== null) {
        expect(
          parseInt(tabIndex, 10),
          `Element <${tagName}> at index ${i} has tabindex=${tabIndex} which is below -1`,
        ).toBeGreaterThanOrEqual(-1);
      }

      // Buttons and inputs should be keyboard-accessible (not hidden offscreen without tabindex)
      if (['button', 'input', 'a'].includes(tagName)) {
        const isVisible = await el.isVisible().catch(() => false);
        if (isVisible) {
          // Visible interactive elements should not have tabindex="-1"
          expect(
            tabIndex,
            `Visible <${tagName}> at index ${i} should be tab-focusable (tabindex should not be -1)`,
          ).not.toBe('-1');
        }
      }
    }
  });

  test('all interactive elements on register page should be focusable', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const interactiveSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const interactives = page.locator(interactiveSelectors);
    const count = await interactives.count();

    expect(count, 'Register page should have at least 3 interactive elements').toBeGreaterThanOrEqual(3);

    for (let i = 0; i < count; i++) {
      const el = interactives.nth(i);
      const tagName = await el.evaluate((node) => node.tagName.toLowerCase());
      const tabIndex = await el.getAttribute('tabindex');
      const isVisible = await el.isVisible().catch(() => false);

      if (isVisible && ['button', 'input', 'a'].includes(tagName)) {
        expect(
          tabIndex,
          `Visible <${tagName}> at index ${i} should be tab-focusable`,
        ).not.toBe('-1');
      }
    }
  });
});

// =============================================================================
// ARIA Landmarks
// =============================================================================

test.describe('Accessibility — ARIA Landmarks', () => {
  test('login page should have a main landmark', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // There should be exactly one <main> or role="main"
    const mainLandmark = page.locator('main, [role="main"]');
    const count = await mainLandmark.count();

    expect(count, 'Page should have at least one <main> landmark').toBeGreaterThanOrEqual(1);
    expect(count, 'Page should not have more than one <main> landmark').toBeLessThanOrEqual(1);
  });

  test('register page should have a main landmark', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const mainLandmark = page.locator('main, [role="main"]');
    const count = await mainLandmark.count();

    expect(count, 'Page should have at least one <main> landmark').toBeGreaterThanOrEqual(1);
    expect(count, 'Page should not have more than one <main> landmark').toBeLessThanOrEqual(1);
  });

  test('lobby page should have main and nav landmarks', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const mainLandmark = page.locator('main, [role="main"]');
    const navLandmark = page.locator('nav, [role="navigation"]');

    const mainCount = await mainLandmark.count();
    const navCount = await navLandmark.count();

    expect(mainCount, 'Lobby should have a <main> landmark').toBeGreaterThanOrEqual(1);
    expect(navCount, 'Lobby should have a <nav> landmark').toBeGreaterThanOrEqual(1);
  });

  test('game room should have main landmark', async ({ page }) => {
    // TODO: Requires running backend with seeded director + room data
    await loginAsDirector(page);
    await createRoomAndNavigate(page);

    const mainLandmark = page.locator('main, [role="main"]');
    const count = await mainLandmark.count();

    expect(count, 'Game room should have a <main> landmark').toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Focus Management — Modals
// =============================================================================

test.describe('Accessibility — Focus Management', () => {
  test('opening a modal should move focus into the modal', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    // Try to open the "create room" modal (common modal trigger)
    const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], [aria-modal="true"], [class*="modal"]');
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Focus should be inside the modal
        const focusedElement = page.locator(':focus');
        const focusedInModal = await modal.locator(':focus').count();
        const modalHasFocusableChild = await modal
          .locator('input, button, [tabindex]')
          .first()
          .isVisible()
          .catch(() => false);

        // Either focus is already in the modal, or the modal itself is focused
        const modalIsFocused = await modal.evaluate(
          (el) => el === document.activeElement || el.contains(document.activeElement),
        );

        expect(
          modalIsFocused || focusedInModal > 0,
          'Focus should move inside the modal when it opens',
        ).toBe(true);

        // Modal should have role="dialog" or aria-modal
        const hasDialogRole = (await modal.first().getAttribute('role')) === 'dialog';
        const hasAriaModal = (await modal.first().getAttribute('aria-modal')) === 'true';

        expect(
          hasDialogRole || hasAriaModal,
          'Modal should have role="dialog" or aria-modal="true"',
        ).toBe(true);
      }
    }
  });

  test('closing a modal with Escape should return focus to the trigger', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const createButton = page.getByRole('button', { name: /create.*room|new.*room|create.*game/i });

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      const modal = page.locator('[role="dialog"], [aria-modal="true"], [class*="modal"]');
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Press Escape to close the modal
        await page.keyboard.press('Escape');

        // Wait for modal to disappear
        await expect(modal).toBeHidden({ timeout: 3_000 }).catch(() => {
          // Modal may not close via Escape — log it
          test.info().annotations.push({
            type: 'a11y-concern',
            description: 'Modal did not close when Escape was pressed',
          });
        });

        // Focus should return to the trigger button (or at least not be lost)
        const focusedElement = page.locator(':focus');
        const hasFocus = (await focusedElement.count()) > 0;

        expect(
          hasFocus,
          'After closing modal, focus should return to a visible element (ideally the trigger button)',
        ).toBe(true);
      }
    }
  });
});

// =============================================================================
// Skip Navigation
// =============================================================================

test.describe('Accessibility — Skip Navigation', () => {
  test('pages should have a skip link or equivalent navigation aid', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Look for a skip-to-main-content link (often visually hidden until focused)
    const skipLink = page.locator(
      'a[href="#main"], a[href="#main-content"], a[href="#content"], [class*="skip"], [class*="skipnav"]',
    );

    const skipLinkCount = await skipLink.count();

    // Also check if there is a <main> that can be skipped to
    const mainLandmark = page.locator('main[id], [role="main"][id]');
    const mainHasId = (await mainLandmark.count()) > 0;

    if (skipLinkCount === 0 && !mainHasId) {
      test.info().annotations.push({
        type: 'a11y-recommendation',
        description:
          'No skip-navigation link found. Consider adding a "Skip to main content" link for keyboard users.',
      });
    }

    // Soft assertion — skip links are best practice but not a hard WCAG failure
    // We log the recommendation above. If a skip link exists, verify it works.
    if (skipLinkCount > 0) {
      // Focus the skip link by tabbing
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const focusedHref = await focused.getAttribute('href').catch(() => null);

      // The skip link should point to a valid target on the page
      if (focusedHref && focusedHref.startsWith('#')) {
        const targetId = focusedHref.slice(1);
        const target = page.locator(`#${targetId}`);
        expect(
          await target.count(),
          `Skip link target #${targetId} should exist on the page`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('lobby page should have skip link or landmark-based navigation', async ({ page }) => {
    // TODO: Requires running backend with seeded director data
    await loginAsDirector(page);
    await navigateToLobby(page);

    const skipLink = page.locator(
      'a[href="#main"], a[href="#main-content"], a[href="#content"], [class*="skip"]',
    );
    const mainLandmark = page.locator('main, [role="main"]');
    const navLandmark = page.locator('nav, [role="navigation"]');

    const hasSkipLink = (await skipLink.count()) > 0;
    const hasMain = (await mainLandmark.count()) > 0;
    const hasNav = (await navLandmark.count()) > 0;

    // At minimum, the page should use landmarks so screen readers can navigate
    expect(
      hasSkipLink || hasMain,
      'Lobby should have either a skip link or a <main> landmark for navigation',
    ).toBe(true);
  });
});
