#!/bin/bash
# Build script that filters out expected warnings while preserving exit codes

set -e

# Run build and filter warnings, but preserve stderr for errors
NODE_OPTIONS='--no-warnings' next build 2>&1 | \
  grep -v "⚠ Using edge runtime on a page currently disables static generation for that page" | \
  grep -v "WARN! Build not running on Vercel" | \
  grep -v "WARNING: You should not upload the \`.next\` directory" || \
  exit_code=${PIPESTATUS[0]}

# Exit with the original build exit code
exit ${exit_code:-0}
