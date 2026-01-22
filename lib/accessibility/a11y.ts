/**
 * Accessibility Utilities
 * WCAG 2.1 AA compliance helpers
 * 
 * Note: This file provides browser-specific utilities.
 * For server-side contrast checking, use lib/accessibility/utils.ts
 */

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
 * Calculate relative luminance (WCAG 2.1 formula)
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return 0.5; // Fallback for invalid colors
  }
  
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check color contrast ratio (browser-compatible version)
 */
export function checkContrastRatio(
  foreground: string,
  background: string
): { ratio: number; passesAA: boolean; passesAAA: boolean } {
  const fgLuminance = getLuminance(foreground);
  const bgLuminance = getLuminance(background);
  const ratio =
    (Math.max(fgLuminance, bgLuminance) + 0.05) /
    (Math.min(fgLuminance, bgLuminance) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5, // AA standard for normal text
    passesAAA: ratio >= 7, // AAA standard for normal text
  };
}

/**
 * Generate ARIA labels
 */
export function generateAriaLabel(
  action: string,
  context?: string
): string {
  if (context) {
    return `${action} ${context}`;
  }
  return action;
}

/**
 * Keyboard navigation helpers
 */
export function handleKeyboardNavigation(
  event: KeyboardEvent,
  options: {
    onEnter?: () => void;
    onEscape?: () => void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onArrowLeft?: () => void;
    onArrowRight?: () => void;
    onTab?: () => void;
  }
): void {
  switch (event.key) {
    case "Enter":
    case " ":
      options.onEnter?.();
      break;
    case "Escape":
      options.onEscape?.();
      break;
    case "ArrowUp":
      options.onArrowUp?.();
      break;
    case "ArrowDown":
      options.onArrowDown?.();
      break;
    case "ArrowLeft":
      options.onArrowLeft?.();
      break;
    case "ArrowRight":
      options.onArrowRight?.();
      break;
    case "Tab":
      options.onTab?.();
      break;
  }
}

/**
 * Focus management
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") {
      return;
    }

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener("keydown", handleTab);
  firstElement?.focus();

  return () => {
    element.removeEventListener("keydown", handleTab);
  };
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite"): void {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Skip link component data
 */
export const skipLinkData = {
  href: "#main-content",
  label: "Skip to main content",
};
