const canvas = document.getElementById('gameCanvas');
const ctx = canvas && canvas.getContext('2d');

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

const ENCOUNTER_CHANCE = 0.15;
const WALK_FRAMES = 4;
const CHARACTER_SHEET_PATH = 'assets/character_sheet.png';
const CHARACTER_FALLBACK_PATH = 'assets/character.png';

const level = window.TILED_LEVEL;
const SOURCE_TILE_SIZE = level ? level.tileWidth : 16;
const tileSize = level ? level.displayTileSize : 32;

const map = level ? level.layer : [];
const mapRows = map.length;
const mapCols = map[0] ? map[0].length : 0;
const worldWidth = mapCols * tileSize;
const worldHeight = mapRows * tileSize;

const collisionTileIds = new Set(level ? level.collisionTileIds : []);
const damageTileIds = new Set(level ? level.damageTileIds : []);
const tilesetColumns = level ? level.tilesetColumns : 1;
const tilesetFirstGid = level ? level.firstGid : 1;
const TILESET_PATH = level ? level.tileset : 'assets/map-tileset.png';
const entityFootprintWidth = level && level.entityWidth ? level.entityWidth : SOURCE_TILE_SIZE;
const entityFootprintHeight = level && level.entityHeight ? level.entityHeight : SOURCE_TILE_SIZE;
const entityVisualHeight = level && level.entityVisualHeight ? level.entityVisualHeight : SOURCE_TILE_SIZE * 2;
const mapOffsetX = level && level.offsetX ? level.offsetX : 0;
const mapOffsetY = level && level.offsetY ? level.offsetY : 0;
const displayScale = tileSize / SOURCE_TILE_SIZE;

const SPRITE_FRAMES = {
  0: [
    { sx: 146, sy: 130, sw: 195, sh: 252 },
    { sx: 341, sy: 130, sw: 342, sh: 252 },
    { sx: 683, sy: 130, sw: 314, sh: 252 },
    { sx: 1071, sy: 130, sw: 226, sh: 252 },
  ],
  1: [
    { sx: 184, sy: 1607, sw: 157, sh: 371 },
    { sx: 341, sy: 1606, sw: 342, sh: 372 },
    { sx: 683, sy: 1606, sw: 310, sh: 372 },
    { sx: 1111, sy: 1606, sw: 178, sh: 372 },
  ],
  2: [
    { sx: 341, sy: 1099, sw: 342, sh: 362 },
    { sx: 683, sy: 1099, sw: 294, sh: 362 },
    { sx: 1096, sy: 1099, sw: 185, sh: 362 },
    { sx: 1392, sy: 1099, sw: 315, sh: 362 },
  ],
  3: [
    { sx: 341, sy: 587, sw: 342, sh: 362 },
    { sx: 683, sy: 587, sw: 318, sh: 362 },
    { sx: 1057, sy: 587, sw: 308, sh: 362 },
    { sx: 1365, sy: 587, sw: 342, sh: 362 },
  ],
};

let tilesetImage = null;
let characterSheet = null;

const camera = {
  x: 0,
  y: 0,
  width: canvas ? canvas.width : 800,
  height: canvas ? canvas.height : 800,
};

function getInitialPlayerPosition() {
  const spawn = level && level.spawns && level.spawns.find((entry) => entry.name === 'PlayerSpawn');

  if (spawn) {
    return {
      x: Math.floor((spawn.x - mapOffsetX) / SOURCE_TILE_SIZE),
      y: Math.floor((spawn.y - mapOffsetY) / SOURCE_TILE_SIZE),
    };
  }

  return { x: 1, y: 1 };
}

const initialPlayerPosition = getInitialPlayerPosition();

const player = {
  x: initialPlayerPosition.x,
  y: initialPlayerPosition.y,
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    image.src = src;
  });
}

function gidToLocalTileId(gid) {
  if (!gid) {
    return -1;
  }

  return gid - tilesetFirstGid;
}

function preloadAssets(onComplete) {
  if (!level) {
    console.error('Missing window.TILED_LEVEL. Run: npm run build:map');
    onComplete();
    return;
  }

  let loadedCount = 0;
  const totalAssets = 2;

  function checkComplete() {
    loadedCount += 1;

    if (loadedCount === totalAssets) {
      assetsReady = true;
      onComplete();
    }
  }

  loadImage(TILESET_PATH)
    .then((image) => {
      tilesetImage = image;
    })
    .catch(() => {
      console.error(`Failed to load asset: ${TILESET_PATH}`);
    })
    .finally(checkComplete);

  loadImage(CHARACTER_SHEET_PATH)
    .then((sheet) => {
      characterSheet = sheet;
    })
    .catch(() => {
      console.error(`Failed to load asset: ${CHARACTER_SHEET_PATH}`);
      return loadImage(CHARACTER_FALLBACK_PATH)
        .then((image) => {
          characterSheet = image;
        })
        .catch(() => {
          console.error(`Failed to load asset: ${CHARACTER_FALLBACK_PATH}`);
        });
    })
    .finally(checkComplete);
}

function updateCamera() {
  const playerCenterX = player.x * tileSize + tileSize / 2;
  const playerCenterY = player.y * tileSize + tileSize / 2;

  camera.width = canvas.width;
  camera.height = canvas.height;
  camera.x = playerCenterX - camera.width / 2;
  camera.y = playerCenterY - camera.height / 2;

  const maxCameraX = Math.max(0, worldWidth - camera.width);
  const maxCameraY = Math.max(0, worldHeight - camera.height);

  camera.x = Math.max(0, Math.min(camera.x, maxCameraX));
  camera.y = Math.max(0, Math.min(camera.y, maxCameraY));
}

function drawPlayer() {
  const drawWidth = entityFootprintWidth * displayScale;
  const drawHeight = entityVisualHeight * displayScale;
  const drawX = player.x * tileSize + (tileSize - drawWidth) / 2;
  const drawY = player.y * tileSize + tileSize - drawHeight;

  if (!characterSheet) {
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(
      player.x * tileSize,
      player.y * tileSize + tileSize - entityFootprintHeight * displayScale,
      entityFootprintWidth * displayScale,
      entityFootprintHeight * displayScale
    );
    return;
  }

  const frames = SPRITE_FRAMES[player.direction];
  const rect = frames && frames[player.currentFrame];

  if (!rect) {
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
    return;
  }

  ctx.drawImage(
    characterSheet,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}

function drawMapFallback(message) {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '18px Segoe UI, sans-serif';
  ctx.fillText(message || 'Loading map...', 24, 40);
}

function drawTileMap() {
  if (!tilesetImage) {
    ctx.fillStyle = '#4a6741';
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    return;
  }

  for (let row = 0; row < mapRows; row += 1) {
    for (let col = 0; col < mapCols; col += 1) {
      const gid = map[row][col];
      const localTileId = gidToLocalTileId(gid);

      if (localTileId < 0) {
        continue;
      }

      const sx = (localTileId % tilesetColumns) * SOURCE_TILE_SIZE;
      const sy = Math.floor(localTileId / tilesetColumns) * SOURCE_TILE_SIZE;
      const destX = col * tileSize;
      const destY = row * tileSize;

      ctx.drawImage(
        tilesetImage,
        sx,
        sy,
        SOURCE_TILE_SIZE,
        SOURCE_TILE_SIZE,
        destX,
        destY,
        tileSize,
        tileSize
      );
    }
  }
}

function draw() {
  if (!ctx) {
    return;
  }

  if (!level) {
    drawMapFallback('Map data missing. Run: npm run build:map');
    return;
  }

  if (!assetsReady) {
    drawMapFallback('Loading map assets...');
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.imageSmoothingEnabled = false;
  drawTileMap();
  drawPlayer();
  ctx.restore();
}

function isOnMapScreen() {
  return document.getElementById('map-screen').style.display !== 'none'
    && document.getElementById('battle-screen').style.display === 'none';
}

function updatePauseMenuStats() {
  if (!pauseNameEl || !pauseJobEl || !pauseHpEl || !pauseSpeedEl) {
    return;
  }

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
  if (pauseMenu) {
    pauseMenu.style.display = 'block';
  }
}

function closePauseMenu() {
  isPaused = false;
  if (pauseMenu) {
    pauseMenu.style.display = 'none';
  }
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
  if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) {
    return false;
  }

  const gid = map[y][x];
  const localTileId = gidToLocalTileId(gid);

  if (localTileId < 0) {
    return false;
  }

  if (collisionTileIds.has(localTileId)) {
    return false;
  }

  return true;
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
  closePauseMenu();
  document.getElementById('map-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  startBattle();
}

function tryRandomEncounter() {
  if (isPaused) {
    return;
  }

  if (!GameState.canTriggerEncounters()) {
    return;
  }

  const gid = map[player.y][player.x];
  const localTileId = gidToLocalTileId(gid);

  if (damageTileIds.has(localTileId)) {
    triggerEncounter();
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
  closePauseMenu();
  draw();
};

function initPauseMenu() {
  if (switchKnightBtn) {
    switchKnightBtn.addEventListener('click', () => {
      switchJob('job_knight');
    });
  }

  if (switchBlackMageBtn) {
    switchBlackMageBtn.addEventListener('click', () => {
      switchJob('job_black_mage');
    });
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', () => {
      closePauseMenu();
    });
  }
}

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

function initGame() {
  if (!canvas || !ctx) {
    document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
    return;
  }

  initPauseMenu();
  drawMapFallback('Loading map assets...');
  preloadAssets(draw);
}

initGame();
