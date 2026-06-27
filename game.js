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
  0: { row: 0, startCol: 0, cropTop: 130, innerX: 0.35, innerW: 0.6 },
  1: { row: 3, startCol: 0, cropTop: 70, innerX: 0.05, innerW: 0.55 },
  2: { row: 2, startCol: 1, cropTop: 75, innerX: 0.35, innerW: 0.6 },
  3: { row: 1, startCol: 1, cropTop: 75, innerX: 0.35, innerW: 0.6 },
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

const CHARACTER_ID = 'char_001';

const pauseMenu = document.getElementById('pause-menu');
const pauseNameEl = document.getElementById('pause-name');
const pauseJobEl = document.getElementById('pause-job');
const pauseHpEl = document.getElementById('pause-hp');
const pauseSpeedEl = document.getElementById('pause-speed');
const switchKnightBtn = document.getElementById('switch-knight-btn');
const switchBlackMageBtn = document.getElementById('switch-black-mage-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');

const keysHeld = new Set();

let movementEnabled = true;
let assetsReady = false;
let isPaused = false;

function getSpriteColX(sheet, col) {
  return Math.round((col * sheet.width) / SPRITE_COLS);
}

function getSpriteRowY(sheet, row) {
  return Math.round((row * sheet.height) / SPRITE_ROWS);
}

function getSpriteDrawRect(sheet, direction, frameIndex) {
  const config = DIRECTION_SPRITES[direction];
  const col = config.startCol + frameIndex;
  const sx = getSpriteColX(sheet, col);
  const sy = getSpriteRowY(sheet, config.row) + config.cropTop;
  const sw = getSpriteColX(sheet, col + 1) - sx;
  const sh = getSpriteRowY(sheet, config.row + 1) - sy - config.cropTop;
  const innerX = sx + Math.round(sw * config.innerX);
  const innerW = Math.round(sw * config.innerW);

  return { sx: innerX, sy, sw: innerW, sh };
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

function cacheCharacterFrame(sheet, direction, frameIndex) {
  const { sx, sy, sw, sh } = getSpriteDrawRect(sheet, direction, frameIndex);
  const frame = document.createElement('canvas');
  frame.width = TILE_SIZE;
  frame.height = TILE_SIZE;

  const frameCtx = frame.getContext('2d');
  frameCtx.imageSmoothingEnabled = false;
  frameCtx.drawImage(sheet, sx, sy, sw, sh, 0, 0, TILE_SIZE, TILE_SIZE);

  return frame;
}

function buildCharacterFrames(sheet) {
  Object.keys(DIRECTION_SPRITES).forEach((direction) => {
    cachedPlayerFrames[direction] = [];

    for (let frame = 0; frame < WALK_FRAMES; frame++) {
      cachedPlayerFrames[direction].push(
        cacheCharacterFrame(sheet, Number(direction), frame)
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
    try {
      characterSheet = sheet;
      buildCharacterFrames(sheet);
    } catch (error) {
      console.error('Failed to build character frames:', error);
      characterSheet = null;
    }

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
  const frameCanvas = directionFrames && directionFrames[player.currentFrame];

  if (frameCanvas) {
    ctx.drawImage(frameCanvas, drawX, drawY);
    return;
  }

  if (characterSheet) {
    const { sx, sy, sw, sh } = getSpriteDrawRect(
      characterSheet,
      player.direction,
      player.currentFrame
    );
    ctx.drawImage(
      characterSheet,
      sx,
      sy,
      sw,
      sh,
      drawX,
      drawY,
      TILE_SIZE,
      TILE_SIZE
    );
    return;
  }

  ctx.fillStyle = '#2196f3';
  ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
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

function isOnMapScreen() {
  return document.getElementById('map-screen').style.display !== 'none'
    && document.getElementById('battle-screen').style.display === 'none';
}

function updatePauseMenuStats() {
  const character = characters[CHARACTER_ID];
  const stats = calculateStats(CHARACTER_ID);
  const job = jobs[character.current_job];

  if (!stats || !job) {
    return;
  }

  pauseNameEl.textContent = character.name;
  pauseJobEl.textContent = job.name;
  pauseHpEl.textContent = stats.hp;
  pauseSpeedEl.textContent = stats.speed;
}

function openPauseMenu() {
  isPaused = true;
  updatePauseMenuStats();
  pauseMenu.style.display = 'block';
}

function closePauseMenu() {
  isPaused = false;
  pauseMenu.style.display = 'none';
}

function switchJob(jobId) {
  characters[CHARACTER_ID].current_job = jobId;
  updatePauseMenuStats();
}

function togglePauseMenu() {
  if (!isOnMapScreen() || !movementEnabled) {
    return;
  }

  if (isPaused) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
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
  if (isPaused) {
    return;
  }

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
  if (event.key === 'Enter' && isOnMapScreen() && movementEnabled) {
    togglePauseMenu();
    event.preventDefault();
    return;
  }

  if (!movementEnabled || isPaused || !isArrowKey(event.key) || keysHeld.has(event.key)) {
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
    if (!isPaused) {
      draw();
    }
  }
});

switchKnightBtn.addEventListener('click', () => {
  switchJob('job_knight');
});

switchBlackMageBtn.addEventListener('click', () => {
  switchJob('job_black_mage');
});

closeMenuBtn.addEventListener('click', () => {
  closePauseMenu();
});

if (!canvas || !ctx) {
  document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
} else {
  preloadAssets(draw);
}
