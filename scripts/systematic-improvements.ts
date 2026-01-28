/**
 * Systematic Code Quality Improvements
 * 
 * This script identifies and reports areas needing improvement across the codebase.
 * Run with: tsx scripts/systematic-improvements.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

interface Improvement {
  file: string;
  line: number;
  type: "console_usage" | "missing_auth" | "error_handling" | "type_safety" | "performance";
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
}

const improvements: Improvement[] = [];
const libDir = join(process.cwd(), "holdwall", "lib");
const appApiDir = join(process.cwd(), "holdwall", "app", "api");

function scanFile(filePath: string, relativePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for console usage (server-side only - client-side console is OK)
      if (line.includes("console.") && !relativePath.includes("error-boundary") && !relativePath.includes("logger.ts")) {
        // Skip if it's in a client component or already in logger
        if (!relativePath.includes(".tsx") || line.includes("// Client-side")) {
          improvements.push({
            file: relativePath,
            line: lineNum,
            type: "console_usage",
            severity: "medium",
            description: `Console usage found: ${line.trim().substring(0, 60)}`,
            suggestion: "Replace with logger from @/lib/logging/logger",
          });
        }
      }

      // Check for missing error handling in API routes
      if (relativePath.includes("/api/") && relativePath.endsWith("route.ts")) {
        if (line.includes("export async function") && !content.includes("try {") && !content.includes("createApiHandler")) {
          improvements.push({
            file: relativePath,
            line: lineNum,
            type: "error_handling",
            severity: "high",
            description: "API route may be missing error handling",
            suggestion: "Wrap in createApiHandler or add try/catch with proper error responses",
          });
        }
      }
    });
  } catch (error) {
    // Skip files that can't be read
  }
}

function scanDirectory(dir: string, baseDir: string): void {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && !entry.includes("node_modules") && !entry.includes(".next")) {
        scanDirectory(fullPath, baseDir);
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        const relativePath = fullPath.replace(baseDir + "/", "");
        scanFile(fullPath, relativePath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
}

console.log("Scanning codebase for improvements...");
scanDirectory(libDir, join(process.cwd(), "holdwall"));
scanDirectory(appApiDir, join(process.cwd(), "holdwall"));

// Group by type
const byType = improvements.reduce((acc, imp) => {
  if (!acc[imp.type]) acc[imp.type] = [];
  acc[imp.type].push(imp);
  return acc;
}, {} as Record<string, Improvement[]>);

// Output report
console.log("\n=== Systematic Improvement Report ===\n");
console.log(`Total issues found: ${improvements.length}\n`);

Object.entries(byType).forEach(([type, items]) => {
  console.log(`\n${type.toUpperCase()} (${items.length} issues):`);
  const high = items.filter(i => i.severity === "high");
  const medium = items.filter(i => i.severity === "medium");
  const low = items.filter(i => i.severity === "low");
  
  console.log(`  High: ${high.length}, Medium: ${medium.length}, Low: ${low.length}`);
  
  if (high.length > 0) {
    console.log("\n  High Priority:");
    high.slice(0, 5).forEach(imp => {
      console.log(`    - ${imp.file}:${imp.line} - ${imp.description}`);
    });
    if (high.length > 5) {
      console.log(`    ... and ${high.length - 5} more`);
    }
  }
});

// Write detailed report
const reportPath = join(process.cwd(), "holdwall", "SYSTEMATIC_IMPROVEMENTS_REPORT.md");
const report = `# Systematic Improvements Report

Generated: ${new Date().toISOString()}

## Summary

- Total Issues: ${improvements.length}
- High Priority: ${improvements.filter(i => i.severity === "high").length}
- Medium Priority: ${improvements.filter(i => i.severity === "medium").length}
- Low Priority: ${improvements.filter(i => i.severity === "low").length}

## Issues by Type

${Object.entries(byType).map(([type, items]) => `
### ${type.replace(/_/g, " ").toUpperCase()} (${items.length})

${items.slice(0, 20).map(imp => `
- **${imp.file}:${imp.line}** (${imp.severity})
  - ${imp.description}
  - Suggestion: ${imp.suggestion}
`).join("\n")}
${items.length > 20 ? `\n... and ${items.length - 20} more issues` : ""}
`).join("\n")}
`;

writeFileSync(reportPath, report);
console.log(`\nDetailed report written to: ${reportPath}`);
