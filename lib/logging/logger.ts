/**
 * Production Logging
 * Structured logging with Winston (server-side) or console (client-side)
 */

// Client-safe logger that uses console in browser, winston on server
let logger: {
  info: (message: string | object, context?: Record<string, unknown> | any) => void;
  error: (message: string | object, context?: Record<string, unknown> | any) => void;
  warn: (message: string | object, context?: Record<string, unknown> | any) => void;
  debug: (message: string | object, context?: Record<string, unknown> | any) => void;
};

if (typeof window === "undefined") {
  // Server-side: use winston
  const winston = require("winston");
  
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: logFormat,
    defaultMeta: { service: "holdwall-pos" },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      // In production, add file transports
      ...(process.env.NODE_ENV === "production"
        ? [
            new winston.transports.File({
              filename: "logs/error.log",
              level: "error",
            }),
            new winston.transports.File({ filename: "logs/combined.log" }),
          ]
        : []),
    ],
  });
} else {
  // Client-side: use console
  logger = {
    info: (message: string | object, context?: Record<string, unknown> | any) => {
      if (typeof message === "string") {
        console.log(`[INFO] ${message}`, context || "");
      } else {
        console.log("[INFO]", message, context || "");
      }
    },
    error: (message: string | object, context?: Record<string, unknown> | any) => {
      if (typeof message === "string") {
        console.error(`[ERROR] ${message}`, context || "");
      } else {
        console.error("[ERROR]", message, context || "");
      }
    },
    warn: (message: string | object, context?: Record<string, unknown> | any) => {
      if (typeof message === "string") {
        console.warn(`[WARN] ${message}`, context || "");
      } else {
        console.warn("[WARN]", message, context || "");
      }
    },
    debug: (message: string | object, context?: Record<string, unknown> | any) => {
      if (typeof message === "string") {
        console.debug(`[DEBUG] ${message}`, context || "");
      } else {
        console.debug("[DEBUG]", message, context || "");
      }
    },
  };
}

export { logger };

// Helper functions
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  logger.info({ message, ...context });
}

export function logWarning(message: string, context?: Record<string, unknown>) {
  logger.warn({ message, ...context });
}
