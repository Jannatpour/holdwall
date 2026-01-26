"use strict";
/**
 * Error Handling
 * Centralized error handling with proper logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.handleError = handleError;
const logger_1 = require("@/lib/logging/logger");
const server_1 = require("next/server");
const crypto_1 = require("crypto");
class AppError extends Error {
    constructor(message, statusCode = 500, code, context) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.context = context;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
function handleError(error) {
    if (error instanceof AppError) {
        (0, logger_1.logError)(error, error.context);
        // Include error ID for tracking
        const errorId = (0, crypto_1.randomUUID)();
        return server_1.NextResponse.json({
            error: error.message,
            code: error.code,
            error_id: errorId,
            ...(process.env.NODE_ENV === "development" && error.context
                ? { context: error.context }
                : {}),
        }, { status: error.statusCode });
    }
    if (error instanceof Error) {
        (0, logger_1.logError)(error);
        const errorId = (0, crypto_1.randomUUID)();
        return server_1.NextResponse.json({
            error: "Internal server error",
            error_id: errorId,
            ...(process.env.NODE_ENV === "development"
                ? { message: error.message, stack: error.stack }
                : {}),
        }, { status: 500 });
    }
    (0, logger_1.logError)(new Error("Unknown error"), { original: error });
    const errorId = (0, crypto_1.randomUUID)();
    return server_1.NextResponse.json({
        error: "Internal server error",
        error_id: errorId,
    }, { status: 500 });
}
