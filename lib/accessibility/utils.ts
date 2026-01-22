/**
 * Accessibility Utilities
 * WCAG 2.1 AA/AAA compliance helpers
 */

import React from "react";

/**
 * Generate ARIA label for interactive elements
 */
export function getAriaLabel(
  action: string,
  context?: string
): string {
  if (context) {
    return `${action} ${context}`;
  }
  return action;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to relative luminance (WCAG formula)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check color contrast ratio (WCAG AA requires 4.5:1 for normal text, 3:1 for large text)
 * WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
 */
export function checkContrast(
  foreground: string,
  background: string
): {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  passesAALarge: boolean;
  passesAAALarge: boolean;
} {
  // Parse colors
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    // Fallback for named colors or invalid hex
    // In production, you'd use a color parsing library
    return {
      ratio: 1,
      passesAA: false,
      passesAAA: false,
      passesAALarge: false,
      passesAAALarge: false,
    };
  }

  // Calculate relative luminance
  const fgLum = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLum = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  // Calculate contrast ratio
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5, // Normal text
    passesAAA: ratio >= 7, // Normal text
    passesAALarge: ratio >= 3, // Large text (18pt+ or 14pt+ bold)
    passesAAALarge: ratio >= 4.5, // Large text
  };
}

/**
 * Generate skip link for keyboard navigation
 * Returns className string for skip links
 */
export function getSkipLinkClassName(): string {
  return "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md";
}
