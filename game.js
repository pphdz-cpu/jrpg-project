const canvas = document.getElementById('gameCanvas');
const ctx = canvas && canvas.getContext('2d');

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

const TILE_SIZE = 40;
const MAP_SCALE = 3;
const ENCOUNTER_CHANCE = 0.15;
const WALK_FRAMES = 4;

let worldWidth = 0;
let worldHeight = 0;
let mapCols = 0;
let mapRows = 0;
let map = [];

const CITY_MAP_PATH = 'assets/city_map.png';
const CHARACTER_SHEET_PATH = 'assets/character_sheet.png';
const CHARACTER_FALLBACK_PATH = 'assets/character.png';

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

function createWalkableMap(cols, rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function initializeWorldFromMap(sourceImage) {
  worldWidth = sourceImage.naturalWidth * MAP_SCALE;
  worldHeight = sourceImage.naturalHeight * MAP_SCALE;
  mapCols = Math.floor(worldWidth / TILE_SIZE);
  mapRows = Math.floor(worldHeight / TILE_SIZE);
  map = createWalkableMap(mapCols, mapRows);
}

function buildScaledWorldMap(sourceImage) {
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = sourceImage.naturalWidth * MAP_SCALE;
  scaledCanvas.height = sourceImage.naturalHeight * MAP_SCALE;

  const scaledCtx = scaledCanvas.getContext('2d');
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(
    sourceImage,
    0,
    0,
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    0,
    0,
    scaledCanvas.width,
    scaledCanvas.height
  );

  return scaledCanvas;
}

const camera = {
  x: 0,
  y: 0,
  width: canvas ? canvas.width : 800,
  height: canvas ? canvas.height : 800,
};

let cityMap = null;
let scaledWorldMap = null;
let characterSheet = null;

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    image.src = src;
  });
}

function preloadAssets(onComplete) {
  let loadedCount = 0;
  const totalAssets = 2;

  function checkComplete() {
    loadedCount += 1;

    if (loadedCount === totalAssets) {
      assetsReady = true;
      onComplete();
    }
  }

  loadImage(CITY_MAP_PATH)
    .then((image) => {
      cityMap = image;
      initializeWorldFromMap(image);
      scaledWorldMap = buildScaledWorldMap(image);
    })
    .catch(() => {
      console.error(`Failed to load asset: ${CITY_MAP_PATH}`);
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
  const playerCenterX = player.x * TILE_SIZE + TILE_SIZE / 2;
  const playerCenterY = player.y * TILE_SIZE + TILE_SIZE / 2;

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
  const drawX = player.x * TILE_SIZE;
  const drawY = player.y * TILE_SIZE;

  if (!characterSheet) {
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
    return;
  }

  const frames = SPRITE_FRAMES[player.direction];
  const rect = frames && frames[player.currentFrame];

  if (!rect) {
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
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
    TILE_SIZE,
    TILE_SIZE
  );
}

function drawMapFallback() {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  const fallbackWidth = worldWidth || canvas.width;
  const fallbackHeight = worldHeight || canvas.height;
  ctx.fillStyle = '#4a6741';
  ctx.fillRect(0, 0, fallbackWidth, fallbackHeight);
  drawPlayer();
  ctx.restore();
}

function drawWorldMap() {
  if (scaledWorldMap) {
    ctx.drawImage(scaledWorldMap, 0, 0);
    return;
  }

  if (cityMap) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      cityMap,
      0,
      0,
      cityMap.naturalWidth,
      cityMap.naturalHeight,
      0,
      0,
      worldWidth,
      worldHeight
    );
    return;
  }

  ctx.fillStyle = '#4a6741';
  ctx.fillRect(0, 0, worldWidth, worldHeight);
}

function draw() {
  if (!ctx) {
    return;
  }

  if (!assetsReady) {
    drawMapFallback();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.imageSmoothingEnabled = false;
  drawWorldMap();
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

  return map[y][x] === 0;
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
  drawMapFallback();
  preloadAssets(draw);
}

initGame();
