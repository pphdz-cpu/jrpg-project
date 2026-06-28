const canvas = document.getElementById('gameCanvas');
const ctx = canvas && canvas.getContext('2d');

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

const ENCOUNTER_CHANCE = 0.15;

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
const blockedCells = level ? level.blocked : null;
const overheadCells = level ? level.overhead : null;
const CANOPY_SOURCE_ROWS = 10;
const tilesetColumns = level ? level.tilesetColumns : 1;
const tilesetFirstGid = level ? level.firstGid : 1;
const TILESET_PATH = level ? level.tileset : 'assets/map-tileset.png';
const entityFootprintWidth = level && level.entityWidth ? level.entityWidth : SOURCE_TILE_SIZE;
const entityFootprintHeight = level && level.entityHeight ? level.entityHeight : SOURCE_TILE_SIZE;
const entityVisualHeight = level && level.entityVisualHeight ? level.entityVisualHeight : SOURCE_TILE_SIZE * 2;
const mapOffsetX = level && level.offsetX ? level.offsetX : 0;
const mapOffsetY = level && level.offsetY ? level.offsetY : 0;
const mapNpcs = (level && level.npcs) || [];

let tilesetImage = null;
let tilesetLoadError = null;

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
  direction: DIRECTION.DOWN,
  isMoving: false,
  walkStartedAt: 0,
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
let animationFrameId = null;

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
    assetsReady = true;
    onComplete();
    return;
  }

  loadImage(TILESET_PATH)
    .then((image) => {
      tilesetImage = image;
    })
    .catch((error) => {
      tilesetLoadError = error.message;
      console.error(error.message);
    })
    .finally(() => {
      preloadCharacterAssets(level)
        .catch((error) => {
          console.warn('Character assets failed to load:', error.message);
        })
        .finally(() => {
          assetsReady = true;
          onComplete();
        });
    });
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
  drawPlayerCharacter(ctx, player, tileSize, SOURCE_TILE_SIZE);
}

function startAnimationLoop() {
  if (animationFrameId) {
    return;
  }

  function tick() {
    if (assetsReady && isOnMapScreen() && movementEnabled && !isPaused && player.isMoving) {
      draw();
    }
    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
}

function drawMapFallback(message, detail) {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '18px Segoe UI, sans-serif';
  ctx.fillText(message || 'Loading map...', 24, 40);

  if (detail) {
    ctx.fillStyle = '#ccc';
    ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillText(detail, 24, 68);
  }
}

function drawTileSlice(col, row, sourceY, sourceHeight) {
  const gid = map[row][col];
  const localTileId = gidToLocalTileId(gid);

  if (localTileId < 0) {
    return;
  }

  const sx = (localTileId % tilesetColumns) * SOURCE_TILE_SIZE;
  const sy = Math.floor(localTileId / tilesetColumns) * SOURCE_TILE_SIZE + sourceY;
  const destX = col * tileSize;
  const destY = row * tileSize + Math.round((sourceY / SOURCE_TILE_SIZE) * tileSize);
  const destHeight = Math.round((sourceHeight / SOURCE_TILE_SIZE) * tileSize);

  ctx.drawImage(
    tilesetImage,
    sx,
    sy,
    SOURCE_TILE_SIZE,
    sourceHeight,
    destX,
    destY,
    tileSize,
    destHeight
  );
}

function drawTileMap() {
  if (!tilesetImage) {
    return;
  }

  for (let row = 0; row < mapRows; row += 1) {
    for (let col = 0; col < mapCols; col += 1) {
      const isSplitCanopy = overheadCells
        && overheadCells[row]
        && overheadCells[row][col]
        && shouldDrawCanopyOverPlayer(col, row);

      if (isSplitCanopy) {
        drawTileSlice(col, row, CANOPY_SOURCE_ROWS, SOURCE_TILE_SIZE - CANOPY_SOURCE_ROWS);
        continue;
      }

      drawTileSlice(col, row, 0, SOURCE_TILE_SIZE);
    }
  }
}

function shouldDrawCanopyOverPlayer(col, row) {
  if (!overheadCells || !overheadCells[row] || !overheadCells[row][col]) {
    return false;
  }

  const rowDistance = player.y - row;
  const colDistance = Math.abs(player.x - col);

  return colDistance <= 1 && rowDistance >= -1 && rowDistance <= 2;
}

function drawOverheadCanopies() {
  if (!tilesetImage || !overheadCells) {
    return;
  }

  for (let row = 0; row < mapRows; row += 1) {
    for (let col = 0; col < mapCols; col += 1) {
      if (!shouldDrawCanopyOverPlayer(col, row)) {
        continue;
      }

      drawTileSlice(col, row, 0, CANOPY_SOURCE_ROWS);
    }
  }
}

function draw() {
  if (!ctx) {
    return;
  }

  if (!level) {
    drawMapFallback(
      'Map data missing.',
      'Run npm run build:map and open index.html from the project root.'
    );
    return;
  }

  if (!assetsReady) {
    drawMapFallback('Loading map assets...');
    return;
  }

  if (!tilesetImage) {
    drawMapFallback(
      'Map tileset failed to load.',
      `${TILESET_PATH} — run: npm install && npm run build:map`
    );
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.imageSmoothingEnabled = false;
  drawTileMap();
  drawPlayer();
  drawOverheadCanopies();
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

  if (blockedCells && blockedCells[y] && blockedCells[y][x]) {
    return false;
  }

  const gid = map[y][x];
  const localTileId = gidToLocalTileId(gid);

  if (localTileId < 0) {
    return false;
  }

  if (!blockedCells && collisionTileIds.has(localTileId)) {
    return false;
  }

  return true;
}

function setPlayerDirection(key) {
  switch (key) {
    case 'ArrowDown':
      player.direction = DIRECTION.DOWN;
      break;
    case 'ArrowLeft':
      player.direction = DIRECTION.LEFT;
      break;
    case 'ArrowRight':
      player.direction = DIRECTION.RIGHT;
      break;
    case 'ArrowUp':
      player.direction = DIRECTION.UP;
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

  if (keysHeld.size === 0) {
    player.walkStartedAt = performance.now();
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
    player.walkStartedAt = 0;
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
  preloadAssets(() => {
    draw();
    startAnimationLoop();
  });
}

initGame();
