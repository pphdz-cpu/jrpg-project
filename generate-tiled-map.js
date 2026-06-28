const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const TILE_SIZE = 16;
const DEFAULT_INPUT_IMAGE = 'mockup.png';
const DEFAULT_LOGIC_IMAGE = 'logic.png';
const DEFAULT_TILESET_IMAGE = 'tileset.png';
const DEFAULT_OUTPUT_MAP = 'level.tmx';

const LOGIC_COLORS = {
  spawn: { r: 255, g: 0, b: 0 },
  collision: { r: 0, g: 0, b: 255 },
  damage: { r: 255, g: 255, b: 0 },
};

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

function isExactLogicColor(r, g, b, logicColor) {
  return r === logicColor.r && g === logicColor.g && b === logicColor.b;
}

function buildTilesetColumns(tileCount) {
  return Math.max(1, Math.ceil(Math.sqrt(tileCount)));
}

function classifyLogicRegion(logic, col, row, offsetX, offsetY) {
  let spawnPixels = 0;
  let collisionPixels = 0;
  let damagePixels = 0;

  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      const { r, g, b } = Jimp.intToRGBA(
        logic.getPixelColor(offsetX + col * TILE_SIZE + dx, offsetY + row * TILE_SIZE + dy)
      );

      if (isExactLogicColor(r, g, b, LOGIC_COLORS.spawn)) {
        spawnPixels += 1;
      } else if (isExactLogicColor(r, g, b, LOGIC_COLORS.collision)) {
        collisionPixels += 1;
      } else if (isExactLogicColor(r, g, b, LOGIC_COLORS.damage)) {
        damagePixels += 1;
      }
    }
  }

  if (spawnPixels > 0) {
    return 'spawn';
  }

  if (damagePixels > 0) {
    return 'damage';
  }

  if (collisionPixels > 0) {
    return 'collision';
  }

  return null;
}

function extractTile(image, col, row, offsetX, offsetY) {
  return image
    .clone()
    .crop(
      offsetX + col * TILE_SIZE,
      offsetY + row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
}

function buildTileMetadataXml(collisionTileIds, damageTileIds, entityWidth, entityHeight) {
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
        `    <object id="1" x="0" y="0" width="${entityWidth}" height="${entityHeight}"/>`,
        '   </objectgroup>'
      );
    }

    return `  <tile id="${tileId}">\n${parts.join('\n')}\n  </tile>`;
  });

  return `\n${tileBlocks.join('\n')}`;
}

function buildObjectsLayerXml(spawnPoints, entityWidth, entityHeight) {
  if (spawnPoints.length === 0) {
    return '';
  }

  const objects = spawnPoints
    .map(
      (spawn, index) =>
        `  <object id="${index + 1}" name="PlayerSpawn" x="${spawn.x}" y="${spawn.y}" width="${entityWidth}" height="${entityHeight}"/>`
    )
    .join('\n');

  return `\n <objectgroup id="2" name="Objects">\n${objects}\n </objectgroup>`;
}

function buildLayerGrid(mapData, mapWidth, mapHeight) {
  const layer = [];

  for (let row = 0; row < mapHeight; row += 1) {
    layer.push(mapData.slice(row * mapWidth, (row + 1) * mapWidth));
  }

  return layer;
}

function writeLevelJs(outputPath, levelData) {
  const content = `window.TILED_LEVEL = ${JSON.stringify(levelData, null, 2)};\n`;
  fs.writeFileSync(outputPath, content, 'utf8');
}

function resolveGridGeometry(width, height, offsetX, offsetY) {
  const usableWidth = width - offsetX;
  const usableHeight = height - offsetY;

  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new Error(
      `Grid offset (${offsetX}, ${offsetY}) leaves no usable image area in ${width}x${height}.`
    );
  }

  if (usableWidth % TILE_SIZE !== 0 || usableHeight % TILE_SIZE !== 0) {
    throw new Error(
      `Usable mockup area must be divisible by ${TILE_SIZE}. Got ${usableWidth}x${usableHeight} after offset (${offsetX}, ${offsetY}). Crop mockup.png to a ${TILE_SIZE}px grid before running the script.`
    );
  }

  return {
    mapWidth: usableWidth / TILE_SIZE,
    mapHeight: usableHeight / TILE_SIZE,
    offsetX,
    offsetY,
  };
}

async function measureEntityDimensions(mockup, offsetX, offsetY, mapWidth, mapHeight) {
  const isLogicPixel = (r, g, b) =>
    isExactLogicColor(r, g, b, LOGIC_COLORS.spawn)
    || isExactLogicColor(r, g, b, LOGIC_COLORS.collision)
    || isExactLogicColor(r, g, b, LOGIC_COLORS.damage);

  const isGrassPixel = (r, g, b) => g > 95 && g > r + 12 && g > b + 12;
  const isCharacterPixel = (r, g, b) =>
    !isLogicPixel(r, g, b)
    && !isGrassPixel(r, g, b)
    && (
      (b > 120 && b > r + 20 && g < 190)
      || (r > 185 && g > 145 && b > 105 && r >= g)
      || (r > 210 && g > 180 && b > 90)
    );

  const candidates = [];

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      let characterPixels = 0;

      for (let dy = 0; dy < TILE_SIZE; dy += 1) {
        for (let dx = 0; dx < TILE_SIZE; dx += 1) {
          const { r, g, b } = Jimp.intToRGBA(
            mockup.getPixelColor(offsetX + col * TILE_SIZE + dx, offsetY + row * TILE_SIZE + dy)
          );

          if (isCharacterPixel(r, g, b)) {
            characterPixels += 1;
          }
        }
      }

      if (characterPixels >= 18) {
        candidates.push({ col, row, characterPixels });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      entityWidth: TILE_SIZE,
      entityHeight: TILE_SIZE,
      entityVisualHeight: TILE_SIZE * 2,
    };
  }

  candidates.sort((a, b) => b.characterPixels - a.characterPixels);
  const anchor = candidates[0];
  const anchorX = offsetX + anchor.col * TILE_SIZE + Math.floor(TILE_SIZE / 2);
  const anchorY = offsetY + anchor.row * TILE_SIZE + Math.floor(TILE_SIZE / 2);

  let top = anchorY;
  let bottom = anchorY;
  let left = anchorX;
  let right = anchorX;

  for (let y = anchorY - TILE_SIZE * 2; y <= anchorY + TILE_SIZE; y += 1) {
    if (y < offsetY || y >= mockup.bitmap.height) {
      continue;
    }

    let rowHasCharacter = false;

    for (let x = anchorX - TILE_SIZE; x <= anchorX + TILE_SIZE; x += 1) {
      if (x < offsetX || x >= mockup.bitmap.width) {
        continue;
      }

      const { r, g, b } = Jimp.intToRGBA(mockup.getPixelColor(x, y));
      if (isCharacterPixel(r, g, b)) {
        rowHasCharacter = true;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }

    if (rowHasCharacter) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  const measuredWidth = Math.max(TILE_SIZE, right - left + 1);
  const measuredHeight = Math.max(TILE_SIZE, bottom - top + 1);

  return {
    entityWidth: TILE_SIZE,
    entityHeight: TILE_SIZE,
    entityVisualHeight: Math.max(TILE_SIZE, Math.min(measuredHeight, TILE_SIZE * 4)),
    entityMeasuredWidth: measuredWidth,
    entityMeasuredHeight: measuredHeight,
  };
}

async function verifyReconstruction(mockup, mapData, uniqueTiles, columns, mapWidth, mapHeight, offsetX, offsetY) {
  const reconstructed = new Jimp(
    mapWidth * TILE_SIZE,
    mapHeight * TILE_SIZE,
    0x00000000
  );

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      const gid = mapData[row * mapWidth + col];
      if (!gid) {
        continue;
      }

      const tile = uniqueTiles[gid - 1];
      reconstructed.composite(tile, col * TILE_SIZE, row * TILE_SIZE);
    }
  }

  let mismatches = 0;

  for (let y = 0; y < reconstructed.bitmap.height; y += 1) {
    for (let x = 0; x < reconstructed.bitmap.width; x += 1) {
      const source = Jimp.intToRGBA(
        mockup.getPixelColor(offsetX + x, offsetY + y)
      );
      const rebuilt = Jimp.intToRGBA(reconstructed.getPixelColor(x, y));

      if (
        source.r !== rebuilt.r
        || source.g !== rebuilt.g
        || source.b !== rebuilt.b
        || source.a !== rebuilt.a
      ) {
        mismatches += 1;
      }
    }
  }

  return mismatches;
}

async function generateTiledMap(options = {}) {
  const inputImage = options.inputImage || DEFAULT_INPUT_IMAGE;
  const logicImage = options.logicImage || DEFAULT_LOGIC_IMAGE;
  const tilesetImage = options.tilesetImage || DEFAULT_TILESET_IMAGE;
  const outputMap = options.outputMap || DEFAULT_OUTPUT_MAP;
  const outputJs = options.outputJs || null;
  const tilesetSourceInTmx = options.tilesetSourceInTmx || path.basename(tilesetImage);
  const offsetX = Number.isInteger(options.offsetX) ? options.offsetX : 0;
  const offsetY = Number.isInteger(options.offsetY) ? options.offsetY : 0;

  const inputPath = path.resolve(inputImage);
  const logicPath = path.resolve(logicImage);

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
      `${logicImage} must match ${inputImage} dimensions exactly. Got ${logic.bitmap.width}x${logic.bitmap.height}, expected ${width}x${height}.`
    );
  }

  const { mapWidth, mapHeight } = resolveGridGeometry(width, height, offsetX, offsetY);
  const entityDimensions = await measureEntityDimensions(
    mockup,
    offsetX,
    offsetY,
    mapWidth,
    mapHeight
  );

  const uniqueTiles = [];
  const hashToIndex = new Map();
  const mapData = new Array(mapWidth * mapHeight).fill(0);
  const collisionTileIds = new Set();
  const damageTileIds = new Set();
  const spawnPoints = [];

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      const cellIndex = row * mapWidth + col;
      const tile = extractTile(mockup, col, row, offsetX, offsetY);
      const logicType = classifyLogicRegion(logic, col, row, offsetX, offsetY);

      const hash = tileHash(tile);
      let tileIndex = hashToIndex.get(hash);

      if (tileIndex === undefined) {
        tileIndex = uniqueTiles.length;
        hashToIndex.set(hash, tileIndex);
        uniqueTiles.push(tile);
      }

      mapData[cellIndex] = tileIndex + 1;

      if (logicType === 'spawn') {
        spawnPoints.push({
          name: 'PlayerSpawn',
          x: offsetX + col * TILE_SIZE,
          y: offsetY + row * TILE_SIZE,
        });
      } else if (logicType === 'collision') {
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

  await tileset.writeAsync(tilesetImage);

  const csvRows = [];
  for (let row = 0; row < mapHeight; row += 1) {
    const rowValues = mapData.slice(row * mapWidth, (row + 1) * mapWidth);
    csvRows.push(rowValues.join(','));
  }

  const tileMetadataXml = buildTileMetadataXml(
    collisionTileIds,
    damageTileIds,
    entityDimensions.entityWidth,
    entityDimensions.entityHeight
  );
  const objectsLayerXml = buildObjectsLayerXml(
    spawnPoints,
    entityDimensions.entityWidth,
    entityDimensions.entityHeight
  );
  const nextLayerId = spawnPoints.length > 0 ? 3 : 2;
  const nextObjectId = spawnPoints.length + 1;

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${mapWidth}" height="${mapHeight}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" infinite="0" nextlayerid="${nextLayerId}" nextobjectid="${nextObjectId}">
 <tileset firstgid="1" name="tileset" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" tilecount="${tileCount}" columns="${columns}" margin="0" spacing="0">
  <image source="${escapeXml(tilesetSourceInTmx)}" width="${tilesetWidth}" height="${tilesetHeight}"/>${tileMetadataXml}
 </tileset>
 <layer id="1" name="Ground" width="${mapWidth}" height="${mapHeight}">
  <data encoding="csv">
${csvRows.join('\n')}
  </data>
 </layer>${objectsLayerXml}
</map>
`;

  fs.writeFileSync(outputMap, tmx, 'utf8');

  const mismatches = await verifyReconstruction(
    mockup,
    mapData,
    uniqueTiles,
    columns,
    mapWidth,
    mapHeight,
    offsetX,
    offsetY
  );

  const levelData = {
    tileWidth: TILE_SIZE,
    displayTileSize: options.displayTileSize || 32,
    width: mapWidth,
    height: mapHeight,
    offsetX,
    offsetY,
    tileset: options.tilesetPublicPath || tilesetImage.replace(/\\/g, '/'),
    tilesetColumns: columns,
    firstGid: 1,
    layer: buildLayerGrid(mapData, mapWidth, mapHeight),
    collisionTileIds: [...collisionTileIds].sort((a, b) => a - b),
    damageTileIds: [...damageTileIds].sort((a, b) => a - b),
    spawns: spawnPoints,
    entityWidth: entityDimensions.entityWidth,
    entityHeight: entityDimensions.entityHeight,
    entityVisualHeight: entityDimensions.entityVisualHeight,
  };

  if (outputJs) {
    writeLevelJs(outputJs, levelData);
  }

  const summary = {
    inputImage,
    logicImage,
    tilesetImage,
    outputMap,
    outputJs,
    width,
    height,
    offsetX,
    offsetY,
    mapWidth,
    mapHeight,
    tileCount,
    spawnCount: spawnPoints.length,
    collisionTileCount: collisionTileIds.size,
    damageTileCount: damageTileIds.size,
    tilesetWidth,
    tilesetHeight,
    mismatches,
    entityDimensions,
    levelData,
  };

  console.log(`Read ${inputImage} (${width}x${height})`);
  console.log(`Read ${logicImage} (${width}x${height})`);
  console.log(`Grid offset: (${offsetX}, ${offsetY})`);
  console.log(`Map size: ${mapWidth}x${mapHeight} tiles`);
  console.log(`Unique tiles: ${tileCount}`);
  console.log(`Player spawns: ${spawnPoints.length}`);
  console.log(`Collision tiles: ${collisionTileIds.size}`);
  console.log(`Damage tiles: ${damageTileIds.size}`);
  console.log(`Entity footprint: ${entityDimensions.entityWidth}x${entityDimensions.entityHeight}px`);
  console.log(`Entity visual height: ${entityDimensions.entityVisualHeight}px`);
  console.log(`Reconstruction mismatches: ${mismatches}`);
  console.log(`Wrote ${tilesetImage} (${tilesetWidth}x${tilesetHeight})`);
  console.log(`Wrote ${outputMap}`);
  if (outputJs) {
    console.log(`Wrote ${outputJs}`);
  }

  if (mismatches > 0) {
    throw new Error(
      `Reconstruction verification failed with ${mismatches} mismatched pixels. Check mockup.png grid alignment and tile size.`
    );
  }

  return summary;
}

if (require.main === module) {
  generateTiledMap().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  TILE_SIZE,
  generateTiledMap,
  classifyLogicRegion,
  resolveGridGeometry,
};
