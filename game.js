const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const MAP_SIZE = 10;
const ENCOUNTER_CHANCE = 0.15;
const SPRITE_COLS = 4;
const SPRITE_ROWS = 4;

const TERRAIN_ASSETS = {
  grass: 'assets/grass.png',
  forest: 'assets/forest.png',
  path: 'assets/path.png',
  town: 'assets/town.png',
};

const CHARACTER_SHEET_PATH = 'assets/character_sheet.png';

const TILE_TO_ASSET = {
  0: 'grass',
  1: 'forest',
  2: 'path',
  3: 'town',
};

const cachedTiles = {};
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

let movementEnabled = true;
let assetsReady = false;

function cacheImage(key, image) {
  const offscreen = document.createElement('canvas');
  offscreen.width = TILE_SIZE;
  offscreen.height = TILE_SIZE;

  const offCtx = offscreen.getContext('2d');
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

  if (!characterSheet) {
    ctx.fillStyle = '#2196f3';
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
    return;
  }

  const frameWidth = characterSheet.width / SPRITE_COLS;
  const frameHeight = characterSheet.height / SPRITE_ROWS;
  const sourceX = player.currentFrame * frameWidth;
  const sourceY = player.direction * frameHeight;

  ctx.drawImage(
    characterSheet,
    sourceX,
    sourceY,
    frameWidth,
    frameHeight,
    drawX,
    drawY,
    TILE_SIZE,
    TILE_SIZE
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
    player.currentFrame = (player.currentFrame + 1) % SPRITE_COLS;
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
  if (!movementEnabled) {
    return;
  }

  switch (event.key) {
    case 'ArrowUp':
      player.isMoving = true;
      setPlayerDirection(event.key);
      movePlayer(0, -1);
      draw();
      break;
    case 'ArrowDown':
      player.isMoving = true;
      setPlayerDirection(event.key);
      movePlayer(0, 1);
      draw();
      break;
    case 'ArrowLeft':
      player.isMoving = true;
      setPlayerDirection(event.key);
      movePlayer(-1, 0);
      draw();
      break;
    case 'ArrowRight':
      player.isMoving = true;
      setPlayerDirection(event.key);
      movePlayer(1, 0);
      draw();
      break;
    default:
      return;
  }

  event.preventDefault();
});

document.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      player.isMoving = false;
      player.currentFrame = 0;
      draw();
      break;
    default:
      break;
  }
});

if (!canvas || !ctx) {
  document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
} else {
  preloadAssets(draw);
}
