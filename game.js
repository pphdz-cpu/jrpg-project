const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 40;
const MAP_SIZE = 10;
const ENCOUNTER_CHANCE = 0.15;
const SPRITE_COLS = 6;
const SPRITE_ROWS = 4;
const WALK_FRAMES = 4;

const TERRAIN_ASSETS = {
  grass: 'assets/grass.png',
  forest: 'assets/forest.png',
  path: 'assets/path.png',
  town: 'assets/town.png',
};

const CHARACTER_SHEET_PATH = 'assets/character_sheet.png';

const DIRECTION_SPRITES = {
  0: { row: 0, startCol: 0, cropTop: 130 },
  1: { row: 3, startCol: 0, cropTop: 70 },
  2: { row: 2, startCol: 1, cropTop: 75 },
  3: { row: 1, startCol: 1, cropTop: 75 },
};

const TILE_TO_ASSET = {
  0: 'grass',
  1: 'forest',
  2: 'path',
  3: 'town',
};

const cachedTiles = {};
const cachedPlayerFrames = {};
let characterSheet = null;

const map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 2, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const player = {
  x: 1,
  y: 1,
  direction: 0,
  currentFrame: 0,
  isMoving: false,
};

const keysHeld = new Set();

let movementEnabled = true;
let assetsReady = false;

function getSpriteColX(sheet, col) {
  return Math.round((col * sheet.width) / SPRITE_COLS);
}

function getSpriteRowY(sheet, row) {
  return Math.round((row * sheet.height) / SPRITE_ROWS);
}

function isSpritePixel(r, g, b, a) {
  if (a < 20) {
    return false;
  }

  if (r < 40 && g < 40 && b < 40) {
    return false;
  }

  if (r > 240 && g > 240 && b > 240) {
    return false;
  }

  return true;
}

function cacheImage(key, image) {
  const offscreen = document.createElement('canvas');
  offscreen.width = TILE_SIZE;
  offscreen.height = TILE_SIZE;

  const offCtx = offscreen.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(image, 0, 0, TILE_SIZE, TILE_SIZE);

  cachedTiles[key] = offscreen;
}

function cacheFallbackTile(key) {
  const offscreen = document.createElement('canvas');
  offscreen.width = TILE_SIZE;
  offscreen.height = TILE_SIZE;

  const offCtx = offscreen.getContext('2d');
  const colors = {
    grass: '#4caf50',
    forest: '#2e5a2e',
    path: '#c4a35a',
    town: '#8b6914',
  };
  offCtx.fillStyle = colors[key];
  offCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  cachedTiles[key] = offscreen;
}

function cacheCharacterFrame(sheet, sx, sy, sw, sh) {
  const temp = document.createElement('canvas');
  temp.width = sw;
  temp.height = sh;

  const tempCtx = temp.getContext('2d');
  tempCtx.imageSmoothingEnabled = false;
  tempCtx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);

  const { data } = tempCtx.getImageData(0, 0, sw, sh);
  let minX = sw;
  let minY = sh;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (isSpritePixel(r, g, b, a)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const frame = document.createElement('canvas');
  frame.width = TILE_SIZE;
  frame.height = TILE_SIZE;

  const frameCtx = frame.getContext('2d');
  frameCtx.imageSmoothingEnabled = false;

  if (maxX >= minX && maxY >= minY) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    frameCtx.drawImage(temp, minX, minY, cropW, cropH, 0, 0, TILE_SIZE, TILE_SIZE);
  }

  return frame;
}

function buildCharacterFrames(sheet) {
  Object.entries(DIRECTION_SPRITES).forEach(([direction, config]) => {
    cachedPlayerFrames[direction] = [];

    for (let frame = 0; frame < WALK_FRAMES; frame++) {
      const col = config.startCol + frame;
      const sx = getSpriteColX(sheet, col);
      const sy = getSpriteRowY(sheet, config.row) + config.cropTop;
      const sw = getSpriteColX(sheet, col + 1) - sx;
      const sh = getSpriteRowY(sheet, config.row + 1) - sy - config.cropTop;

      cachedPlayerFrames[direction].push(
        cacheCharacterFrame(sheet, sx, sy, sw, sh)
      );
    }
  });
}

function preloadAssets(onComplete) {
  const terrainKeys = Object.keys(TERRAIN_ASSETS);
  let loadedCount = 0;
  const totalAssets = terrainKeys.length + 1;

  function checkComplete() {
    loadedCount += 1;

    if (loadedCount === totalAssets) {
      assetsReady = true;
      onComplete();
    }
  }

  terrainKeys.forEach((key) => {
    const image = new Image();

    image.onload = () => {
      cacheImage(key, image);
      checkComplete();
    };

    image.onerror = () => {
      console.error(`Failed to load asset: ${TERRAIN_ASSETS[key]}`);
      cacheFallbackTile(key);
      checkComplete();
    };

    image.src = TERRAIN_ASSETS[key];
  });

  const sheet = new Image();

  sheet.onload = () => {
    characterSheet = sheet;
    buildCharacterFrames(sheet);
    checkComplete();
  };

  sheet.onerror = () => {
    console.error(`Failed to load asset: ${CHARACTER_SHEET_PATH}`);
    checkComplete();
  };

  sheet.src = CHARACTER_SHEET_PATH;
}

function drawPlayer() {
  const drawX = player.x * TILE_SIZE;
  const drawY = player.y * TILE_SIZE;
  const directionFrames = cachedPlayerFrames[player.direction];

  if (!directionFrames || !directionFrames[player.currentFrame]) {
    ctx.fillStyle = '#2196f3';
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
    return;
  }

  ctx.drawImage(
    directionFrames[player.currentFrame],
    drawX,
    drawY
  );
}

function draw() {
  if (!assetsReady) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const tile = map[row][col];
      const tileKey = TILE_TO_ASSET[tile];
      ctx.drawImage(
        cachedTiles[tileKey],
        col * TILE_SIZE,
        row * TILE_SIZE
      );
    }
  }

  drawPlayer();
}

function isWalkable(x, y) {
  const tile = map[y][x];
  return tile === 0 || tile === 2 || tile === 3;
}

function setPlayerDirection(key) {
  switch (key) {
    case 'ArrowDown':
      player.direction = 0;
      break;
    case 'ArrowLeft':
      player.direction = 1;
      break;
    case 'ArrowRight':
      player.direction = 2;
      break;
    case 'ArrowUp':
      player.direction = 3;
      break;
    default:
      break;
  }
}

function isArrowKey(key) {
  return key === 'ArrowUp'
    || key === 'ArrowDown'
    || key === 'ArrowLeft'
    || key === 'ArrowRight';
}

function triggerEncounter() {
  movementEnabled = false;
  document.getElementById('map-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  startBattle();
}

function tryRandomEncounter() {
  if (Math.random() < ENCOUNTER_CHANCE) {
    triggerEncounter();
  }
}

function movePlayer(dx, dy) {
  const newX = player.x + dx;
  const newY = player.y + dy;

  if (isWalkable(newX, newY)) {
    player.x = newX;
    player.y = newY;
    player.currentFrame = (player.currentFrame + 1) % WALK_FRAMES;
    tryRandomEncounter();
    return true;
  }

  return false;
}

window.onBattleVictory = function () {
  movementEnabled = true;
  draw();
};

document.addEventListener('keydown', (event) => {
  if (!movementEnabled || !isArrowKey(event.key) || keysHeld.has(event.key)) {
    return;
  }

  keysHeld.add(event.key);
  player.isMoving = true;
  setPlayerDirection(event.key);

  switch (event.key) {
    case 'ArrowUp':
      movePlayer(0, -1);
      break;
    case 'ArrowDown':
      movePlayer(0, 1);
      break;
    case 'ArrowLeft':
      movePlayer(-1, 0);
      break;
    case 'ArrowRight':
      movePlayer(1, 0);
      break;
    default:
      break;
  }

  draw();
  event.preventDefault();
});

document.addEventListener('keyup', (event) => {
  if (!isArrowKey(event.key)) {
    return;
  }

  keysHeld.delete(event.key);

  if (keysHeld.size === 0) {
    player.isMoving = false;
    player.currentFrame = 0;
    draw();
  }
});

if (!canvas || !ctx) {
  document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
} else {
  preloadAssets(draw);
}
