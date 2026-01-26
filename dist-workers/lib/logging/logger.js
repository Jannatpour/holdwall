"use strict";
/**
 * Production Logging
 * Structured logging with Winston (server-side) or console (client-side)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logError = logError;
exports.logInfo = logInfo;
exports.logWarning = logWarning;
// Client-safe logger that uses console in browser, winston on server
let logger;
if (typeof window === "undefined") {
    // Server-side: use winston
    const winston = require("winston");
    const fs = require("fs");
    const path = require("path");
    const logFormat = winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston.format.errors({ stack: true }), winston.format.json());
    // Vercel/serverless file systems are not reliably writable (and are ephemeral).
    // Writing to ./logs will crash production functions with ENOENT/EPERM.
    const isServerless = !!process.env.VERCEL ||
        !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
        !!process.env.NETLIFY ||
        !!process.env.FUNCTIONS_WORKER_RUNTIME;
    const enableFileLogging = process.env.LOG_TO_FILE === "true" &&
        process.env.NODE_ENV === "production" &&
        !isServerless;
    if (enableFileLogging) {
        try {
            const logsDir = path.join(process.cwd(), "logs");
            fs.mkdirSync(logsDir, { recursive: true });
        }
        catch {
            // If we can't create the logs directory, silently fall back to console-only logging.
            // Never fail module init for logging.
        }
    }
    exports.logger = logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: logFormat,
        defaultMeta: { service: "holdwall-pos" },
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
            }),
            // In production, optionally add file transports (disabled on serverless)
            ...(enableFileLogging
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
}
else {
    // Client-side: use console
    exports.logger = logger = {
        info: (message, context) => {
            if (typeof message === "string") {
                console.log(`[INFO] ${message}`, context || "");
            }
            else {
                console.log("[INFO]", message, context || "");
            }
        },
        error: (message, context) => {
            if (typeof message === "string") {
                console.error(`[ERROR] ${message}`, context || "");
            }
            else {
                console.error("[ERROR]", message, context || "");
            }
        },
        warn: (message, context) => {
            if (typeof message === "string") {
                console.warn(`[WARN] ${message}`, context || "");
            }
            else {
                console.warn("[WARN]", message, context || "");
            }
        },
        debug: (message, context) => {
            if (typeof message === "string") {
                console.debug(`[DEBUG] ${message}`, context || "");
            }
            else {
                console.debug("[DEBUG]", message, context || "");
            }
        },
    };
}
// Helper functions
function logError(error, context) {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context,
    });
}
function logInfo(message, context) {
    logger.info({ message, ...context });
}
function logWarning(message, context) {
    logger.warn({ message, ...context });
}
