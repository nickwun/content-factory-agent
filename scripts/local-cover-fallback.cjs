#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(items, hash, offset = 0) {
  return items[(hash + offset) % items.length];
}

async function main() {
  const promptPath = argValue("--promptfiles");
  const imagePath = argValue("--image");
  if (!promptPath || !imagePath) {
    throw new Error("Usage: local-cover-fallback.cjs --promptfiles <path> --image <path>");
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const hash = hashText(prompt);
  const palettes = [
    ["#e9f3ef", "#577a70", "#f2a65a", "#1f3b36"],
    ["#edf1f7", "#5f6f8f", "#d99058", "#26364d"],
    ["#f5efe6", "#6e7f68", "#c86b4a", "#2e3a2f"],
    ["#eef5f6", "#4e8194", "#e0a458", "#23333a"],
    ["#f3f0ea", "#7b6f5d", "#cf7b5a", "#312c26"],
  ];
  const [bg, deep, accent, ink] = pick(palettes, hash);
  const sunX = 880 + (hash % 90);
  const runnerX = 410 + (hash % 180);
  const runnerY = 490 + (hash % 25);
  const laneOffset = hash % 70;

  const svg = `
<svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="0.66" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="track" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${deep}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${ink}" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
  <rect width="1200" height="900" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="205" r="96" fill="${accent}" opacity="0.25"/>
  <circle cx="${sunX - 60}" cy="190" r="150" fill="${accent}" opacity="0.08" filter="url(#soft)"/>
  <path d="M0 420 C190 365 310 390 460 342 C660 280 860 330 1200 250 L1200 900 L0 900 Z" fill="${deep}" opacity="0.12"/>
  <path d="M0 575 C220 505 470 520 690 485 C860 458 1020 430 1200 360 L1200 900 L0 900 Z" fill="${deep}" opacity="0.22"/>
  <path d="M-80 730 C250 610 575 655 1280 520 L1280 900 L-80 900 Z" fill="url(#track)"/>
  <path d="M-40 ${710 + laneOffset} C300 ${625 + laneOffset / 4} 640 ${650 + laneOffset / 5} 1240 ${565 + laneOffset / 3}" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.38"/>
  <path d="M-40 ${780 + laneOffset / 2} C300 ${700 + laneOffset / 4} 700 ${720 + laneOffset / 6} 1240 ${650 + laneOffset / 5}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.24"/>
  <g transform="translate(${runnerX} ${runnerY})" fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="0" cy="-92" r="31" fill="${ink}" stroke="none"/>
    <path d="M-4 -58 C-22 -20 -10 22 16 58" stroke-width="24"/>
    <path d="M-9 -18 C-62 -10 -92 18 -116 55" stroke-width="16"/>
    <path d="M6 -12 C54 -4 88 16 122 47" stroke-width="16"/>
    <path d="M18 55 C-18 95 -45 137 -72 182" stroke-width="18"/>
    <path d="M24 56 C67 96 101 129 144 160" stroke-width="18"/>
  </g>
  <g opacity="0.55" fill="${ink}">
    <ellipse cx="${runnerX - 20}" cy="${runnerY + 210}" rx="180" ry="24" opacity="0.16"/>
    <rect x="84" y="210" width="72" height="230" rx="10" opacity="0.12"/>
    <rect x="182" y="165" width="92" height="275" rx="10" opacity="0.1"/>
    <rect x="1008" y="185" width="84" height="300" rx="10" opacity="0.1"/>
  </g>
  <circle cx="104" cy="642" r="4" fill="#ffffff" opacity="0.8"/>
  <circle cx="214" cy="610" r="3" fill="#ffffff" opacity="0.7"/>
  <circle cx="1030" cy="518" r="4" fill="#ffffff" opacity="0.72"/>
</svg>`;

  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  process.stdout.write(JSON.stringify({ provider: "local-fallback", model: "sharp-svg-cover" }));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
