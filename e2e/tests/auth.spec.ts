import { test, expect } from '@playwright/test';

// =============================================================================
// Auth E2E Tests — Login & Register flows
// =============================================================================

test.describe('Registration', () => {
  test('should register a new user and redirect to dashboard', async ({ page }) => {
    await page.goto('/register');

    // Fill the registration form
    await page.getByLabel(/email/i).fill('e2e-user@example.com');
    await page.getByLabel(/display name/i).fill('E2E Tester');
    await page.getByLabel(/^password$/i).fill('TestPassword123!');
    await page.getByLabel(/confirm password/i).fill('TestPassword123!');

    // Submit the form
    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Verify redirect to dashboard or home
    await expect(page).toHaveURL(/\/(dashboard|home)?$/);

    // Verify the user is shown as logged in
    await expect(
      page.getByText(/e2e tester|e2e-user/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Expect validation messages
    await expect(page.getByText(/email/i)).toBeVisible();
    await expect(page.getByText(/password/i)).toBeVisible();
  });

  test('should show error for duplicate email', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill('existing@example.com');
    await page.getByLabel(/display name/i).fill('Existing User');
    await page.getByLabel(/^password$/i).fill('TestPassword123!');
    await page.getByLabel(/confirm password/i).fill('TestPassword123!');

    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Should display an error about the email being taken
    await expect(
      page.getByText(/already|taken|exists|in use/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Login', () => {
  test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill the login form
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');

    // Submit the form
    await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();

    // Verify redirect to dashboard or home
    await expect(page).toHaveURL(/\/(dashboard|home)?$/, { timeout: 10_000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('WrongPassword!');

    await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();

    // Should display an auth error
    await expect(
      page.getByText(/invalid|incorrect|wrong|failed/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();

    // Expect validation messages
    await expect(page.getByText(/email|required/i)).toBeVisible();
  });

  test('should navigate to register page from login', async ({ page }) => {
    await page.goto('/login');

    // Click the register / sign-up link
    await page.getByRole('link', { name: /register|sign\s?up|create account/i }).click();

    await expect(page).toHaveURL(/\/register/);
  });
});
