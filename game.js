const canvas = document.getElementById('gameCanvas');
const ctx = canvas && canvas.getContext('2d');

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

const MAP_SIZE = 10;
const TILE_SIZE = canvas ? canvas.width / MAP_SIZE : 80;
const ENCOUNTER_CHANCE = 0.15;
const WALK_FRAMES = 4;

const TERRAIN_ASSETS = {
  grass: 'assets/grass.png',
  forest: 'assets/forest.png',
  path: 'assets/path.png',
  town: 'assets/town.png',
};

const CHARACTER_SHEET_PATH = 'assets/character_sheet.png';
const CHARACTER_FALLBACK_PATH = 'assets/character.png';

// Precomputed crop rectangles from character_sheet.png (6 cols x 4 rows)
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    image.src = src;
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
    loadImage(TERRAIN_ASSETS[key])
      .then((image) => {
        cacheImage(key, image);
      })
      .catch(() => {
        console.error(`Failed to load asset: ${TERRAIN_ASSETS[key]}`);
        cacheFallbackTile(key);
      })
      .finally(checkComplete);
  });

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

function drawPlayer() {
  const drawX = player.x * TILE_SIZE;
  const drawY = player.y * TILE_SIZE;

  ctx.fillStyle = '#1565c0';
  ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);

  if (!characterSheet) {
    return;
  }

  const frames = SPRITE_FRAMES[player.direction];
  const rect = frames && frames[player.currentFrame];

  if (!rect) {
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

  const colors = {
    0: '#4caf50',
    1: '#2e5a2e',
    2: '#c4a35a',
    3: '#8b6914',
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      ctx.fillStyle = colors[map[row][col]];
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.fillStyle = '#1565c0';
  ctx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const tile = map[row][col];
      const tileKey = TILE_TO_ASSET[tile];
      const tileCanvas = cachedTiles[tileKey];

      if (tileCanvas) {
        ctx.drawImage(
          tileCanvas,
          col * TILE_SIZE,
          row * TILE_SIZE
        );
      }
    }
  }

  drawPlayer();
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
