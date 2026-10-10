const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MAPS_DIR = path.join(__dirname, "..", "maps");
const INPUT = path.join(DATA_DIR, "stars.json");
const OUTPUT = path.join(MAPS_DIR, "stars.svg");
const LABELED_OUTPUT = path.join(MAPS_DIR, "NP5725_galaxy.svg");
const SHIPS_OUTPUT = path.join(MAPS_DIR, "stars_ships.svg");
const FLEETS = path.join(DATA_DIR, "fleets.json");
const SHIP_IMAGE = "../source/cropped/ship.png";
const SYMBOLS = path.join(DATA_DIR, "symbols.json");

const SIZE = 3000;
const MARGIN = 60;
const LABEL_PT = 6;
const SMALL_LABEL_PT = 4;
// Exponent > 1 darkens midtones and mutes the background.
const GAMMA = 2.5;

const escapeXml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function plotStars() {
  const stars = JSON.parse(fs.readFileSync(INPUT, "utf8"));

  const counts = new Map();
  for (const s of stars) counts.set(s.uid, (counts.get(s.uid) ?? 0) + 1);
  const owners = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const symbols = JSON.parse(fs.readFileSync(SYMBOLS, "utf8"));
  const symbolFor = (owner) => symbols[owner];

  const marker = (cx, cy, r, { color, shape, image }, title = "") => {
    const inner = title ? `<title>${escapeXml(title)}</title>` : "";
    if (image) {
      const d = r * 5;
      return `<image href="${image}" x="${(cx - d / 2).toFixed(2)}" y="${(cy - d / 2).toFixed(2)}" width="${d}" height="${d}">${inner}</image>`;
    }
    if (shape === "square") {
      return `<rect x="${(cx - r).toFixed(2)}" y="${(cy - r).toFixed(2)}" width="${2 * r}" height="${2 * r}" fill="${color}">${inner}</rect>`;
    }
    if (shape === "triangle") {
      const pts = [[cx, cy - r * 1.2], [cx - r * 1.1, cy + r * 0.9], [cx + r * 1.1, cy + r * 0.9]]
        .map((p) => p.map((v) => v.toFixed(2)).join(","))
        .join(" ");
      return `<polygon points="${pts}" fill="${color}">${inner}</polygon>`;
    }
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="${color}">${inner}</circle>`;
  };

  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = (SIZE - 2 * MARGIN) / Math.max(maxX - minX, maxY - minY);

  const px = (x) => MARGIN + (x - minX) * scale;
  // In-game +y points south, matching SVG's downward y axis.
  const py = (y) => MARGIN + (y - minY) * scale;

  const dots = stars
    .map(
      (s) =>
        marker(px(s.x), py(s.y), 3.5, symbolFor(s.uid), `${s.name} (${s.uid})`),
    )
    .join("\n");

  // Approximate label boxes (sans-serif avg glyph width ~0.55em) to find overlaps at the default size.
  const PX_PER_PT = 4 / 3;
  const box = (s, pt) => {
    const fs = pt * PX_PER_PT;
    const w = s.name.length * fs * 0.55;
    const x = px(s.x);
    const y = py(s.y) + 15;
    return { x0: x - w / 2, x1: x + w / 2, y0: y - fs, y1: y };
  };
  const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const boxes = stars.map((s) => box(s, LABEL_PT));
  const crowded = new Set();
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      if (hits(boxes[i], boxes[j])) {
        crowded.add(i);
        crowded.add(j);
      }
    }
  }
  console.log(`${crowded.size} labels overlap and use ${SMALL_LABEL_PT}pt:`);
  console.log([...crowded].map((i) => stars[i].name).join(", "));

  const labels = stars
    .map(
      (s, i) =>
        `<text x="${px(s.x).toFixed(2)}" y="${(py(s.y) + 15).toFixed(2)}" text-anchor="middle" font-size="${crowded.has(i) ? SMALL_LABEL_PT : LABEL_PT}pt" font-family="sans-serif" fill="white">${escapeXml(s.name)}</text>`,
    )
    .join("\n");

  const ROW = 22;
  const boxX = 15;
  const boxW = 190;
  const boxH = (owners.length + 1) * ROW + 16;
  const boxY = SIZE - 15 - boxH;
  const legend = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="white"/>
<text x="${boxX + 12}" y="${boxY + 8 + ROW / 2 + 4}" font-size="14" font-weight="bold" font-family="sans-serif">Star Count</text>
${owners
    .map((o, i) => {
      const cy = boxY + 8 + ROW / 2 + (i + 1) * ROW;
      return `${marker(boxX + 20, cy, 6, symbolFor(o))}<text x="${boxX + 40}" y="${cy + 4}" font-size="13" font-family="sans-serif">${escapeXml(o)} (${counts.get(o)})</text>`;
    })
    .join("\n")}`;

  const build = (extra) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="100%" height="100%" fill="white"/>
<defs><filter id="nebula-blur" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="gamma" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/></feComponentTransfer></filter></defs>
<image href="../source/clouds2.jpg" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" filter="url(#gamma)"/>
<image href="../source/clouds3.jpg" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" opacity="0.075" filter="url(#nebula-blur)"/>
${dots}
${extra}
${legend}
</svg>
`;

  // Each fleet is its owner's symbol with the ship icon on top, drawn at the same size as a star marker.
  // Fleets sitting on a star, or with no movement, keep the icon pointing up.
  // Heading is last position (lx, ly) -> current position (x, y); verified against each fleet's first order target.
  const starPositions = new Set(stars.map((s) => `${s.x},${s.y}`));
  const fleets = JSON.parse(fs.readFileSync(FLEETS, "utf8"));
  const shipD = 3.5 * 5;
  let rotated = 0;
  const ships = fleets
    .map((f) => {
      const cx = px(f.x);
      const cy = py(f.y);
      const d = shipD * 0.6;
      const hx = f.x - f.lx;
      const hy = f.y - f.ly;
      const atStar = starPositions.has(`${f.x},${f.y}`);
      let transform = "";
      if (!atStar && (hx || hy)) {
        const angle = (Math.atan2(hx, -hy) * 180) / Math.PI;
        transform = ` transform="rotate(${angle.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`;
        rotated++;
      }
      return `${marker(cx, cy, 3.5, symbolFor(f.uid), `${f.uid} fleet ${f.fleetNumber} (${f.size})`)}<image href="${SHIP_IMAGE}" x="${(cx - d / 2).toFixed(2)}" y="${(cy - d / 2).toFixed(2)}" width="${d}" height="${d}"${transform}/>`;
    })
    .join("\n");
  console.log(`${rotated} of ${fleets.length} fleets rotated`);

  // Strength sits below the ship; fleets on a star drop a line lower to clear the star's name.
  const strengths = fleets
    .map((f) => {
      const dy = starPositions.has(`${f.x},${f.y}`) ? 24 : 15;
      return `<text x="${px(f.x).toFixed(2)}" y="${(py(f.y) + dy).toFixed(2)}" text-anchor="middle" font-size="${LABEL_PT}pt" font-family="sans-serif" fill="#ffe08a">${f.size}</text>`;
    })
    .join("\n");

  fs.writeFileSync(OUTPUT, build(""));
  fs.writeFileSync(LABELED_OUTPUT, build(labels));
  fs.writeFileSync(SHIPS_OUTPUT, build(`${labels}\n${ships}\n${strengths}`));
  return [OUTPUT, LABELED_OUTPUT, SHIPS_OUTPUT];
}

if (require.main === module) {
  console.log(`Wrote ${plotStars().join(", ")}`);
}

module.exports = { plotStars };
