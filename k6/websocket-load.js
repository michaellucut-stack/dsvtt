/**
 * DSVTT - Digital Storytelling Virtual Tabletop
 * k6 WebSocket Load Test Script
 *
 * Tests Socket.IO WebSocket connections under load with 50 concurrent users.
 * Simulates real-time gameplay: joining rooms, sending chat messages,
 * rolling dice, and moving tokens.
 *
 * Usage:
 *   k6 run k6/websocket-load.js
 *   k6 run k6/websocket-load.js --env BASE_URL=http://staging.example.com:4000
 *
 * Note: Socket.IO uses the EIO=4 protocol with WebSocket transport.
 * The handshake sequence is:
 *   1. Connect to ws://<host>/socket.io/?EIO=4&transport=websocket
 *   2. Receive "0{...}" (OPEN packet with sid, pingInterval, pingTimeout)
 *   3. Send "40" (CONNECT to default namespace)
 *   4. Receive "40{...}" (CONNECT ACK with sid)
 *   5. Exchange "42[event, payload]" messages (MESSAGE packets)
 *   6. Respond to "2" (PING) with "3" (PONG)
 *
 * Thresholds:
 *   - WebSocket connection success rate > 99%
 *   - Message round-trip latency p95 < 200ms
 */

import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base HTTP URL for API calls (registration, room setup). */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

/**
 * WebSocket URL for Socket.IO connections.
 * Derived from BASE_URL by replacing http:// with ws://.
 */
const WS_BASE_URL = BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');

/** Full Socket.IO WebSocket endpoint with EIO4 transport parameters. */
const WS_URL = `${WS_BASE_URL}/socket.io/?EIO=4&transport=websocket`;

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

/** Counts successful WebSocket connections. */
const wsConnectionSuccess = new Counter('ws_connection_success');

/** Counts failed WebSocket connections. */
const wsConnectionFailure = new Counter('ws_connection_failure');

/** Rate of successful WebSocket connections (for threshold). */
const wsConnectionRate = new Rate('ws_connection_success_rate');

/** Tracks round-trip latency of Socket.IO messages (emit → response). */
const wsMessageLatency = new Trend('ws_message_latency', true);

/** Counts total messages sent through WebSocket. */
const wsMessagesSent = new Counter('ws_messages_sent');

/** Counts total messages received through WebSocket. */
const wsMessagesReceived = new Counter('ws_messages_received');

/** Tracks duration of the full WebSocket session. */
const wsSessionDuration = new Trend('ws_session_duration', true);

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
    ws_connection_success_rate: ['rate>0.99'],
    ws_message_latency: ['p(95)<200'],
  },
};

// ---------------------------------------------------------------------------
// Helper: HTTP request headers
// ---------------------------------------------------------------------------

/**
 * Returns common request headers with JSON content type and optional
 * Bearer authorization.
 *
 * @param {string} [token] - JWT access token.
 * @returns {object} Headers object.
 */
function headers(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Helper: Socket.IO protocol encoding/decoding
// ---------------------------------------------------------------------------

/**
 * Socket.IO EIO4 packet types:
 *   0 = OPEN, 1 = CLOSE, 2 = PING, 3 = PONG, 4 = MESSAGE
 *
 * Socket.IO MESSAGE subtypes (prefixed after '4'):
 *   0 = CONNECT, 1 = DISCONNECT, 2 = EVENT, 3 = ACK
 *
 * An event message looks like: 42["eventName", { ...payload }]
 * A connect message looks like: 40 or 40{"sid":"..."}
 */

/**
 * Encodes a Socket.IO event as an EIO4 message string.
 *
 * @param {string} event - The event name (e.g., "CHAT_MESSAGE").
 * @param {object} payload - The event payload.
 * @returns {string} The encoded message string (e.g., '42["CHAT_MESSAGE",{...}]').
 */
function encodeEvent(event, payload) {
  return '42' + JSON.stringify([event, payload]);
}

/**
 * Attempts to decode a Socket.IO EIO4 message string.
 *
 * @param {string} msg - The raw message from the WebSocket.
 * @returns {object|null} Decoded object with {type, event, payload} or null if not an event.
 */
function decodeMessage(msg) {
  if (!msg || msg.length === 0) {
    return null;
  }

  // Engine.IO OPEN packet
  if (msg.startsWith('0')) {
    try {
      return { type: 'open', data: JSON.parse(msg.substring(1)) };
    } catch {
      return { type: 'open', data: null };
    }
  }

  // Engine.IO PING
  if (msg === '2') {
    return { type: 'ping' };
  }

  // Engine.IO PONG
  if (msg === '3') {
    return { type: 'pong' };
  }

  // Socket.IO CONNECT ACK (40 or 40{...})
  if (msg.startsWith('40')) {
    try {
      const jsonPart = msg.substring(2);
      return { type: 'connect', data: jsonPart ? JSON.parse(jsonPart) : {} };
    } catch {
      return { type: 'connect', data: {} };
    }
  }

  // Socket.IO EVENT (42[...])
  if (msg.startsWith('42')) {
    try {
      const arr = JSON.parse(msg.substring(2));
      return { type: 'event', event: arr[0], payload: arr[1] || {} };
    } catch {
      return null;
    }
  }

  // Socket.IO ACK (43...)
  if (msg.startsWith('43')) {
    try {
      // ACK format: 43<ackId>[payload]
      // Find where the JSON array starts
      let i = 2;
      while (i < msg.length && msg[i] >= '0' && msg[i] <= '9') {
        i++;
      }
      const ackId = msg.substring(2, i);
      const payload = msg.substring(i);
      return {
        type: 'ack',
        ackId: parseInt(ackId, 10),
        data: payload ? JSON.parse(payload) : null,
      };
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Setup — runs once before VU code
// ---------------------------------------------------------------------------

/**
 * Registers a shared director user, creates a shared room, and starts
 * a game session. Returns auth credentials and room/session IDs for
 * use by VUs.
 *
 * @returns {object} Setup data with auth tokens, room ID, and session ID.
 */
export function setup() {
  // 1. Verify the server is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  const healthOk = check(healthRes, {
    'setup: health check passes': (r) => r.status === 200,
  });

  if (!healthOk) {
    console.error('Server health check failed — aborting WebSocket load test.');
    return { error: true };
  }

  // 2. Register a director user
  const directorEmail = `k6-ws-director-${Date.now()}@loadtest.local`;
  const directorPassword = 'K6WsTest!2024';

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: directorEmail,
      password: directorPassword,
      displayName: 'K6 WS Director',
    }),
    { headers: headers() },
  );

  if (registerRes.status !== 201) {
    console.error(`Setup registration failed: ${registerRes.status} ${registerRes.body}`);
    return { error: true };
  }

  const registerData = JSON.parse(registerRes.body);
  const directorToken = registerData.data.tokens.accessToken;

  // 3. Create a shared room for WebSocket tests
  const createRoomRes = http.post(
    `${BASE_URL}/api/rooms`,
    JSON.stringify({ name: 'K6 WS Load Test Room', maxPlayers: 50 }),
    { headers: headers(directorToken) },
  );

  if (createRoomRes.status !== 201) {
    console.error(`Setup room creation failed: ${createRoomRes.status} ${createRoomRes.body}`);
    return { error: true };
  }

  const roomData = JSON.parse(createRoomRes.body);
  const sharedRoomId = roomData.data.id;

  // 4. Start a game session
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
    console.warn(`Setup session creation returned ${sessionRes.status} — some events may skip.`);
  }

  console.log(`WS Setup complete: room=${sharedRoomId}, session=${sharedSessionId}`);

  return {
    error: false,
    directorEmail,
    directorPassword,
    directorToken,
    sharedRoomId,
    sharedSessionId,
  };
}

// ---------------------------------------------------------------------------
// VU Code — WebSocket test scenario
// ---------------------------------------------------------------------------

/**
 * Main VU function. Each virtual user:
 * 1. Registers a unique account and obtains an auth token
 * 2. Opens a WebSocket connection with Socket.IO handshake
 * 3. Joins a room, sends chat messages, dice rolls, and token moves
 * 4. Maintains the connection for a sustained period
 * 5. Gracefully disconnects
 *
 * @param {object} data - Setup data from the setup() function.
 */
export default function (data) {
  if (data.error) {
    console.error('Setup failed — skipping VU.');
    sleep(1);
    return;
  }

  // ── Step 1: Register a unique VU user and get auth token ──────────

  const vuEmail = `k6-ws-vu${__VU}-${Date.now()}@loadtest.local`;
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: vuEmail,
      password: 'WsLoadTest!Pass123',
      displayName: `WS-VU${__VU}`,
    }),
    { headers: headers() },
  );

  if (registerRes.status !== 201) {
    console.warn(`VU${__VU}: registration failed (${registerRes.status}), skipping WS test`);
    wsConnectionRate.add(false);
    wsConnectionFailure.add(1);
    sleep(2);
    return;
  }

  const regData = JSON.parse(registerRes.body);
  const vuToken = regData.data.tokens.accessToken;

  // ── Step 2: Join the shared room via REST (so the user is a member) ─

  http.post(
    `${BASE_URL}/api/rooms/${data.sharedRoomId}/join`,
    JSON.stringify({ role: 'player' }),
    { headers: headers(vuToken) },
  );

  // ── Step 3: Open WebSocket connection ─────────────────────────────

  /** Tracks whether the Socket.IO handshake completed successfully. */
  let connected = false;

  /** Tracks the number of event messages received. */
  let receivedEvents = 0;

  /** Timestamps for latency measurement keyed by event correlation ID. */
  const pendingLatency = {};

  /** Session start time for duration tracking. */
  const sessionStart = Date.now();

  /**
   * Connect to Socket.IO via WebSocket.
   *
   * The auth token is passed via the query string since k6's ws module
   * does not natively support Socket.IO's auth handshake. The server's
   * Socket.IO auth middleware reads it from socket.handshake.auth.token,
   * so we embed it in the Socket.IO CONNECT packet payload.
   */
  const wsUrl = WS_URL;

  const res = ws.connect(wsUrl, {}, function (socket) {
    // ── Socket.IO handshake: wait for OPEN, send CONNECT ──────────

    socket.on('message', function (msg) {
      const decoded = decodeMessage(msg);

      if (!decoded) {
        return;
      }

      // Handle Engine.IO OPEN packet — respond with Socket.IO CONNECT
      if (decoded.type === 'open') {
        // Send Socket.IO CONNECT with auth token in payload
        // Format: 40{"token":"<jwt>"}
        socket.send('40' + JSON.stringify({ token: vuToken }));
        return;
      }

      // Handle Engine.IO PING — respond with PONG
      if (decoded.type === 'ping') {
        socket.send('3');
        return;
      }

      // Handle Socket.IO CONNECT ACK — handshake complete
      if (decoded.type === 'connect') {
        connected = true;
        wsConnectionSuccess.add(1);
        wsConnectionRate.add(true);

        // ── Start sending game events after handshake ───────────

        // Join room via Socket.IO event
        const joinMsg = encodeEvent('ROOM_JOIN', {
          roomId: data.sharedRoomId,
        });
        socket.send(joinMsg);
        wsMessagesSent.add(1);

        // Schedule chat messages
        for (let i = 0; i < 5; i++) {
          const delay = (i + 1) * 3; // Send a message every 3 seconds
          socket.setTimeout(function () {
            if (data.sharedSessionId) {
              const correlationId = `chat-${__VU}-${i}-${Date.now()}`;
              pendingLatency[correlationId] = Date.now();

              const chatMsg = encodeEvent('CHAT_MESSAGE', {
                sessionId: data.sharedSessionId,
                channel: 'OOC',
                content: `WS load test msg ${i} from VU${__VU} [${correlationId}]`,
              });
              socket.send(chatMsg);
              wsMessagesSent.add(1);
            }
          }, delay * 1000);
        }

        // Schedule dice rolls
        for (let i = 0; i < 3; i++) {
          const delay = (i + 1) * 5 + 1; // Staggered dice rolls
          socket.setTimeout(function () {
            if (data.sharedSessionId) {
              const formulas = ['1d20', '2d6+3', '4d6kh3', '1d100'];
              const formula = formulas[Math.floor(Math.random() * formulas.length)];
              const correlationId = `dice-${__VU}-${i}-${Date.now()}`;
              pendingLatency[correlationId] = Date.now();

              const diceMsg = encodeEvent('DICE_ROLL', {
                sessionId: data.sharedSessionId,
                formula: formula,
              });
              socket.send(diceMsg);
              wsMessagesSent.add(1);
            }
          }, delay * 1000);
        }

        // Schedule token moves
        for (let i = 0; i < 3; i++) {
          const delay = (i + 1) * 4 + 2; // Staggered token moves
          socket.setTimeout(function () {
            const correlationId = `token-${__VU}-${i}-${Date.now()}`;
            pendingLatency[correlationId] = Date.now();

            const tokenMsg = encodeEvent('TOKEN_MOVE', {
              tokenId: `fake-token-${__VU}`,
              mapId: `fake-map-${__VU}`,
              x: Math.floor(Math.random() * 30),
              y: Math.floor(Math.random() * 30),
            });
            socket.send(tokenMsg);
            wsMessagesSent.add(1);
          }, delay * 1000);
        }

        return;
      }

      // Handle Socket.IO EVENT messages (server broadcasts)
      if (decoded.type === 'event') {
        receivedEvents++;
        wsMessagesReceived.add(1);

        // Measure latency for known broadcast types
        // When we receive a broadcast, record a latency sample based on
        // the oldest pending request of that type.
        const eventType = decoded.event;
        if (
          eventType === 'CHAT_MESSAGE_BROADCAST' ||
          eventType === 'DICE_RESULT' ||
          eventType === 'TOKEN_MOVED'
        ) {
          // Find the oldest pending latency entry for this event type prefix
          const prefix = eventType === 'CHAT_MESSAGE_BROADCAST'
            ? 'chat-'
            : eventType === 'DICE_RESULT'
              ? 'dice-'
              : 'token-';

          for (const key in pendingLatency) {
            if (key.startsWith(prefix)) {
              const latency = Date.now() - pendingLatency[key];
              wsMessageLatency.add(latency);
              delete pendingLatency[key];
              break; // Only match one pending request per received event
            }
          }
        }

        return;
      }

      // Handle ACK messages (callback responses from server)
      if (decoded.type === 'ack') {
        wsMessagesReceived.add(1);
        return;
      }
    });

    // ── Handle connection errors ──────────────────────────────────

    socket.on('error', function (e) {
      console.warn(`VU${__VU}: WebSocket error: ${e.error()}`);
      wsConnectionFailure.add(1);
      if (!connected) {
        wsConnectionRate.add(false);
      }
    });

    // ── Keep connection alive for test duration ───────────────────

    /**
     * Keep the WebSocket open for 30 seconds per VU iteration.
     * This allows time for all scheduled messages to be sent and
     * server broadcasts to be received.
     */
    socket.setTimeout(function () {
      // Send Socket.IO DISCONNECT (41) then close
      socket.send('41');

      // Leave room before closing
      const leaveMsg = encodeEvent('ROOM_LEAVE', {
        roomId: data.sharedRoomId,
      });
      socket.send(leaveMsg);

      socket.close();
    }, 30000);
  });

  // ── Post-connection checks ──────────────────────────────────────

  const sessionDuration = Date.now() - sessionStart;
  wsSessionDuration.add(sessionDuration);

  check(res, {
    'ws: connection status is 101 (switching protocols)': (r) => r && r.status === 101,
  });

  if (!connected) {
    wsConnectionFailure.add(1);
    wsConnectionRate.add(false);
  }

  // Pacing between iterations
  sleep(Math.random() * 3 + 2);
}

// ---------------------------------------------------------------------------
// Teardown — runs once after all VU iterations complete
// ---------------------------------------------------------------------------

/**
 * Logs test completion summary. Cleanup of test data should be handled
 * externally (e.g., database reset).
 *
 * @param {object} data - Setup data from the setup() function.
 */
export function teardown(data) {
  if (data.error) {
    console.log('Teardown: WebSocket test was aborted due to setup failure.');
    return;
  }

  console.log('='.repeat(60));
  console.log('DSVTT WebSocket Load Test Complete');
  console.log(`  Shared Room ID:    ${data.sharedRoomId}`);
  console.log(`  Shared Session ID: ${data.sharedSessionId || 'N/A'}`);
  console.log('='.repeat(60));
}
