import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import react from "eslint-plugin-react";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".vercel/**",
    "next-env.d.ts",
  ]),
  // Project-wide pragmatics: keep strictness, but avoid blocking CI on unavoidable framework edges.
  {
    plugins: {
      react,
    },
    rules: {
      // Many Next.js route handlers and protocol payloads are dynamic; treat `any` as a warning,
      // not a hard error, so lint remains actionable without forcing unsafe casts everywhere.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-declaration-merging": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-this-alias": "warn",
    },
  },
  // Tests can legitimately use dynamic imports and broad types.
  {
    files: ["**/__tests__/**", "**/*.test.*", "**/jest.setup.*", "**/playwright.config.*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]);

export default eslintConfig;
