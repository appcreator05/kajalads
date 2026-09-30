const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Generate Logo SVG (1024x1024)
const logoSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#0b1736" />
      <stop offset="60%" stop-color="#060c20" />
      <stop offset="100%" stop-color="#030611" />
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="pillGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0088e8" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Outer Ring (Cyan) -->
  <circle cx="512" cy="512" r="492" fill="none" stroke="#00e5ff" stroke-width="22" filter="url(#glow)" />
  <circle cx="512" cy="512" r="476" fill="none" stroke="#00f5ff" stroke-width="4" opacity="0.8" />

  <!-- Main Background -->
  <circle cx="512" cy="512" r="472" fill="url(#bgGrad)" />

  <!-- Android Robot Head -->
  <g transform="translate(512, 255)">
    <!-- Antennae -->
    <line x1="-120" y1="-80" x2="-75" y2="-15" stroke="#00e5ff" stroke-width="16" stroke-linecap="round" />
    <line x1="120" y1="-80" x2="75" y2="-15" stroke="#00e5ff" stroke-width="16" stroke-linecap="round" />

    <!-- Dome -->
    <path d="M -155 0 A 155 125 0 0 1 155 0 Z" fill="#00e5ff" filter="url(#glow)" />

    <!-- Eyes -->
    <circle cx="-65" cy="-45" r="14" fill="#060c20" />
    <circle cx="65" cy="-45" r="14" fill="#060c20" />
  </g>

  <!-- Code Bracket </ > -->
  <g transform="translate(512, 365)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="52" fill="#00e5ff" text-anchor="middle" letter-spacing="4">&lt;/&gt;</text>
  </g>

  <!-- APP CREATOR Title -->
  <text x="512" y="540" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif" font-weight="900" font-size="64" fill="#ffffff" text-anchor="middle" letter-spacing="3">APP CREATOR</text>

  <!-- 05 Blue Pill Badge -->
  <g transform="translate(512, 645)" filter="url(#pillGlow)">
    <rect x="-125" y="-62" width="250" height="124" rx="36" fill="#0084d6" stroke="#38bdf8" stroke-width="5" />
    <text x="0" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif" font-weight="900" font-size="94" fill="#ffffff" text-anchor="middle">05</text>
  </g>

  <!-- WEB TO APK PLATFORM Subtitle -->
  <text x="512" y="795" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="25" fill="#00e5ff" text-anchor="middle" letter-spacing="4">WEB TO APK PLATFORM</text>
</svg>
`;

// 2. Generate Splash Screen SVG (1080x1920)
const splashSvg = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="splashBg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#0b1632" />
      <stop offset="45%" stop-color="#070c21" />
      <stop offset="100%" stop-color="#030510" />
    </radialGradient>
    <radialGradient id="circleInner" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="#0c1736" />
      <stop offset="70%" stop-color="#060b1d" />
      <stop offset="100%" stop-color="#02040c" />
    </radialGradient>
    <filter id="splashGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Main Dark Background -->
  <rect width="1080" height="1920" fill="url(#splashBg)" />

  <!-- Concentric Sound / Radio Wave Rings centered at (540, 770) -->
  <circle cx="540" cy="770" r="380" fill="none" stroke="#00e5ff" stroke-width="18" opacity="0.04" />
  <circle cx="540" cy="770" r="470" fill="none" stroke="#00e5ff" stroke-width="28" opacity="0.06" />
  <circle cx="540" cy="770" r="560" fill="none" stroke="#00e5ff" stroke-width="40" opacity="0.05" />
  <circle cx="540" cy="770" r="660" fill="none" stroke="#00e5ff" stroke-width="50" opacity="0.04" />
  <circle cx="540" cy="770" r="780" fill="none" stroke="#00e5ff" stroke-width="60" opacity="0.03" />

  <!-- Center Circular Badge: Diameter 580 (r=290) at (540, 770) -->
  <circle cx="540" cy="770" r="285" fill="none" stroke="#00e5ff" stroke-width="12" filter="url(#splashGlow)" />
  <circle cx="540" cy="770" r="275" fill="none" stroke="#00f5ff" stroke-width="3" opacity="0.7" />
  <circle cx="540" cy="770" r="272" fill="url(#circleInner)" />

  <!-- Inner Dark Android Circle -->
  <circle cx="540" cy="655" r="175" fill="#060b1c" stroke="#00e5ff" stroke-width="8" filter="url(#splashGlow)" />

  <!-- Android Robot Head inside dark circle -->
  <g transform="translate(540, 625)">
    <!-- Antennae -->
    <line x1="-72" y1="-50" x2="-45" y2="-10" stroke="#00e5ff" stroke-width="10" stroke-linecap="round" />
    <line x1="72" y1="-50" x2="45" y2="-10" stroke="#00e5ff" stroke-width="10" stroke-linecap="round" />

    <!-- Dome -->
    <path d="M -92 0 A 92 75 0 0 1 92 0 Z" fill="#00e5ff" />

    <!-- Eyes -->
    <circle cx="-38" cy="-28" r="8" fill="#060b1c" />
    <circle cx="38" cy="-28" r="8" fill="#060b1c" />
  </g>

  <!-- Code Bracket </ > inside circle -->
  <g transform="translate(540, 700)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#00e5ff" text-anchor="middle" letter-spacing="4">&lt;/&gt;</text>
  </g>

  <!-- APPCREATOR Title -->
  <text x="540" y="870" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif" font-weight="900" font-size="52" fill="#ffffff" text-anchor="middle" letter-spacing="3">APPCREATOR</text>

  <!-- 05 Blue Pill Badge -->
  <g transform="translate(540, 948)">
    <rect x="-95" y="-46" width="190" height="92" rx="28" fill="#0084d6" stroke="#38bdf8" stroke-width="4" />
    <text x="0" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif" font-weight="900" font-size="70" fill="#ffffff" text-anchor="middle">05</text>
  </g>

  <!-- Subtitle -->
  <text x="540" y="1040" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="20" fill="#00e5ff" text-anchor="middle" letter-spacing="3">WEB TO APK BUILDER &amp; WALLET</text>

  <!-- Bottom Loading Progress Bar at y=1620 -->
  <g transform="translate(540, 1620)">
    <!-- Track -->
    <rect x="-180" y="-4" width="360" height="8" rx="4" fill="#131e36" />
    <!-- Cyan Active Indicator -->
    <rect x="-180" y="-4" width="220" height="8" rx="4" fill="#00e5ff" filter="url(#barGlow)" />
  </g>

  <!-- Powered By Footer -->
  <text x="540" y="1670" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="16" fill="#64748b" text-anchor="middle" letter-spacing="2">POWERED BY APPCREATOR05</text>
</svg>
`;

async function main() {
  console.log('Rendering vector assets with sharp...');
  fs.writeFileSync('public/icon.svg', logoSvg.trim());

  // 1. logo.png (1024x1024)
  await sharp(Buffer.from(logoSvg))
    .png()
    .toFile('public/logo.png');
  console.log('Generated public/logo.png (1024x1024)');

  // Also 512x512 logo
  await sharp(Buffer.from(logoSvg))
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  // Also 192x192 logo
  await sharp(Buffer.from(logoSvg))
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  // 2. splash.png (1080x1920)
  await sharp(Buffer.from(splashSvg))
    .png()
    .toFile('public/splash.png');
  console.log('Generated public/splash.png (1080x1920)');

  // 3. Android mipmap densities:
  // mdpi: 48x48, hdpi: 72x72, xhdpi: 96x96, xxhdpi: 144x144, xxxhdpi: 192x192
  const densities = [
    { dir: 'android/app/src/main/res/mipmap-mdpi', size: 48 },
    { dir: 'android/app/src/main/res/mipmap-hdpi', size: 72 },
    { dir: 'android/app/src/main/res/mipmap-xhdpi', size: 96 },
    { dir: 'android/app/src/main/res/mipmap-xxhdpi', size: 144 },
    { dir: 'android/app/src/main/res/mipmap-xxxhdpi', size: 192 },
  ];

  for (const d of densities) {
    if (!fs.existsSync(d.dir)) {
      fs.mkdirSync(d.dir, { recursive: true });
    }
    await sharp(Buffer.from(logoSvg))
      .resize(d.size, d.size)
      .png()
      .toFile(path.join(d.dir, 'ic_launcher.png'));

    await sharp(Buffer.from(logoSvg))
      .resize(d.size, d.size)
      .png()
      .toFile(path.join(d.dir, 'ic_launcher_round.png'));
  }

  // Drawables
  const drawableDir = 'android/app/src/main/res/drawable';
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  await sharp(Buffer.from(logoSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(drawableDir, 'ic_launcher.png'));

  await sharp(Buffer.from(logoSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(drawableDir, 'ic_launcher_round.png'));

  await sharp(Buffer.from(splashSvg))
    .resize(1080, 1920)
    .png()
    .toFile(path.join(drawableDir, 'splash_bg.png'));

  await sharp(Buffer.from(splashSvg))
    .resize(1080, 1920)
    .png()
    .toFile(path.join(drawableDir, 'splash_image.png'));

  console.log('All android mipmaps & drawables generated!');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
