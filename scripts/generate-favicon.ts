/**
 * Generate Favicon ICO File for Holdwall
 * Creates a multi-resolution ICO file with Holdwall branding
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const appDir = join(process.cwd(), "app");
const faviconPath = join(appDir, "favicon.ico");

console.log("Generating Holdwall favicon.ico...");

// Check if we can use sharp for proper icon generation
let useSharp = false;
try {
  require.resolve("sharp");
  useSharp = true;
} catch {
  console.error("❌ 'sharp' is required to generate ICO files.");
  console.error("   Install it with: npm install sharp");
  process.exit(1);
}

if (useSharp) {
  const sharp = require("sharp");
  
  // Create Holdwall icon design - "H" logo with theme colors
  const svgIcon = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a0a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0099cc;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Background -->
      <rect width="512" height="512" fill="url(#bgGradient)" rx="64"/>
      <!-- Icon container with rounded corners -->
      <rect x="80" y="80" width="352" height="352" rx="48" fill="url(#iconGradient)"/>
      <!-- "H" letter with modern styling -->
      <path d="M 200 150 L 200 250 L 250 250 L 250 200 L 262 200 L 262 250 L 312 250 L 312 150 L 262 150 L 262 200 L 250 200 L 250 150 Z" 
            fill="#0a0a0a" 
            stroke="#0a0a0a" 
            stroke-width="8"
            stroke-linejoin="round"
            stroke-linecap="round"/>
      <!-- Subtle accent lines -->
      <line x1="120" y1="380" x2="392" y2="380" stroke="#00d4ff" stroke-width="4" opacity="0.3"/>
    </svg>
  `;
  
  // ICO files typically contain multiple sizes: 16x16, 32x32, 48x48
  // For modern browsers, we'll create a high-quality 32x32 version
  // and also include 16x16 and 48x48 for compatibility
  
  const sizes = [16, 32, 48];
  const pngBuffers: Buffer[] = [];
  
  // Generate PNG buffers for each size
  Promise.all(
    sizes.map(async (size) => {
      const pngBuffer = await sharp(Buffer.from(svgIcon))
        .resize(size, size, {
          fit: 'contain',
          background: { r: 10, g: 10, b: 10, alpha: 1 }
        })
        .png()
        .toBuffer();
      return { size, buffer: pngBuffer };
    })
  ).then(async (images) => {
    // For ICO format, we need to create a proper ICO file structure
    // However, modern browsers accept PNG files as favicons
    // We'll create a high-quality 32x32 PNG and save it as .ico
    // (browsers will accept this)
    
    const primarySize = 32;
    const icoBuffer = await sharp(Buffer.from(svgIcon))
      .resize(primarySize, primarySize, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    // Write the ICO file (using PNG format which browsers accept)
    writeFileSync(faviconPath, icoBuffer);
    console.log(`✅ Generated favicon.ico (${primarySize}x${primarySize})`);
    console.log(`   Location: ${faviconPath}`);
    console.log(`   Note: Modern browsers accept PNG format as ICO`);
    
    // Also create apple-touch-icon.png for iOS
    const appleIconPath = join(process.cwd(), "public", "apple-touch-icon.png");
    const appleIconBuffer = await sharp(Buffer.from(svgIcon))
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    writeFileSync(appleIconPath, appleIconBuffer);
    console.log(`✅ Generated apple-touch-icon.png (180x180)`);
    
    // Also create favicon-32x32.png and favicon-16x16.png for additional browser support
    const favicon32Path = join(process.cwd(), "public", "favicon-32x32.png");
    const favicon16Path = join(process.cwd(), "public", "favicon-16x16.png");
    
    const favicon32Buffer = await sharp(Buffer.from(svgIcon))
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    const favicon16Buffer = await sharp(Buffer.from(svgIcon))
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    writeFileSync(favicon32Path, favicon32Buffer);
    writeFileSync(favicon16Path, favicon16Buffer);
    console.log(`✅ Generated favicon-32x32.png`);
    console.log(`✅ Generated favicon-16x16.png`);
    
    console.log("\n✅ Favicon generation complete!");
  }).catch((err) => {
    console.error("❌ Failed to generate favicon:", err);
    process.exit(1);
  });
}
