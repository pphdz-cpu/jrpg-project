const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const TILE_SIZE = 16;
const INPUT_IMAGE = 'mockup.png';
const LOGIC_IMAGE = 'logic.png';
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

function classifyLogicRegion(logic, col, row) {
  const startX = col * TILE_SIZE;
  const startY = row * TILE_SIZE;
  let firstColor = null;

  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      const { r, g, b } = Jimp.intToRGBA(
        logic.getPixelColor(startX + dx, startY + dy)
      );

      if (!firstColor) {
        firstColor = { r, g, b };
        continue;
      }

      if (firstColor.r !== r || firstColor.g !== g || firstColor.b !== b) {
        return null;
      }
    }
  }

  if (!firstColor) {
    return null;
  }

  const { r, g, b } = firstColor;

  if (r === 255 && g === 0 && b === 0) {
    return 'spawn';
  }

  if (r === 0 && g === 0 && b === 255) {
    return 'collision';
  }

  if (r === 255 && g === 255 && b === 0) {
    return 'damage';
  }

  return null;
}

function buildTileMetadataXml(collisionTileIds, damageTileIds) {
  const tileIds = new Set([...collisionTileIds, ...damageTileIds]);
  if (tileIds.size === 0) {
    return '';
  }

  const sortedIds = [...tileIds].sort((a, b) => a - b);
  const tileBlocks = sortedIds.map((tileId) => {
    const parts = [];

    if (damageTileIds.has(tileId)) {
      parts.push(
        '   <properties>',
        '    <property name="damage" type="int" value="10"/>',
        '   </properties>'
      );
    }

    if (collisionTileIds.has(tileId)) {
      parts.push(
        '   <objectgroup draworder="index">',
        `    <object id="1" x="0" y="0" width="${TILE_SIZE}" height="${TILE_SIZE}"/>`,
        '   </objectgroup>'
      );
    }

    return `  <tile id="${tileId}">\n${parts.join('\n')}\n  </tile>`;
  });

  return `\n${tileBlocks.join('\n')}`;
}

function buildObjectsLayerXml(spawnPoints) {
  if (spawnPoints.length === 0) {
    return '';
  }

  const objects = spawnPoints
    .map(
      (spawn, index) =>
        `  <object id="${index + 1}" name="PlayerSpawn" x="${spawn.x}" y="${spawn.y}" width="${TILE_SIZE}" height="${TILE_SIZE}"/>`
    )
    .join('\n');

  return `\n <objectgroup id="2" name="Objects">\n${objects}\n </objectgroup>`;
}

async function main() {
  const inputPath = path.resolve(INPUT_IMAGE);
  const logicPath = path.resolve(LOGIC_IMAGE);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  if (!fs.existsSync(logicPath)) {
    throw new Error(`Logic image not found: ${logicPath}`);
  }

  const mockup = await Jimp.read(inputPath);
  const logic = await Jimp.read(logicPath);
  const { width, height } = mockup.bitmap;

  if (logic.bitmap.width !== width || logic.bitmap.height !== height) {
    throw new Error(
      `${LOGIC_IMAGE} must match ${INPUT_IMAGE} dimensions. Got ${logic.bitmap.width}x${logic.bitmap.height}, expected ${width}x${height}.`
    );
  }

  if (width % TILE_SIZE !== 0 || height % TILE_SIZE !== 0) {
    throw new Error(
      `Image dimensions must be divisible by ${TILE_SIZE}. Got ${width}x${height}.`
    );
  }

  const mapWidth = width / TILE_SIZE;
  const mapHeight = height / TILE_SIZE;

  const uniqueTiles = [];
  const hashToIndex = new Map();
  const mapData = new Array(mapWidth * mapHeight).fill(0);
  const collisionTileIds = new Set();
  const damageTileIds = new Set();
  const spawnPoints = [];

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      const cellIndex = row * mapWidth + col;
      const logicType = classifyLogicRegion(logic, col, row);

      if (logicType === 'spawn') {
        spawnPoints.push({
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
        });
        continue;
      }

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

      mapData[cellIndex] = tileIndex + 1;

      if (logicType === 'collision') {
        collisionTileIds.add(tileIndex);
      } else if (logicType === 'damage') {
        damageTileIds.add(tileIndex);
      }
    }
  }

  const tileCount = uniqueTiles.length;
  const columns = buildTilesetColumns(tileCount);
  const rows = Math.ceil(tileCount / columns);
  const tilesetWidth = columns * TILE_SIZE;
  const tilesetHeight = rows * TILE_SIZE;

  const tileset = new Jimp(tilesetWidth, tilesetHeight, 0x00000000);

  uniqueTiles.forEach((tile, index) => {
    const tileCol = index % columns;
    const tileRow = Math.floor(index / columns);
    tileset.composite(tile, tileCol * TILE_SIZE, tileRow * TILE_SIZE);
  });

  await tileset.writeAsync(TILESET_IMAGE);

  const csvRows = [];
  for (let row = 0; row < mapHeight; row += 1) {
    const rowValues = mapData.slice(row * mapWidth, (row + 1) * mapWidth);
    csvRows.push(rowValues.join(','));
  }

  const tileMetadataXml = buildTileMetadataXml(collisionTileIds, damageTileIds);
  const objectsLayerXml = buildObjectsLayerXml(spawnPoints);
  const nextLayerId = spawnPoints.length > 0 ? 3 : 2;
  const nextObjectId = spawnPoints.length + 1;

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${mapWidth}" height="${mapHeight}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" infinite="0" nextlayerid="${nextLayerId}" nextobjectid="${nextObjectId}">
 <tileset firstgid="1" name="tileset" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" tilecount="${tileCount}" columns="${columns}">
  <image source="${escapeXml(TILESET_IMAGE)}" width="${tilesetWidth}" height="${tilesetHeight}"/>${tileMetadataXml}
 </tileset>
 <layer id="1" name="Ground" width="${mapWidth}" height="${mapHeight}">
  <data encoding="csv">
${csvRows.join(',\n')}
  </data>
 </layer>${objectsLayerXml}
</map>
`;

  fs.writeFileSync(OUTPUT_MAP, tmx, 'utf8');

  console.log(`Read ${INPUT_IMAGE} (${width}x${height})`);
  console.log(`Read ${LOGIC_IMAGE} (${width}x${height})`);
  console.log(`Map size: ${mapWidth}x${mapHeight} tiles`);
  console.log(`Unique tiles: ${tileCount}`);
  console.log(`Player spawns: ${spawnPoints.length}`);
  console.log(`Collision tiles: ${collisionTileIds.size}`);
  console.log(`Damage tiles: ${damageTileIds.size}`);
  console.log(`Wrote ${TILESET_IMAGE} (${tilesetWidth}x${tilesetHeight})`);
  console.log(`Wrote ${OUTPUT_MAP}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
