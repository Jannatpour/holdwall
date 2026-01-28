import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* Production optimizations */
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined, // Enable for Docker builds
  poweredByHeader: false, // Security
  compress: true,
  
  /* React */
  reactStrictMode: true,
  
  /* Image optimization */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  /* Experimental features */
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
    // optimizeCss: true, // Temporarily disabled - requires critters
    optimizeServerReact: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  /* Turbopack configuration */
  turbopack: {
    root: turbopackRoot,
  },

  /* Server external packages - mark optional dependencies as external */
  serverExternalPackages: ['puppeteer', 'tesseract.js', 'mqtt'],

  /* Performance optimizations */
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  /* Webpack optimizations */
  webpack: (config, { isServer }) => {
    // Mark optional dependencies as externals to prevent build errors
    if (isServer) {
      config.externals = config.externals || [];
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          ({ request }: { request?: string }) => {
            if (request === 'puppeteer' || request === 'tesseract.js') {
              return `commonjs ${request}`;
            }
          },
        ];
      } else if (Array.isArray(config.externals)) {
        config.externals.push(({ request }: { request?: string }) => {
          if (request === 'puppeteer' || request === 'tesseract.js') {
            return `commonjs ${request}`;
          }
        });
      }
    }

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test(module: any) {
                try {
                  return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier() || '');
                } catch {
                  return false;
                }
              },
              name: 'lib',
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name: 'shared',
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

  /* Security headers */
  async headers() {
    return [
      // Ensure the service worker updates promptly (avoid long-lived caching)
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      // Make Next.js static assets safely cacheable forever (content-hashed)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
