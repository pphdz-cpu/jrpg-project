const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { detectMapCollision } = require('../detect-map-collision');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readLevel() {
  const levelPath = path.join(ROOT, 'assets/level.js');
  const source = fs.readFileSync(levelPath, 'utf8');
  return Function(`return ${source.replace('window.TILED_LEVEL =', '')}`)();
}

function validateLevel(level) {
  if (!level.blocked || !level.overhead) {
    error('assets/level.js is missing blocked or overhead grids. Run: npm run build:map');
    return;
  }

  if (level.blocked.length !== level.height) {
    error(`blocked grid has ${level.blocked.length} rows, expected ${level.height}`);
  }

  if (level.overhead.length !== level.height) {
    error(`overhead grid has ${level.overhead.length} rows, expected ${level.height}`);
  }

  level.blocked.forEach((row, rowIndex) => {
    if (row.length !== level.width) {
      error(`blocked row ${rowIndex} has ${row.length} cols, expected ${level.width}`);
    }

    row.forEach((value, colIndex) => {
      if (value !== 0 && value !== 1) {
        error(`blocked[${rowIndex}][${colIndex}] has invalid value ${value}`);
      }
    });
  });

  level.overhead.forEach((row, rowIndex) => {
    if (row.length !== level.width) {
      error(`overhead row ${rowIndex} has ${row.length} cols, expected ${level.width}`);
    }
  });

  const spawns = (level.spawns || []).filter((spawn) => spawn.name === 'PlayerSpawn');
  if (spawns.length === 0) {
    warn('No PlayerSpawn points found in level.js');
    return;
  }

  const walkableSpawns = spawns.filter((spawn) => {
    const x = Math.floor(spawn.x / level.tileWidth);
    const y = Math.floor(spawn.y / level.tileWidth);
    return x >= 0 && y >= 0 && x < level.width && y < level.height && !level.blocked[y][x];
  });

  if (walkableSpawns.length === 0) {
    error('All PlayerSpawn points are blocked');
  }
}

function validateCharacterAssets() {
  const required = [
    'assets/map-tileset.png',
    'assets/images/characters/roster.json',
    'assets/images/characters/chain_armor/player_idle.png',
    'assets/images/characters/chain_armor/player_walk.png',
    'assets/images/characters/chain_armor/player.json',
    'assets/images/characters/chain_armor/preview.png',
    'assets/Characters/chain_armor.gif',
  ];

  required.forEach((relativePath) => {
    if (!fs.existsSync(path.join(ROOT, relativePath))) {
      error(`Missing required asset: ${relativePath}`);
    }
  });

  const rosterPath = path.join(ROOT, 'assets/images/characters/roster.json');
  if (!fs.existsSync(rosterPath)) {
    return null;
  }

  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  if (!Array.isArray(roster) || roster.length === 0) {
    error('assets/images/characters/roster.json must contain at least one character');
    return null;
  }

  roster.forEach((entry) => {
    ['preview', 'idle', 'walk', 'meta'].forEach((key) => {
      if (!entry[key]) {
        error(`Roster entry ${entry.id || '(unknown)'} is missing ${key}`);
        return;
      }

      const assetPath = path.join(ROOT, entry[key]);
      if (!fs.existsSync(assetPath)) {
        error(`Missing roster asset for ${entry.id}: ${entry[key]}`);
      }
    });
  });

  const metaPath = path.join(ROOT, 'assets/images/characters/chain_armor/player.json');
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

async function validateCharacterSheet(meta) {
  if (!meta) {
    return;
  }

  const walkPath = path.join(ROOT, 'assets/images/characters/chain_armor/player_walk.png');
  if (!fs.existsSync(walkPath)) {
    return;
  }

  const walkSheet = await Jimp.read(walkPath);
  const expectedWidth = meta.frameWidth * meta.walkFrameCount;
  const expectedHeight = meta.frameHeight * 4;

  if (walkSheet.bitmap.width !== expectedWidth) {
    error(
      `player_walk.png width is ${walkSheet.bitmap.width}, expected ${expectedWidth}. Run: npm run build:player`
    );
  }

  if (walkSheet.bitmap.height !== expectedHeight) {
    warn(
      `player_walk.png height is ${walkSheet.bitmap.height}, expected ${expectedHeight}`
    );
  }
}

async function validateCollisionPipeline(level) {
  const collision = await detectMapCollision({
    mockupPath: path.join(ROOT, 'assets/mockup.png'),
    logicPath: path.join(ROOT, 'assets/logic.png'),
    mapWidth: level.width,
    mapHeight: level.height,
    offsetX: level.offsetX || 0,
    offsetY: level.offsetY || 0,
  });

  if (collision.blocked.length !== level.height || collision.overhead.length !== level.height) {
    error('detectMapCollision returned grids with unexpected dimensions');
  }
}

async function main() {
  const level = readLevel();
  validateLevel(level);
  const meta = validateCharacterAssets();
  await validateCharacterSheet(meta);
  await validateCollisionPipeline(level);

  if (warnings.length > 0) {
    console.warn('Warnings:');
    warnings.forEach((message) => console.warn(`- ${message}`));
  }

  if (errors.length > 0) {
    console.error('Validation failed:');
    errors.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log('Validation passed.');
}

main().catch((validationError) => {
  console.error(validationError.message);
  process.exit(1);
});
