"use strict";
/**
 * Database Migrations
 * Production migration utilities
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPrismaMigrations = runPrismaMigrations;
exports.runDataMigrations = runDataMigrations;
exports.runMigrations = runMigrations;
/**
 * Run database migrations
 *
 * Production-ready migration utilities using Prisma migrate
 * Also supports custom data migrations
 */
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Run Prisma migrations
 */
async function runPrismaMigrations() {
    try {
        // Run Prisma migrate deploy (for production) or migrate dev (for development)
        const command = process.env.NODE_ENV === "production"
            ? "npx prisma migrate deploy"
            : "npx prisma migrate dev";
        const { stdout, stderr } = await execAsync(command);
        console.log("Migration output:", stdout);
        if (stderr) {
            console.warn("Migration warnings:", stderr);
        }
    }
    catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
}
/**
 * Run custom data migrations
 */
async function runDataMigrations() {
    const { db } = await Promise.resolve().then(() => __importStar(require("./client")));
    // Create default tenant if none exists
    const tenantCount = await db.tenant.count();
    if (tenantCount === 0) {
        await db.tenant.create({
            data: {
                name: "Default Tenant",
                slug: "default",
            },
        });
        console.log("Created default tenant");
    }
    // Add any other data migrations here
}
/**
 * Run all migrations
 */
async function runMigrations() {
    console.log("Running database migrations...");
    // Run Prisma schema migrations
    await runPrismaMigrations();
    // Run custom data migrations
    await runDataMigrations();
    console.log("Migrations completed");
}
