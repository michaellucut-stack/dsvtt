import { type Page, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000';

/** Helper to get the auth token from localStorage. */
async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.state?.accessToken ?? null;
    } catch {
      return null;
    }
  });

  if (!token) {
    throw new Error('No auth token found in localStorage. Login first.');
  }

  return token;
}

/** Create a room via the API. Returns the roomId. */
export async function createRoomViaApi(
  page: Page,
  name: string,
  maxPlayers = 4,
): Promise<string> {
  const token = await getAuthToken(page);

  const res = await page.request.post(`${API_BASE}/api/rooms`, {
    data: { name, maxPlayers },
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();

  if (!res.ok()) {
    throw new Error(
      `Create room API failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }

  const room = body.data ?? body;
  return room.id;
}

/** Navigate to a room detail page in the lobby. */
export async function navigateToRoom(
  page: Page,
  roomId: string,
): Promise<void> {
  await page.goto(`/lobby/rooms/${roomId}`);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible({
    timeout: 10_000,
  });
}

/** Join a room via the API. */
export async function joinRoomViaApi(
  page: Page,
  roomId: string,
): Promise<void> {
  const token = await getAuthToken(page);

  const res = await page.request.post(`${API_BASE}/api/rooms/${roomId}/join`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Join room API failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }
}

/** Start a game via the API. */
export async function startGameViaApi(
  page: Page,
  roomId: string,
): Promise<void> {
  const token = await getAuthToken(page);

  const res = await page.request.post(
    `${API_BASE}/api/rooms/${roomId}/sessions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Start game API failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }
}
