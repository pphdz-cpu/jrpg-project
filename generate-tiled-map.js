const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const TILE_SIZE = 16;
const INPUT_IMAGE = 'mockup.png';
const TILESET_IMAGE = 'tileset.png';
const OUTPUT_MAP = 'level.tmx';

function tileHash(tile) {
  return crypto.createHash('sha256').update(tile.bitmap.data).digest('hex');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTilesetColumns(tileCount) {
  return Math.max(1, Math.ceil(Math.sqrt(tileCount)));
}

async function main() {
  const inputPath = path.resolve(INPUT_IMAGE);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  const mockup = await Jimp.read(inputPath);
  const { width, height } = mockup.bitmap;

  if (width % TILE_SIZE !== 0 || height % TILE_SIZE !== 0) {
    throw new Error(
      `Image dimensions must be divisible by ${TILE_SIZE}. Got ${width}x${height}.`
    );
  }

  const mapWidth = width / TILE_SIZE;
  const mapHeight = height / TILE_SIZE;

  const uniqueTiles = [];
  const hashToIndex = new Map();
  const mapData = new Array(mapWidth * mapHeight);

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      const tile = mockup
        .clone()
        .crop(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      const hash = tileHash(tile);
      let tileIndex = hashToIndex.get(hash);

      if (tileIndex === undefined) {
        tileIndex = uniqueTiles.length;
        hashToIndex.set(hash, tileIndex);
        uniqueTiles.push(tile);
      }

      // Tiled GIDs start at 1; 0 means empty.
      mapData[row * mapWidth + col] = tileIndex + 1;
    }
  }

  const tileCount = uniqueTiles.length;
  const columns = buildTilesetColumns(tileCount);
  const rows = Math.ceil(tileCount / columns);
  const tilesetWidth = columns * TILE_SIZE;
  const tilesetHeight = rows * TILE_SIZE;

  const tileset = new Jimp(tilesetWidth, tilesetHeight, 0x00000000);

  uniqueTiles.forEach((tile, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    tileset.composite(tile, col * TILE_SIZE, row * TILE_SIZE);
  });

  await tileset.writeAsync(TILESET_IMAGE);

  const csvRows = [];
  for (let row = 0; row < mapHeight; row += 1) {
    const rowValues = mapData.slice(row * mapWidth, (row + 1) * mapWidth);
    csvRows.push(rowValues.join(','));
  }

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${mapWidth}" height="${mapHeight}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" name="tileset" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" tilecount="${tileCount}" columns="${columns}">
  <image source="${escapeXml(TILESET_IMAGE)}" width="${tilesetWidth}" height="${tilesetHeight}"/>
 </tileset>
 <layer id="1" name="Ground" width="${mapWidth}" height="${mapHeight}">
  <data encoding="csv">
${csvRows.join(',\n')}
  </data>
 </layer>
</map>
`;

  fs.writeFileSync(OUTPUT_MAP, tmx, 'utf8');

  console.log(`Read ${INPUT_IMAGE} (${width}x${height})`);
  console.log(`Map size: ${mapWidth}x${mapHeight} tiles`);
  console.log(`Unique tiles: ${tileCount}`);
  console.log(`Wrote ${TILESET_IMAGE} (${tilesetWidth}x${tilesetHeight})`);
  console.log(`Wrote ${OUTPUT_MAP}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
