/**
 * Script to replace console.error with proper logger calls in API routes
 * Run: npx tsx scripts/fix-console-logs.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import path from "path";

const API_ROUTES_DIR = path.join(process.cwd(), "app/api");

async function fixConsoleLogs() {
  const files = await glob("**/*.ts", { cwd: API_ROUTES_DIR, absolute: true });

  for (const file of files) {
    let content = readFileSync(file, "utf-8");
    let modified = false;

    // Replace console.error with logger.error
    const consoleErrorRegex = /console\.error\(([^)]+)\);/g;
    const matches = [...content.matchAll(consoleErrorRegex)];

    for (const match of matches) {
      const original = match[0];
      const args = match[1];

      // Extract error message (first string argument or error variable)
      let errorMessage = "Unknown error";
      if (args.includes('"') || args.includes("'")) {
        const msgMatch = args.match(/["']([^"']+)["']/);
        if (msgMatch) {
          errorMessage = msgMatch[1];
        }
      }

      // Check if logger is already imported
      const hasLoggerImport = content.includes('from "@/lib/logging/logger"') || 
                              content.includes("from '@/lib/logging/logger'");

      // Generate replacement
      const replacement = hasLoggerImport
        ? `logger.error("${errorMessage}", {\n      error: error instanceof Error ? error.message : String(error),\n    });`
        : `const { logger } = await import("@/lib/logging/logger");\n    logger.error("${errorMessage}", {\n      error: error instanceof Error ? error.message : String(error),\n    });`;

      // Replace in context (within catch block)
      const beforeMatch = content.substring(0, match.index!);
      const afterMatch = content.substring(match.index! + match[0].length);

      // Check if we're in a catch block and logger import is needed
      const catchBlockMatch = beforeMatch.match(/catch\s*\([^)]*error[^)]*\)\s*\{[^}]*$/s);
      if (catchBlockMatch && !hasLoggerImport) {
        // Find the catch block start
        const catchIndex = beforeMatch.lastIndexOf("catch");
        const catchBlock = beforeMatch.substring(catchIndex);
        const catchBlockEnd = catchBlock.indexOf("{");
        const afterCatchBrace = beforeMatch.substring(catchIndex + catchBlockEnd + 1);

        // Insert logger import at the start of catch block
        const newBefore = beforeMatch.substring(0, catchIndex + catchBlockEnd + 1) +
          "\n    const { logger } = await import(\"@/lib/logging/logger\");" +
          afterCatchBrace;
        content = newBefore + replacement + afterMatch;
      } else {
        content = beforeMatch + replacement + afterMatch;
      }

      modified = true;
    }

    if (modified) {
      writeFileSync(file, content, "utf-8");
      console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
    }
  }
}

fixConsoleLogs().catch(console.error);
