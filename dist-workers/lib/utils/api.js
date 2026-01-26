"use strict";
/**
 * API Utilities
 * Common API helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiHandler = apiHandler;
exports.parseRequestBody = parseRequestBody;
const server_1 = require("next/server");
const handler_1 = require("@/lib/errors/handler");
const versioning_1 = require("@/lib/api/versioning");
/**
 * API route wrapper with error handling
 */
function apiHandler(handler) {
    return handler()
        .then((data) => {
        return server_1.NextResponse.json((0, versioning_1.versionResponse)(data));
    })
        .catch((error) => {
        return (0, handler_1.handleError)(error);
    });
}
/**
 * Validate and parse request body
 */
async function parseRequestBody(request, schema) {
    try {
        const body = await request.json();
        return schema.parse(body);
    }
    catch (error) {
        throw new handler_1.AppError("Invalid request body", 400, "VALIDATION_ERROR", {
            error,
        });
    }
}
