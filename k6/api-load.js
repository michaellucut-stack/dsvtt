/**
 * DSVTT - Digital Storytelling Virtual Tabletop
 * k6 API Load Test Script
 *
 * Tests REST API endpoints under load with 50 concurrent virtual users.
 * Covers authentication, room CRUD, dice rolling, and chat messaging.
 *
 * Usage:
 *   k6 run k6/api-load.js
 *   k6 run k6/api-load.js --env BASE_URL=http://staging.example.com:4000
 *
 * Thresholds:
 *   - HTTP request p95 latency < 500ms
 *   - HTTP error rate < 1%
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base URL for the API server, configurable via environment variable. */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

/** Tracks the rate of failed HTTP requests across all endpoints. */
const errorRate = new Rate('errors');

/** Tracks response time for auth endpoints. */
const authDuration = new Trend('auth_duration', true);

/** Tracks response time for room endpoints. */
const roomDuration = new Trend('room_duration', true);

/** Tracks response time for dice roll endpoints. */
const diceDuration = new Trend('dice_duration', true);

/** Tracks response time for chat endpoints. */
const chatDuration = new Trend('chat_duration', true);

// ---------------------------------------------------------------------------
// k6 options — load profile and thresholds
// ---------------------------------------------------------------------------

export const options = {
  /**
   * Load stages:
   * 1. Ramp up from 0 to 50 VUs over 2 minutes
   * 2. Sustain 50 VUs for 5 minutes
   * 3. Ramp down to 0 VUs over 1 minute
   */
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '1m', target: 0 },
  ],

  /** Performance thresholds — test fails if any threshold is breached. */
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
    auth_duration: ['p(95)<500'],
    room_duration: ['p(95)<500'],
    dice_duration: ['p(95)<500'],
    chat_duration: ['p(95)<500'],
  },
};

// ---------------------------------------------------------------------------
// Helper: standard HTTP headers
// ---------------------------------------------------------------------------

/**
 * Returns common request headers with JSON content type and optional
 * Bearer authorization.
 *
 * @param {string} [token] - JWT access token for authenticated requests.
 * @returns {object} Headers object for k6 http calls.
 */
function headers(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Helper: unique test user per VU
// ---------------------------------------------------------------------------

/**
 * Generates a unique email for the current VU and iteration to avoid
 * registration conflicts across concurrent virtual users.
 *
 * @returns {string} A unique email address.
 */
function uniqueEmail() {
  return `k6-vu${__VU}-iter${__ITER}-${Date.now()}@loadtest.local`;
}

// ---------------------------------------------------------------------------
// Setup — runs once before VU code
// ---------------------------------------------------------------------------

/**
 * Registers a shared test user and returns auth tokens + user data that
 * each VU can reference (though each VU will also register its own user
 * for isolation).
 *
 * Also creates a shared room and session that VUs can interact with.
 *
 * @returns {object} Setup data containing shared auth tokens, room ID, and session ID.
 */
export function setup() {
  // 1. Verify the server is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  const healthOk = check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check body ok': (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
  });

  if (!healthOk) {
    console.error('Server health check failed — aborting load test.');
    return { error: true };
  }

  // 2. Register a shared director user for room setup
  const directorEmail = `k6-director-${Date.now()}@loadtest.local`;
  const directorPassword = 'K6LoadTest!2024';

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: directorEmail,
      password: directorPassword,
      displayName: 'K6 Director',
    }),
    { headers: headers() },
  );

  const registerOk = check(registerRes, {
    'setup: register status is 201': (r) => r.status === 201,
  });

  if (!registerOk) {
    console.error(`Setup registration failed: ${registerRes.status} ${registerRes.body}`);
    return { error: true };
  }

  const registerData = JSON.parse(registerRes.body);
  const directorToken = registerData.data.tokens.accessToken;
  const directorRefreshToken = registerData.data.tokens.refreshToken;
  const directorId = registerData.data.user.id;

  // 3. Create a shared room
  const createRoomRes = http.post(
    `${BASE_URL}/api/rooms`,
    JSON.stringify({ name: 'K6 Load Test Room', maxPlayers: 50 }),
    { headers: headers(directorToken) },
  );

  const createRoomOk = check(createRoomRes, {
    'setup: create room status is 201': (r) => r.status === 201,
  });

  if (!createRoomOk) {
    console.error(`Setup room creation failed: ${createRoomRes.status} ${createRoomRes.body}`);
    return { error: true };
  }

  const roomData = JSON.parse(createRoomRes.body);
  const sharedRoomId = roomData.data.id;

  // 4. Start a game session in the shared room
  const sessionRes = http.post(
    `${BASE_URL}/api/rooms/${sharedRoomId}/sessions`,
    null,
    { headers: headers(directorToken) },
  );

  let sharedSessionId = null;
  if (sessionRes.status === 201) {
    const sessionData = JSON.parse(sessionRes.body);
    sharedSessionId = sessionData.data.id;
  } else {
    console.warn(`Setup session creation returned ${sessionRes.status} — dice/chat tests may skip.`);
  }

  console.log(`Setup complete: room=${sharedRoomId}, session=${sharedSessionId}`);

  return {
    error: false,
    directorEmail,
    directorPassword,
    directorToken,
    directorRefreshToken,
    directorId,
    sharedRoomId,
    sharedSessionId,
  };
}

// ---------------------------------------------------------------------------
// VU Code — main test scenarios
// ---------------------------------------------------------------------------

/**
 * Main VU function. Each virtual user runs through the full API scenario:
 * auth flow, room CRUD, dice rolls, and chat messages.
 *
 * @param {object} data - Setup data passed from the setup() function.
 */
export default function (data) {
  if (data.error) {
    console.error('Setup failed — skipping VU iteration.');
    sleep(1);
    return;
  }

  // ── Auth Endpoints ────────────────────────────────────────────────
  let vuToken;
  let vuRefreshToken;

  group('Auth - Register', () => {
    const email = uniqueEmail();
    const res = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({
        email: email,
        password: 'LoadTest!Pass123',
        displayName: `VU${__VU} User`,
      }),
      { headers: headers() },
    );

    authDuration.add(res.timings.duration);

    const ok = check(res, {
      'register: status is 201': (r) => r.status === 201,
      'register: response has tokens': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.tokens && body.data.tokens.accessToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);

    if (ok) {
      const body = JSON.parse(res.body);
      vuToken = body.data.tokens.accessToken;
      vuRefreshToken = body.data.tokens.refreshToken;
    }
  });

  sleep(0.5);

  group('Auth - Login', () => {
    // Login with the director credentials (shared, known-good account)
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: data.directorEmail,
        password: data.directorPassword,
      }),
      { headers: headers() },
    );

    authDuration.add(res.timings.duration);

    const ok = check(res, {
      'login: status is 200': (r) => r.status === 200,
      'login: response has tokens': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.tokens && body.data.tokens.accessToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Auth - Refresh Token', () => {
    if (!vuRefreshToken) {
      console.warn(`VU${__VU}: skipping refresh — no refresh token available`);
      return;
    }

    const res = http.post(
      `${BASE_URL}/api/auth/refresh`,
      JSON.stringify({ refreshToken: vuRefreshToken }),
      { headers: headers() },
    );

    authDuration.add(res.timings.duration);

    const ok = check(res, {
      'refresh: status is 200': (r) => r.status === 200,
      'refresh: response has new tokens': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.tokens;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);

    if (ok) {
      const body = JSON.parse(res.body);
      vuToken = body.data.tokens.accessToken;
      vuRefreshToken = body.data.tokens.refreshToken;
    }
  });

  sleep(0.3);

  // Guard: skip remaining tests if we don't have a valid token
  if (!vuToken) {
    console.warn(`VU${__VU}: no valid token — skipping authenticated endpoints`);
    sleep(1);
    return;
  }

  // ── Room CRUD Endpoints ───────────────────────────────────────────

  let vuRoomId;

  group('Room - Create', () => {
    const res = http.post(
      `${BASE_URL}/api/rooms`,
      JSON.stringify({
        name: `VU${__VU} Room ${Date.now()}`,
        maxPlayers: 6,
      }),
      { headers: headers(vuToken) },
    );

    roomDuration.add(res.timings.duration);

    const ok = check(res, {
      'create room: status is 201': (r) => r.status === 201,
      'create room: response has room id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.id;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);

    if (ok) {
      const body = JSON.parse(res.body);
      vuRoomId = body.data.id;
    }
  });

  sleep(0.3);

  group('Room - List', () => {
    const res = http.get(`${BASE_URL}/api/rooms`, {
      headers: headers(vuToken),
    });

    roomDuration.add(res.timings.duration);

    const ok = check(res, {
      'list rooms: status is 200': (r) => r.status === 200,
      'list rooms: response has data array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.ok === true && body.data;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Room - Get Detail', () => {
    const roomId = vuRoomId || data.sharedRoomId;
    const res = http.get(`${BASE_URL}/api/rooms/${roomId}`, {
      headers: headers(vuToken),
    });

    roomDuration.add(res.timings.duration);

    const ok = check(res, {
      'room detail: status is 200': (r) => r.status === 200,
      'room detail: response has room': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.ok === true && body.data;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Room - Join Shared Room', () => {
    const res = http.post(
      `${BASE_URL}/api/rooms/${data.sharedRoomId}/join`,
      JSON.stringify({ role: 'player' }),
      { headers: headers(vuToken) },
    );

    roomDuration.add(res.timings.duration);

    const ok = check(res, {
      'join room: status is 200 or 409 (already joined)': (r) =>
        r.status === 200 || r.status === 409,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Room - Leave Shared Room', () => {
    const res = http.post(
      `${BASE_URL}/api/rooms/${data.sharedRoomId}/leave`,
      null,
      { headers: headers(vuToken) },
    );

    roomDuration.add(res.timings.duration);

    const ok = check(res, {
      'leave room: status is 200 or 404 (not a member)': (r) =>
        r.status === 200 || r.status === 404,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── Dice Rolling Endpoint ─────────────────────────────────────────

  group('Dice - Roll', () => {
    if (!data.sharedSessionId) {
      console.warn(`VU${__VU}: skipping dice roll — no session available`);
      return;
    }

    const formulas = ['1d20', '2d6+3', '4d6kh3', '1d100', '3d8+5', '1d20+7'];
    const formula = formulas[Math.floor(Math.random() * formulas.length)];

    const res = http.post(
      `${BASE_URL}/api/sessions/${data.sharedSessionId}/dice/roll`,
      JSON.stringify({ formula: formula, isPrivate: false }),
      { headers: headers(vuToken) },
    );

    diceDuration.add(res.timings.duration);

    const ok = check(res, {
      'dice roll: status is 200': (r) => r.status === 200,
      'dice roll: response has roll data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.ok === true && body.data;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Dice - History', () => {
    if (!data.sharedSessionId) {
      return;
    }

    const res = http.get(
      `${BASE_URL}/api/sessions/${data.sharedSessionId}/dice/history?page=1&limit=10`,
      { headers: headers(vuToken) },
    );

    diceDuration.add(res.timings.duration);

    const ok = check(res, {
      'dice history: status is 200': (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── Chat Message Endpoint ─────────────────────────────────────────

  group('Chat - Send Message', () => {
    if (!data.sharedSessionId) {
      console.warn(`VU${__VU}: skipping chat — no session available`);
      return;
    }

    const channels = ['IC', 'OOC'];
    const channel = channels[Math.floor(Math.random() * channels.length)];

    const res = http.post(
      `${BASE_URL}/api/sessions/${data.sharedSessionId}/chat`,
      JSON.stringify({
        content: `Load test message from VU${__VU} at ${Date.now()}`,
        channel: channel,
      }),
      { headers: headers(vuToken) },
    );

    chatDuration.add(res.timings.duration);

    const ok = check(res, {
      'send chat: status is 201': (r) => r.status === 201,
      'send chat: response has message': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.ok === true && body.data;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Chat - History', () => {
    if (!data.sharedSessionId) {
      return;
    }

    const res = http.get(
      `${BASE_URL}/api/sessions/${data.sharedSessionId}/chat?page=1&limit=20`,
      { headers: headers(vuToken) },
    );

    chatDuration.add(res.timings.duration);

    const ok = check(res, {
      'chat history: status is 200': (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── Health Check (lightweight, always available) ───────────────────

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);

    const ok = check(res, {
      'health: status is 200': (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  // Pacing: random sleep between iterations to simulate realistic user behavior
  sleep(Math.random() * 2 + 1);
}

// ---------------------------------------------------------------------------
// Teardown — runs once after all VU iterations complete
// ---------------------------------------------------------------------------

/**
 * Performs cleanup after the load test. Logs completion. The shared room
 * and users created during setup are left in place (test DB should be
 * reset externally).
 *
 * @param {object} data - Setup data from the setup() function.
 */
export function teardown(data) {
  if (data.error) {
    console.log('Teardown: test was aborted due to setup failure.');
    return;
  }

  console.log('='.repeat(60));
  console.log('DSVTT API Load Test Complete');
  console.log(`  Shared Room ID:    ${data.sharedRoomId}`);
  console.log(`  Shared Session ID: ${data.sharedSessionId || 'N/A'}`);
  console.log('='.repeat(60));

  // Optional: clean up the shared room
  // Uncomment if you want automatic cleanup:
  //
  // http.del(`${BASE_URL}/api/rooms/${data.sharedRoomId}`, {
  //   headers: headers(data.directorToken),
  // });
}
