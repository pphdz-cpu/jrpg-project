const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { generateTiledMap } = require('./generate-tiled-map');

const TILE_SIZE = 16;
const ASSETS_DIR = path.join(__dirname, 'assets');
const MOCKUP_PATH = path.join(ASSETS_DIR, 'mockup.png');
const LOGIC_PATH = path.join(ASSETS_DIR, 'logic.png');
const TOWN_FALLBACK_PATH = path.join(ASSETS_DIR, 'town.png');
const TILESET_PATH = path.join(ASSETS_DIR, 'map-tileset.png');
const TMX_PATH = path.join(ASSETS_DIR, 'level.tmx');
const LEVEL_JS_PATH = path.join(ASSETS_DIR, 'level.js');

function fillLogicTile(logic, col, row, hexColor) {
  const color = Jimp.cssColorToHex(hexColor);

  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      logic.setPixelColor(color, col * TILE_SIZE + dx, row * TILE_SIZE + dy);
    }
  }
}

function analyzeMockupTile(mockup, col, row) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      const { r, g, b } = Jimp.intToRGBA(
        mockup.getPixelColor(col * TILE_SIZE + dx, row * TILE_SIZE + dy)
      );
      totalR += r;
      totalG += g;
      totalB += b;
      count += 1;
    }
  }

  const r = totalR / count;
  const g = totalG / count;
  const b = totalB / count;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  const isGrass = g > 95 && g > r + 12 && g > b + 12;
  const isPath = max - min < 35 && r > 70 && r < 190 && g > 70 && g < 190 && b > 70 && b < 190;
  const isWater = b > 110 && b > r + 35 && b > g + 20;
  const isWalkable = isGrass || isPath;

  return {
    r,
    g,
    b,
    isGrass,
    isPath,
    isWater,
    isWalkable,
    isCollision: !isWalkable || isWater,
  };
}

async function ensureMockupImage() {
  if (fs.existsSync(MOCKUP_PATH)) {
    return MOCKUP_PATH;
  }

  if (!fs.existsSync(TOWN_FALLBACK_PATH)) {
    throw new Error(
      `Missing ${MOCKUP_PATH}. Add mockup.png to assets/ or provide assets/town.png.`
    );
  }

  fs.copyFileSync(TOWN_FALLBACK_PATH, MOCKUP_PATH);
  console.log(`Copied ${TOWN_FALLBACK_PATH} -> ${MOCKUP_PATH}`);
  return MOCKUP_PATH;
}

async function generateLogicImage(mockupPath, outputPath) {
  const mockup = await Jimp.read(mockupPath);
  const logic = new Jimp(mockup.bitmap.width, mockup.bitmap.height, Jimp.cssColorToHex('#000000'));

  const mapWidth = mockup.bitmap.width / TILE_SIZE;
  const mapHeight = mockup.bitmap.height / TILE_SIZE;
  const walkableTiles = [];

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      const tileInfo = analyzeMockupTile(mockup, col, row);

      if (tileInfo.isCollision) {
        fillLogicTile(logic, col, row, '#0000FF');
        continue;
      }

      walkableTiles.push({ col, row });

      if (tileInfo.isPath && (col + row) % 11 === 0) {
        fillLogicTile(logic, col, row, '#FFFF00');
      }
    }
  }

  const centerCol = Math.floor(mapWidth / 2);
  const centerRow = Math.floor(mapHeight / 2);
  let spawnTile = walkableTiles.find((tile) => tile.col === centerCol && tile.row === centerRow);

  if (!spawnTile) {
    let bestDistance = Number.POSITIVE_INFINITY;

    walkableTiles.forEach((tile) => {
      const distance = Math.abs(tile.col - centerCol) + Math.abs(tile.row - centerRow);
      if (distance < bestDistance) {
        bestDistance = distance;
        spawnTile = tile;
      }
    });
  }

  if (spawnTile) {
    fillLogicTile(logic, spawnTile.col, spawnTile.row, '#FF0000');
  }

  await logic.writeAsync(outputPath);
  console.log(`Wrote ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const mockupPath = await ensureMockupImage();
  await generateLogicImage(mockupPath, LOGIC_PATH);

  await generateTiledMap({
    inputImage: mockupPath,
    logicImage: LOGIC_PATH,
    tilesetImage: TILESET_PATH,
    outputMap: TMX_PATH,
    outputJs: LEVEL_JS_PATH,
    tilesetSourceInTmx: 'map-tileset.png',
    tilesetPublicPath: 'assets/map-tileset.png',
    displayTileSize: 32,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
