const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const INPUT_SHEET = path.join(__dirname, 'assets/character_sheet.png');
const OUTPUT_SHEET = path.join(__dirname, 'assets/character_sheet_processed.png');
const OUTPUT_FRAMES = path.join(__dirname, 'assets/characterFrames.js');

const CELL_W = 341;
const CELL_H = 512;
const FRAME_COLS = [1, 2, 3, 4];
const DIRECTION_ROWS = {
  0: 0,
  1: 3,
  2: 2,
  3: 1,
};

function isBackground(r, g, b) {
  return (r > 235 && g > 235 && b > 235) || (r < 55 && g < 55 && b < 55);
}

function trimFrame(sheet, col, row) {
  const x0 = col * CELL_W;
  const y0 = row * CELL_H;
  let minX = CELL_W;
  let minY = CELL_H;
  let maxX = 0;
  let maxY = 0;

  for (let y = y0; y < y0 + CELL_H; y += 1) {
    for (let x = x0; x < x0 + CELL_W; x += 1) {
      const { a } = Jimp.intToRGBA(sheet.getPixelColor(x, y));
      if (a > 10) {
        minX = Math.min(minX, x - x0);
        minY = Math.min(minY, y - y0);
        maxX = Math.max(maxX, x - x0);
        maxY = Math.max(maxY, y - y0);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { sx: x0, sy: y0, sw: CELL_W, sh: CELL_H };
  }

  return {
    sx: x0 + minX,
    sy: y0 + minY,
    sw: maxX - minX + 1,
    sh: maxY - minY + 1,
  };
}

async function main() {
  if (!fs.existsSync(INPUT_SHEET)) {
    throw new Error(`Missing ${INPUT_SHEET}`);
  }

  const sheet = await Jimp.read(INPUT_SHEET);

  sheet.scan(0, 0, sheet.bitmap.width, sheet.bitmap.height, function processPixel(x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    if (isBackground(r, g, b)) {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  await sheet.writeAsync(OUTPUT_SHEET);

  const frames = {};

  Object.entries(DIRECTION_ROWS).forEach(([direction, row]) => {
    frames[direction] = FRAME_COLS.map((col) => trimFrame(sheet, col, row));
  });

  const fileContents = `window.CHARACTER_SPRITE_SHEET = 'assets/character_sheet_processed.png';\nwindow.CHARACTER_FRAMES = ${JSON.stringify(frames, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FRAMES, fileContents, 'utf8');

  console.log(`Wrote ${OUTPUT_SHEET}`);
  console.log(`Wrote ${OUTPUT_FRAMES}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
