/**
 * Generate PWA Icon Files
 * Creates PNG icons for PWA manifest using sharp
 * Uses high-resolution source SVG and resizes for optimal quality
 */

import { join } from 'path';
import sharp from 'sharp';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create high-resolution Holdwall icon SVG (1024x1024 for best quality)
const createIconSVG = (): string => {
  const size = 1024;
  const center = size / 2;
  const radius = size * 0.35;
  const strokeWidth = size * 0.08;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
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
  <rect width="${size}" height="${size}" fill="url(#bgGradient)" rx="${size * 0.15}"/>
  <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" rx="${size * 0.1}" fill="url(#iconGradient)"/>
  <text x="${center}" y="${center + size * 0.08}" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="#0a0a0a" text-anchor="middle" dominant-baseline="middle">H</text>
</svg>`;
};

// Generate badge icon SVG
const createBadgeSVG = (): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="72" height="72" xmlns="http://www.w3.org/2000/svg">
  <rect width="72" height="72" rx="8" fill="#00d4ff"/>
</svg>`;
};

// Generate all PWA icons as PNG files
const generateIcons = async () => {
  const cwd = process.cwd();
  const publicDir = cwd.endsWith('holdwall') 
    ? join(cwd, 'public')
    : join(cwd, 'holdwall', 'public');
  
  console.log('Generating PWA icons...\n');
  
  // Create high-resolution source SVG
  const sourceSVG = createIconSVG();
  const sourceBuffer = Buffer.from(sourceSVG);
  
  // Generate all size variants from high-res source
  for (const size of sizes) {
    const pngPath = join(publicDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(sourceBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 10, g: 10, b: 10, alpha: 1 }
        })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(pngPath);
      console.log(`✅ Generated icon-${size}x${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to create icon-${size}x${size}.png:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Also create the simplified names used in manifest.ts
  const png192Path = join(publicDir, 'icon-192.png');
  try {
    await sharp(sourceBuffer)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(png192Path);
    console.log('✅ Generated icon-192.png (192x192)');
  } catch (error) {
    console.error('❌ Failed to create icon-192.png:', error instanceof Error ? error.message : String(error));
  }
  
  const png512Path = join(publicDir, 'icon-512.png');
  try {
    await sharp(sourceBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(png512Path);
    console.log('✅ Generated icon-512.png (512x512)');
  } catch (error) {
    console.error('❌ Failed to create icon-512.png:', error instanceof Error ? error.message : String(error));
  }
  
  // Generate badge icon for push notifications
  const badgeSvg = createBadgeSVG();
  const badgePath = join(publicDir, 'badge-72x72.png');
  try {
    await sharp(Buffer.from(badgeSvg))
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(badgePath);
    console.log('✅ Generated badge-72x72.png (72x72)');
  } catch (error) {
    console.error('❌ Failed to create badge-72x72.png:', error instanceof Error ? error.message : String(error));
  }
  
  console.log('\n✅ All PWA icons generated successfully!');
};

generateIcons().catch((error) => {
  console.error('Failed to generate icons:', error);
  process.exit(1);
});
