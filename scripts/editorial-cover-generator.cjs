#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function noise(seed = 7, opacity = 0.13) {
  return `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" seed="${seed}"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 ${opacity}"/></feComponentTransfer>
  </filter>`;
}

function defs(palette, seed) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.bg1}"/>
      <stop offset="0.52" stop-color="${palette.bg2}"/>
      <stop offset="1" stop-color="${palette.bg3}"/>
    </linearGradient>
    <linearGradient id="track" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${palette.deep}"/>
      <stop offset="1" stop-color="${palette.mid}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="18%" r="54%">
      <stop offset="0" stop-color="${palette.accent}" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="${palette.accent}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur16"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#111827" flood-opacity="0.22"/>
    </filter>
    ${noise(seed)}
  </defs>`;
}

function base(palette, seed, body) {
  return `
<svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
  ${defs(palette, seed)}
  <rect width="1200" height="900" fill="url(#bg)"/>
  <rect width="1200" height="900" fill="url(#glow)"/>
  <rect width="1200" height="900" filter="url(#grain)" opacity="0.72"/>
  ${body}
</svg>`;
}

function trackSweep(palette, y = 610) {
  return `
  <path d="M-120 ${y + 130} C190 ${y - 20} 520 ${y + 50} 1320 ${y - 160} L1320 930 L-120 930 Z" fill="url(#track)" opacity="0.94"/>
  <path d="M-40 ${y + 56} C240 ${y - 36} 585 ${y + 12} 1240 ${y - 118}" fill="none" stroke="#fff" stroke-width="5" opacity="0.36"/>
  <path d="M-20 ${y + 120} C250 ${y + 40} 620 ${y + 70} 1230 ${y - 32}" fill="none" stroke="#fff" stroke-width="3" opacity="0.2"/>
  <path d="M0 ${y + 190} C310 ${y + 106} 680 ${y + 120} 1220 ${y + 62}" fill="none" stroke="#fff" stroke-width="2" opacity="0.14"/>`;
}

function runnerMass(palette, x = 595, y = 498, scale = 1) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})" filter="url(#shadow)">
    <ellipse cx="16" cy="238" rx="190" ry="28" fill="#111827" opacity="0.18"/>
    <circle cx="-4" cy="-96" r="38" fill="${palette.ink}" opacity="0.98"/>
    <path d="M-24 -56 C-54 8 -35 72 22 124 C58 86 62 17 36 -45 Z" fill="${palette.ink}" opacity="0.98"/>
    <path d="M-30 -18 C-94 5 -130 42 -157 95 C-119 101 -74 75 -35 48 Z" fill="${palette.ink}" opacity="0.9"/>
    <path d="M28 -12 C95 4 139 35 183 80 C151 93 96 78 43 47 Z" fill="${palette.ink}" opacity="0.92"/>
    <path d="M20 112 C-44 156 -83 198 -122 260 C-82 270 -23 240 32 180 Z" fill="${palette.ink}" opacity="0.96"/>
    <path d="M46 112 C115 158 161 189 226 218 C204 248 136 248 56 184 Z" fill="${palette.ink}" opacity="0.9"/>
    <circle cx="22" cy="-12" r="22" fill="${palette.accent}" opacity="0.58"/>
  </g>`;
}

function shoeStillLife(palette, x = 625, y = 580) {
  return `
  <g transform="translate(${x} ${y})" filter="url(#shadow)">
    <ellipse cx="0" cy="118" rx="245" ry="34" fill="#111827" opacity="0.16"/>
    <path d="M-260 60 C-185 16 -94 20 -30 76 C-6 96 48 99 116 91 C148 86 175 105 182 134 C90 150 -84 145 -272 126 C-282 102 -279 77 -260 60 Z" fill="${palette.card}"/>
    <path d="M-227 61 C-168 43 -108 48 -47 89" fill="none" stroke="${palette.mid}" stroke-width="9" opacity="0.65"/>
    <path d="M76 92 C139 66 220 79 294 132 C224 154 96 155 -4 139 C6 112 29 99 76 92 Z" fill="${palette.card2}"/>
    <path d="M92 96 C155 91 211 107 264 136" fill="none" stroke="${palette.accent}" stroke-width="8" opacity="0.7"/>
    <circle cx="-20" cy="-34" r="52" fill="${palette.bg1}" stroke="${palette.ink}" stroke-width="13" opacity="0.92"/>
    <circle cx="-20" cy="-34" r="24" fill="${palette.accent}" opacity="0.72"/>
  </g>`;
}

function cardMetric(palette, x, y, title, value, width = 210) {
  return `
  <g transform="translate(${x} ${y})" filter="url(#shadow)">
    <rect x="0" y="0" width="${width}" height="132" rx="28" fill="#ffffff" opacity="0.84"/>
    <text x="28" y="48" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${palette.mid}" opacity="0.85">${esc(title)}</text>
    <text x="28" y="96" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="${palette.ink}">${esc(value)}</text>
  </g>`;
}

function levelsCover(palette, seed) {
  const bars = Array.from({ length: 6 }, (_, i) => {
    const h = 82 + i * 34;
    return `<rect x="${125 + i * 80}" y="${640 - h}" width="48" height="${h}" rx="22" fill="${i < 3 ? palette.mid : palette.accent}" opacity="${0.55 + i * 0.06}"/>`;
  }).join("");
  return base(palette, seed, `
    ${trackSweep(palette, 570)}
    <circle cx="905" cy="162" r="142" fill="${palette.accent}" opacity="0.2" filter="url(#blur16)"/>
    <g filter="url(#shadow)">${bars}</g>
    ${runnerMass(palette, 760, 455, 0.78)}
    ${cardMetric(palette, 750, 160, "WEEKLY", "6 LEVELS", 285)}
    <path d="M130 300 C260 250 385 258 530 210 C625 178 728 184 830 144" fill="none" stroke="${palette.accent}" stroke-width="9" opacity="0.46"/>
  `);
}

function halfMarathonCover(palette, seed) {
  return base(palette, seed, `
    ${trackSweep(palette, 595)}
    <path d="M115 205 L1085 205 L1085 287 L115 287 Z" fill="#ffffff" opacity="0.38" filter="url(#shadow)"/>
    <text x="600" y="268" text-anchor="middle" font-family="Arial, sans-serif" font-size="74" font-weight="900" fill="${palette.ink}" opacity="0.92">02:00</text>
    <g opacity="0.58">
      ${runnerMass(palette, 390, 498, 0.62)}
      ${runnerMass(palette, 610, 468, 0.72)}
      ${runnerMass(palette, 840, 505, 0.6)}
    </g>
    <path d="M95 300 C220 265 335 278 450 246 C570 212 710 226 840 202 C942 183 1024 172 1110 178" fill="none" stroke="${palette.accent}" stroke-width="8" opacity="0.5"/>
  `);
}

function vo2Cover(palette, seed) {
  return base(palette, seed, `
    <path d="M-80 660 C210 548 450 602 700 505 C884 433 1010 442 1280 335 L1280 930 L-80 930 Z" fill="url(#track)" opacity="0.82"/>
    <circle cx="300" cy="270" r="168" fill="#ffffff" opacity="0.32" filter="url(#blur16)"/>
    <g transform="translate(230 190)" filter="url(#shadow)">
      <path d="M100 120 C46 95 32 43 60 10 C92 33 111 70 116 123 C122 70 143 32 176 10 C204 44 190 95 136 120 C130 165 129 210 118 264 C107 210 106 165 100 120 Z" fill="#ffffff" opacity="0.83"/>
      <path d="M118 35 L118 264" stroke="${palette.mid}" stroke-width="10" opacity="0.56"/>
    </g>
    <path d="M140 655 C220 585 300 620 385 505 C474 384 580 422 650 325 C740 202 860 232 1020 145" fill="none" stroke="${palette.accent}" stroke-width="14" opacity="0.72"/>
    ${cardMetric(palette, 760, 250, "VO2 MAX", "UP", 250)}
    ${runnerMass(palette, 850, 520, 0.58)}
  `);
}

function morningCover(palette, seed) {
  return base(palette, seed, `
    <rect x="0" y="0" width="1200" height="900" fill="${palette.bg1}" opacity="0.28"/>
    <circle cx="950" cy="180" r="120" fill="${palette.accent}" opacity="0.42" filter="url(#blur16)"/>
    <path d="M0 480 L1200 360 L1200 900 L0 900 Z" fill="url(#track)" opacity="0.76"/>
    <g opacity="0.38" fill="${palette.ink}">
      <rect x="82" y="210" width="92" height="330" rx="18"/>
      <rect x="206" y="160" width="118" height="390" rx="18"/>
      <rect x="990" y="245" width="96" height="300" rx="18"/>
    </g>
    <g filter="url(#shadow)" transform="translate(260 515)">
      <rect x="-60" y="-50" width="310" height="190" rx="38" fill="#ffffff" opacity="0.8"/>
      <circle cx="28" cy="42" r="54" fill="${palette.accent}" opacity="0.82"/>
      <path d="M125 20 C165 -20 230 -6 240 48 C248 98 204 125 152 108 C121 99 97 60 125 20 Z" fill="${palette.mid}" opacity="0.78"/>
    </g>
    ${runnerMass(palette, 748, 462, 0.72)}
  `);
}

function habitsCover(palette, seed) {
  return base(palette, seed, `
    <path d="M-80 690 C220 548 525 620 1280 410 L1280 930 L-80 930 Z" fill="url(#track)" opacity="0.72"/>
    ${shoeStillLife(palette, 650, 540)}
    ${cardMetric(palette, 120, 166, "RECOVERY", "7-8h", 245)}
    <g transform="translate(886 144)" filter="url(#shadow)">
      <rect x="0" y="0" width="245" height="150" rx="34" fill="#ffffff" opacity="0.83"/>
      <circle cx="68" cy="76" r="42" fill="${palette.accent}" opacity="0.72"/>
      <rect x="124" y="42" width="72" height="82" rx="20" fill="${palette.mid}" opacity="0.7"/>
    </g>
    <path d="M140 470 C250 405 360 423 470 368 C548 330 620 322 714 285" fill="none" stroke="${palette.accent}" stroke-width="10" opacity="0.44"/>
  `);
}

function pickPalette(key) {
  const palettes = [
    { bg1: "#edf5f2", bg2: "#f8faf7", bg3: "#f0b76a", deep: "#21453f", mid: "#5f887e", accent: "#e29b50", ink: "#102924", card: "#f6f0e6", card2: "#e7eee9" },
    { bg1: "#eef3f8", bg2: "#f9fbff", bg3: "#d99b72", deep: "#24364f", mid: "#657da4", accent: "#e1935f", ink: "#121f34", card: "#f4efe8", card2: "#e8edf4" },
    { bg1: "#f4f0e8", bg2: "#fffaf0", bg3: "#8eb6aa", deep: "#3a4034", mid: "#7a8b68", accent: "#d36e4f", ink: "#282c22", card: "#fbf3e8", card2: "#e9eee1" },
    { bg1: "#eaf4f5", bg2: "#fbffff", bg3: "#e6be76", deep: "#213a43", mid: "#4d8292", accent: "#dca14e", ink: "#14262d", card: "#f6efe2", card2: "#dfeef0" },
    { bg1: "#f2eef3", bg2: "#fff9f4", bg3: "#b6d1c4", deep: "#302d42", mid: "#786f95", accent: "#d9835f", ink: "#201d2d", card: "#f8eee7", card2: "#e8e3ef" },
  ];
  return palettes[key % palettes.length];
}

async function main() {
  const promptPath = argValue("--promptfiles");
  const imagePath = argValue("--image");
  if (!promptPath || !imagePath) {
    throw new Error("Usage: editorial-cover-generator.cjs --promptfiles <path> --image <path>");
  }
  const outputDir = path.dirname(path.dirname(promptPath));
  const metadataPath = path.join(outputDir, "metadata.json");
  const prompt = fs.readFileSync(promptPath, "utf8");
  const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {};
  const title = String(metadata.title || prompt);
  const key = hashText(title + prompt);
  const palette = pickPalette(key);
  const lower = title + prompt;
  let svg;
  if (/半马|2小时|2 小时/.test(lower)) {
    svg = halfMarathonCover(palette, key);
  } else if (/摄氧|VO2|心肺/.test(lower)) {
    svg = vo2Cover(palette, key);
  } else if (/晨跑|犯困|早起/.test(lower)) {
    svg = morningCover(palette, key);
  } else if (/习惯|防晒|睡眠|配速/.test(lower)) {
    svg = habitsCover(palette, key);
  } else {
    svg = levelsCover(palette, key);
  }
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  process.stdout.write(JSON.stringify({ provider: "local-editorial", model: "sharp-svg-magazine-cover" }));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
