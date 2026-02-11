import { createLogger, format, transports, type Logger } from 'winston';
import net from 'node:net';
import { Transform } from 'node:stream';

const { combine, timestamp, json, printf, colorize, errors } = format;

// ── Configuration ────────────────────────────────────────────────────────────

const SERVICE_NAME = 'dsvtt-server';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'debug';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const LOGSTASH_HOST = process.env['LOGSTASH_HOST'] ?? 'localhost';
const LOGSTASH_PORT = parseInt(process.env['LOGSTASH_PORT'] ?? '5044', 10);

// ── Pretty format for development console ────────────────────────────────────

const devFormat = printf(({ level, message, timestamp: ts, requestId, context, ...rest }) => {
  const rid = requestId ? ` [${requestId}]` : '';
  const ctx = context ? ` (${context})` : '';
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${ts} [${level}]${rid}${ctx} ${message}${extra}`;
});

// ── Winston transports ───────────────────────────────────────────────────────

const logTransports: InstanceType<typeof transports.Console | typeof transports.Stream>[] = [];

if (NODE_ENV === 'production') {
  // JSON format for production — ideal for ELK ingestion
  logTransports.push(
    new transports.Console({
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  );

  // TCP transport to Logstash in production
  const tcpStream = new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });

  const connectToLogstash = () => {
    const socket = net.createConnection({ host: LOGSTASH_HOST, port: LOGSTASH_PORT }, () => {
      tcpStream.pipe(socket);
    });

    socket.on('error', (err) => {
      // Silently handle — don't crash the app if Logstash is unreachable
      if (NODE_ENV === 'production') {
        process.stderr.write(`[Logger] Logstash connection error: ${err.message}\n`);
      }
    });

    socket.on('close', () => {
      tcpStream.unpipe(socket);
      // Reconnect after 5 seconds
      setTimeout(connectToLogstash, 5000).unref();
    });

    socket.unref();
  };

  connectToLogstash();

  logTransports.push(
    new transports.Stream({
      stream: tcpStream,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  );
} else {
  // Pretty, colorized format for development
  logTransports.push(
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss.SSS' }),
        errors({ stack: true }),
        devFormat,
      ),
    }),
  );
}

// ── Logger instance ──────────────────────────────────────────────────────────

const logger: Logger = createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: SERVICE_NAME },
  transports: logTransports,
});

export { logger };
