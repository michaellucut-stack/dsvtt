import { type Page, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000';

// ─── UI-based helpers ────────────────────────────────────────────────────────

/** Register a new user via the UI form. */
export async function registerUser(
  page: Page,
  opts: { email: string; displayName: string; password: string },
): Promise<void> {
  await page.goto('/register');

  await page.getByLabel('Display Name').fill(opts.displayName);
  await page.getByLabel('Email').fill(opts.email);
  await page.getByLabel('Password', { exact: true }).fill(opts.password);
  await page.getByLabel('Confirm Password').fill(opts.password);

  await page.getByRole('button', { name: /Create Account/i }).click();
}

/** Login via the UI form and wait for redirect to /lobby. */
export async function loginUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await page.getByRole('button', { name: /Sign In/i }).click();

  // Wait for the redirect to lobby
  await expect(page).toHaveURL(/\/lobby/, { timeout: 15_000 });
}

// ─── API-based helpers (faster, for test setup) ─────────────────────────────

/** Register via API directly. Returns the userId. */
export async function registerViaApi(
  page: Page,
  opts: { email: string; displayName: string; password: string },
): Promise<string> {
  const res = await page.request.post(`${API_BASE}/api/auth/register`, {
    data: {
      displayName: opts.displayName,
      email: opts.email,
      password: opts.password,
    },
  });

  const body = await res.json();

  if (!res.ok()) {
    throw new Error(
      `Register API failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }

  const { user, tokens } = body.data ?? body;

  // Inject auth state into localStorage so the app picks it up
  await page.evaluate(
    ({ user: u, tokens: t }) => {
      const state = {
        state: {
          user: u,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(state));
    },
    { user, tokens },
  );

  return user.id;
}

/** Login via API directly and inject tokens into localStorage. */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });

  const body = await res.json();

  if (!res.ok()) {
    throw new Error(
      `Login API failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }

  const { user, tokens } = body.data ?? body;

  // Inject auth state into localStorage so the app picks it up
  await page.evaluate(
    ({ user: u, tokens: t }) => {
      const state = {
        state: {
          user: u,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(state));
    },
    { user, tokens },
  );
}

/** Check if the user is logged in by inspecting localStorage. */
export async function isLoggedIn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return Boolean(parsed?.state?.accessToken && parsed?.state?.user);
    } catch {
      return false;
    }
  });
}

/** Logout by clearing auth-storage from localStorage. */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('auth-storage');
  });
}
