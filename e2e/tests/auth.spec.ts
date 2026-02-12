import { test, expect } from '@playwright/test';
import { loginUser, loginViaApi, registerViaApi, isLoggedIn, logout } from '../helpers/auth';

// =============================================================================
// Auth E2E Tests — Login & Register flows
// =============================================================================

// Unique email per test run to avoid collisions
const timestamp = Date.now();

test.describe('Registration', () => {
  test('should register a new user and redirect to /login', async ({ page }) => {
    const email = `e2e-reg-${timestamp}@example.com`;

    await page.goto('/register');

    await page.getByLabel('Display Name').fill('E2E Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('TestPassword123!');

    await page.getByRole('button', { name: /Create Account/i }).click();

    // The register page redirects to /login on success
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('should show validation errors for short display name', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Display Name').fill('A');
    await page.getByLabel('Email').fill('valid@example.com');
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('TestPassword123!');

    await page.getByRole('button', { name: /Create Account/i }).click();

    // Client-side validation: display name must be >= 2 chars
    await expect(
      page.getByText(/display name must be at least 2 characters/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should show validation error when passwords do not match', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Display Name').fill('Mismatch User');
    await page.getByLabel('Email').fill('mismatch@example.com');
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('DifferentPassword!');

    await page.getByRole('button', { name: /Create Account/i }).click();

    await expect(
      page.getByText(/passwords do not match/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Login', () => {
  const loginEmail = `e2e-login-${timestamp}@example.com`;
  const loginPassword = 'TestPassword123!';

  test.beforeAll(async ({ browser }) => {
    // Seed a user for login tests via API
    const page = await browser.newPage();
    await page.goto('/login'); // need a page context to call request API
    await registerViaApi(page, {
      email: loginEmail,
      displayName: 'Login Tester',
      password: loginPassword,
    });
    await page.close();
  });

  test('should login with valid credentials and redirect to /lobby', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(loginEmail);
    await page.getByLabel('Password').fill(loginPassword);

    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/lobby/, { timeout: 15_000 });

    // Verify user display name is visible in the nav
    await expect(page.getByText('Login Tester')).toBeVisible({ timeout: 5_000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('WrongPassword123!');

    await page.getByRole('button', { name: /Sign In/i }).click();

    // The error div has crimson styling — check for any error text
    await expect(
      page.locator('.text-crimson-300'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate to register page via "Create one" link', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /Create one/i }).click();

    await expect(page).toHaveURL(/\/register/);
  });

  test('should navigate to login page via "Sign in" link from register', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('link', { name: /Sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Auth persistence', () => {
  const persistEmail = `e2e-persist-${timestamp}@example.com`;
  const persistPassword = 'TestPassword123!';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/login');
    await registerViaApi(page, {
      email: persistEmail,
      displayName: 'Persist Tester',
      password: persistPassword,
    });
    await page.close();
  });

  test('should stay on /lobby after page reload when logged in', async ({ page }) => {
    // Login via API (fast)
    await page.goto('/login');
    await loginViaApi(page, persistEmail, persistPassword);

    // Navigate to lobby
    await page.goto('/lobby');
    await expect(page).toHaveURL(/\/lobby/, { timeout: 10_000 });

    // Reload the page
    await page.reload();

    // Should still be on /lobby (token persisted in localStorage)
    await expect(page).toHaveURL(/\/lobby/, { timeout: 10_000 });

    // Verify still logged in
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);
  });
});

test.describe('Logout', () => {
  const logoutEmail = `e2e-logout-${timestamp}@example.com`;
  const logoutPassword = 'TestPassword123!';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/login');
    await registerViaApi(page, {
      email: logoutEmail,
      displayName: 'Logout Tester',
      password: logoutPassword,
    });
    await page.close();
  });

  test('should logout and redirect to /login', async ({ page }) => {
    // Login via UI to be on lobby
    await loginUser(page, logoutEmail, logoutPassword);
    await expect(page).toHaveURL(/\/lobby/, { timeout: 10_000 });

    // Click the Logout button in the lobby nav
    await page.getByRole('button', { name: /Logout/i }).click();

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
