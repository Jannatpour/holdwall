/**
 * Skip Link Component
 * WCAG 2.1 AA compliance - allows keyboard users to skip navigation
 */

import Link from "next/link";
import { skipLinkData } from "@/lib/accessibility/a11y";

export function SkipLink() {
  return (
    <Link
      href={skipLinkData.href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {skipLinkData.label}
    </Link>
  );
}
