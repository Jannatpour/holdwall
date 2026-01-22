import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { ErrorBoundary } from "@/lib/error/error-boundary";
import { Toaster } from "@/components/toaster";
import { generateStructuredData } from "@/lib/seo/metadata";
import { SchemaGenerator } from "@/lib/seo/schema-generator";
import { SkipLink } from "@/components/accessibility/skip-link";
import { PWAClient } from "@/components/pwa-client";
import { GuideProvider } from "@/components/guides";
import "@/lib/integration/startup";
import { initializeGuides } from "@/lib/guides/loader";

// Initialize guides on server
initializeGuides();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Holdwall POS | Perception Operating System",
    template: "%s | Holdwall POS",
  },
  description:
    "Evidence-first, agentic perception engineering for the AI era. Build authoritative artifacts (AAAL), predict narrative risk (NPE), and route actions through human-gated autopilot—backed by immutable evidence, auditable workflows, and extensible agents (MCP/ACP).",
  keywords: [
    "perception engineering",
    "narrative risk",
    "evidence-based AI",
    "AAAL artifacts",
    "PADL publishing",
    "belief graph",
    "forecasting",
    "governance",
    "MCP agents",
    "RAG",
    "KAG",
    "trust artifacts",
  ],
  authors: [{ name: "Holdwall" }],
  creator: "Holdwall",
  publisher: "Holdwall",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Holdwall POS",
    title: "Holdwall POS | Perception Operating System",
    description:
      "Evidence-first, agentic perception engineering for the AI era. Build authoritative artifacts, predict narrative risk, and route actions through human-gated autopilot.",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Holdwall POS - Perception Operating System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Holdwall POS | Perception Operating System",
    description:
      "Evidence-first, agentic perception engineering for the AI era. Build authoritative artifacts, predict narrative risk, and route actions through human-gated autopilot.",
    images: [`${baseUrl}/og-image.png`],
    creator: "@holdwall",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    yahoo: process.env.YAHOO_VERIFICATION,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = generateStructuredData({
    type: "Organization",
    name: "Holdwall",
    description:
      "Evidence-first, agentic perception engineering for the AI era. Build authoritative artifacts, predict narrative risk, and route actions through human-gated autopilot.",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    contactPoint: {
      email: "contact@holdwall.com",
    },
    sameAs: [
      "https://twitter.com/holdwall",
      "https://linkedin.com/company/holdwall",
    ],
  });

  const softwareSchema = generateStructuredData({
    type: "SoftwareApplication",
    name: "Holdwall POS",
    description:
      "Perception Operating System for evidence-first, agentic perception engineering",
    url: baseUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      price: "2500",
      priceCurrency: "USD",
    },
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareSchema),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SkipLink />
        <ErrorBoundary>
          <SessionProvider>
            <ThemeProvider defaultTheme="obsidian">
              <GuideProvider>
                <div id="main-content">{children}</div>
                <Toaster />
                <PWAClient />
              </GuideProvider>
            </ThemeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
