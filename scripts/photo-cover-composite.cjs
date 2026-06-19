#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const tasks = [
  {
    dir: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/2026-06-02-6-source-6fd205064718f010",
    source: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/batch-runs/cover-sources-2026-06-02/running-volume-track.jpg",
    provider: "unsplash-photo-composite",
    sourceUrl: "https://unsplash.com/photos/race-track-ij5_qCBpIVY",
    author: "Kolleen Gladden",
    theme: "volume",
  },
  {
    dir: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/2026-06-02-2-source-9109587982310cb0",
    source: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/batch-runs/cover-sources-2026-06-02/half-marathon-track.jpg",
    provider: "unsplash-photo-composite",
    sourceUrl: "https://unsplash.com/photos/people-running-on-race-track-poa-Ycw1W8U",
    author: "Nicolas Hoizey",
    theme: "half",
  },
  {
    dir: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/2026-06-02-source-055d0bbb92b9dc6c",
    source: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/batch-runs/cover-sources-2026-06-02/vo2-running-shoe.jpg",
    provider: "unsplash-photo-composite",
    sourceUrl: "https://unsplash.com/photos/runners-foot-in-a-bright-orange-athletic-shoe-on-track-HWkpa-_LDDI",
    author: "Taylor Friehl",
    theme: "vo2",
  },
  {
    dir: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/2026-06-02-source-7dccf35bda47ea97",
    source: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/batch-runs/cover-sources-2026-06-02/morning-run-city.jpg",
    provider: "unsplash-photo-composite",
    sourceUrl: "https://unsplash.com/photos/runner-enjoys-a-sunlit-morning-jog-on-a-sidewalk-tTmREypgEfU",
    author: "MAK",
    theme: "morning",
  },
  {
    dir: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/2026-06-02-4-source-a704c5603372bbae",
    source: "/Users/hui/Documents/ContentFactoryVault/04-Outputs/batch-runs/cover-sources-2026-06-02/running-habits-shoes.jpg",
    provider: "unsplash-photo-composite",
    sourceUrl: "https://unsplash.com/photos/runner-tying-shoes-on-a-track-7PkYHRHSQXA",
    author: "Kenny Leys",
    theme: "habits",
  },
];

function overlaySvg(theme) {
  const base = `
<defs>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f172a" stop-opacity="0.18"/>
    <stop offset="0.55" stop-color="#0f172a" stop-opacity="0.03"/>
    <stop offset="1" stop-color="#0f172a" stop-opacity="0.30"/>
  </linearGradient>
  <radialGradient id="warm" cx="78%" cy="15%" r="55%">
    <stop offset="0" stop-color="#fbbf24" stop-opacity="0.30"/>
    <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
  </radialGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.20"/>
  </filter>
</defs>
<rect width="1200" height="900" fill="url(#shade)"/>
<rect width="1200" height="900" fill="url(#warm)"/>`;
  const card = (x, y, w, h, body) => `
  <g transform="translate(${x} ${y})" filter="url(#shadow)">
    <rect width="${w}" height="${h}" rx="28" fill="#ffffff" fill-opacity="0.78"/>
    ${body}
  </g>`;
  const volume = card(
    820,
    92,
    270,
    170,
    `<text x="30" y="54" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#64748b">RECOVERY</text>
     <rect x="32" y="96" width="24" height="46" rx="12" fill="#94a3b8"/>
     <rect x="70" y="78" width="24" height="64" rx="12" fill="#94a3b8"/>
     <rect x="108" y="58" width="24" height="84" rx="12" fill="#f59e0b"/>
     <rect x="146" y="36" width="24" height="106" rx="12" fill="#f97316"/>
     <rect x="184" y="24" width="24" height="118" rx="12" fill="#ef4444"/>`
  );
  const half = card(
    760,
    88,
    260,
    140,
    `<text x="34" y="92" font-family="Arial, sans-serif" font-size="62" font-weight="900" fill="#0f172a">02:00</text>`
  );
  const vo2 = card(
    735,
    100,
    285,
    160,
    `<text x="34" y="55" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#334155">VO2 MAX</text>
     <path d="M36 112 C70 78 102 120 132 82 C162 44 198 74 236 42" fill="none" stroke="#f97316" stroke-width="11" stroke-linecap="round"/>
     <circle cx="238" cy="42" r="13" fill="#f97316"/>`
  );
  const morning = card(
    88,
    96,
    255,
    145,
    `<circle cx="70" cy="72" r="42" fill="#f59e0b" fill-opacity="0.75"/>
     <path d="M132 82 C160 38 218 50 224 98 C202 118 156 120 132 82Z" fill="#38bdf8" fill-opacity="0.50"/>`
  );
  const habits = card(
    775,
    96,
    295,
    160,
    `<circle cx="55" cy="72" r="30" fill="#f59e0b" fill-opacity="0.72"/>
     <circle cx="127" cy="72" r="30" fill="#22c55e" fill-opacity="0.55"/>
     <circle cx="199" cy="72" r="30" fill="#38bdf8" fill-opacity="0.50"/>
     <rect x="39" y="116" width="175" height="12" rx="6" fill="#0f172a" fill-opacity="0.26"/>`
  );
  return `<svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">${base}${{ volume, half, vo2, morning, habits }[theme] || ""}</svg>`;
}

async function compose(task) {
  const imagePath = path.join(task.dir, "images", "cover.png");
  const previousPath = path.join(task.dir, "images", "cover.before-photo-composite.png");
  if (fs.existsSync(imagePath) && !fs.existsSync(previousPath)) {
    fs.copyFileSync(imagePath, previousPath);
  }
  await sharp(task.source)
    .resize(1200, 900, { fit: "cover", position: task.theme === "morning" || task.theme === "habits" ? "center" : "attention" })
    .modulate({ saturation: 1.02, brightness: 0.98 })
    .composite([{ input: Buffer.from(overlaySvg(task.theme)), blend: "over" }])
    .png()
    .toFile(imagePath);

  const metadataPath = path.join(task.dir, "metadata.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.images = metadata.images || {};
  metadata.images.cover = {
    ...(metadata.images.cover || {}),
    status: "generated",
    promptFile: "cover-prompt.md",
    outputPath: "images/cover.png",
    ratio: "4:3",
    width: 1200,
    height: 900,
    provider: task.provider,
    model: "unsplash-photo-plus-theme-overlay",
    sourceUrl: task.sourceUrl,
    sourceAuthor: task.author,
    generatedAt: new Date().toISOString(),
  };
  delete metadata.images.cover.error;
  metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
}

(async () => {
  for (const task of tasks) {
    await compose(task);
    console.log(`${task.theme}: ${path.join(task.dir, "images", "cover.png")}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
