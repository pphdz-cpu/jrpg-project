const canvas = document.getElementById('gameCanvas');
const ctx = canvas && canvas.getContext('2d');

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

const ENCOUNTER_CHANCE = 0.15;
const TRANSITION_FADE_MS = 500;
const MOVE_STEP_MS = 180;

const baseLevel = window.TILED_LEVEL;
const SOURCE_TILE_SIZE = baseLevel ? baseLevel.tileWidth : 16;
const tileSize = baseLevel ? baseLevel.displayTileSize : 32;
const tilesetColumns = baseLevel ? baseLevel.tilesetColumns : 1;
const tilesetFirstGid = baseLevel ? baseLevel.firstGid : 1;
const TILESET_PATH = baseLevel ? baseLevel.tileset : 'assets/map-tileset.png';
const entityFootprintWidth = baseLevel && baseLevel.entityWidth ? baseLevel.entityWidth : SOURCE_TILE_SIZE;
const entityFootprintHeight = baseLevel && baseLevel.entityHeight ? baseLevel.entityHeight : SOURCE_TILE_SIZE;
const entityVisualHeight = baseLevel && baseLevel.entityVisualHeight
  ? baseLevel.entityVisualHeight
  : SOURCE_TILE_SIZE * 2;
const CANOPY_SOURCE_ROWS = 10;

let currentMapKey = 'city';
let level = null;
let map = [];
let mapRows = 0;
let mapCols = 0;
let worldWidth = 0;
let worldHeight = 0;
let blockedCells = null;
let overheadCells = null;
let collisionTileIds = new Set();
let damageTileIds = new Set();
let mapOffsetX = 0;
let mapOffsetY = 0;

let tilesetImage = null;
let tilesetLoadError = null;
let screenFadeAlpha = 0;
let isTransitioning = false;

const camera = {
  x: 0,
  y: 0,
  width: canvas ? canvas.width : 800,
  height: canvas ? canvas.height : 800,
};

function applyWorldMap(mapKey) {
  const entry = worldMaps[mapKey];
  if (!entry || !entry.level) {
    console.error(`Unknown map key "${mapKey}"`);
    return false;
  }

  currentMapKey = mapKey;
  level = entry.level;
  map = level.layer;
  mapRows = entry.rows;
  mapCols = entry.cols;
  blockedCells = level.blocked || null;
  overheadCells = level.overhead || null;
  collisionTileIds = new Set(level.collisionTileIds || []);
  damageTileIds = new Set(level.damageTileIds || []);
  mapOffsetX = level.offsetX || 0;
  mapOffsetY = level.offsetY || 0;
  worldWidth = mapCols * tileSize;
  worldHeight = mapRows * tileSize;

  if (window.GameState) {
    GameState.applyMap(level);
  }

  return true;
}

function getInitialPlayerPosition() {
  const spawns = level && level.spawns
    ? level.spawns.filter((entry) => entry.name === 'PlayerSpawn')
    : [];

  if (spawns.length === 0) {
    return { x: 1, y: 1 };
  }

  if (mapCols === 0 || mapRows === 0) {
    return { x: 1, y: 1 };
  }

  const candidates = spawns.map((spawn) => ({
    x: Math.floor((spawn.x - mapOffsetX) / SOURCE_TILE_SIZE),
    y: Math.floor((spawn.y - mapOffsetY) / SOURCE_TILE_SIZE),
  }));

  const walkableCandidates = candidates.filter((candidate) => {
    if (candidate.x < 0 || candidate.y < 0 || candidate.x >= mapCols || candidate.y >= mapRows) {
      return false;
    }

    if (blockedCells && blockedCells[candidate.y] && blockedCells[candidate.y][candidate.x]) {
      return false;
    }

    return true;
  });

  const preferred = walkableCandidates.find((candidate) => (
    !overheadCells
    || !overheadCells[candidate.y]
    || !overheadCells[candidate.y][candidate.x]
  ));

  if (preferred) {
    return preferred;
  }

  if (walkableCandidates.length > 0) {
    return walkableCandidates[walkableCandidates.length - 1];
  }

  return candidates[0];
}

applyWorldMap('city');

const initialPlayerPosition = getInitialPlayerPosition();

const player = {
  x: initialPlayerPosition.x,
  y: initialPlayerPosition.y,
  direction: DIRECTION.DOWN,
  isMoving: false,
  walkStartedAt: 0,
};

window.player = player;
window.currentMapKey = currentMapKey;

const CHARACTER_ID = 'char_001';

const keysHeld = new Set();
let lastHeldKey = null;
let lastMoveStepAt = 0;

let movementEnabled = true;
let assetsReady = false;
let isPaused = false;
let animationFrameId = null;

window.canOpenPauseMenu = function canOpenPauseMenu() {
  return isOnMapScreen() && movementEnabled && !isTransitioning;
};

window.setGamePaused = function setGamePaused(value) {
  isPaused = Boolean(value);
};

window.redrawGame = function redrawGame() {
  draw();
};

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
    console.error('Missing world map data. Run: npm run build:map');
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

  function tick(now) {
    const frameTime = now || performance.now();
    const moved = processHeldMovement(frameTime);

    if (assetsReady && isOnMapScreen() && (player.isMoving || moved)) {
      draw();
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
}

function getPrimaryHeldKey() {
  if (lastHeldKey && keysHeld.has(lastHeldKey)) {
    return lastHeldKey;
  }

  const [nextKey] = keysHeld;
  return nextKey || null;
}

function getMovementDelta(key) {
  switch (key) {
    case 'ArrowUp':
      return { dx: 0, dy: -1 };
    case 'ArrowDown':
      return { dx: 0, dy: 1 };
    case 'ArrowLeft':
      return { dx: -1, dy: 0 };
    case 'ArrowRight':
      return { dx: 1, dy: 0 };
    default:
      return null;
  }
}

function processHeldMovement(now) {
  if (!movementEnabled || isPaused || isTransitioning || keysHeld.size === 0) {
    return false;
  }

  const key = getPrimaryHeldKey();
  if (!key) {
    return false;
  }

  if (now - lastMoveStepAt < MOVE_STEP_MS) {
    player.isMoving = true;
    return false;
  }

  const delta = getMovementDelta(key);
  if (!delta) {
    return false;
  }

  setPlayerDirection(key);
  player.isMoving = true;

  const moved = movePlayer(delta.dx, delta.dy);
  lastMoveStepAt = now;

  if (!moved) {
    player.isMoving = keysHeld.size > 0;
  }

  return moved;
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
      const isSplitCanopy = shouldSplitCanopyTile(col, row);

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

  return colDistance <= 1 && rowDistance >= 1 && rowDistance <= 3;
}

function shouldSplitCanopyTile(col, row) {
  if (!overheadCells || !overheadCells[row] || !overheadCells[row][col]) {
    return false;
  }

  return shouldDrawCanopyOverPlayer(col, row);
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

function drawMapLabel() {
  if (!ctx || !level || isTransitioning) {
    return;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(45, 42, 68, 0.72)';
  ctx.fillRect(12, 12, 220, 34);
  ctx.fillStyle = '#fff9c4';
  ctx.font = '600 16px Fredoka, Segoe UI, sans-serif';
  ctx.fillText(level.mapName || currentMapKey, 22, 34);
  ctx.restore();
}

function drawScreenFade() {
  if (!ctx || screenFadeAlpha <= 0) {
    return;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(0, 0, 0, ${screenFadeAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
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

  drawMapLabel();
  drawScreenFade();
}

function isOnMapScreen() {
  return document.getElementById('map-screen').style.display !== 'none'
    && document.getElementById('battle-screen').style.display === 'none';
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

function fadeScreenTo(targetAlpha, durationMs) {
  return new Promise((resolve) => {
    const startAlpha = screenFadeAlpha;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      screenFadeAlpha = startAlpha + ((targetAlpha - startAlpha) * progress);
      draw();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        screenFadeAlpha = targetAlpha;
        draw();
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

async function executeMapTransition(warp) {
  if (isTransitioning) {
    return;
  }

  isTransitioning = true;
  movementEnabled = false;
  keysHeld.clear();
  lastHeldKey = null;
  lastMoveStepAt = 0;
  player.isMoving = false;
  player.walkStartedAt = 0;

  if (typeof closePauseMenu === 'function') {
    closePauseMenu();
  }

  await fadeScreenTo(1, TRANSITION_FADE_MS);

  applyWorldMap(warp.toMap);
  window.currentMapKey = currentMapKey;
  player.x = warp.toX;
  player.y = warp.toY;
  player.direction = DIRECTION.DOWN;
  player.isMoving = false;
  player.walkStartedAt = 0;

  await fadeScreenTo(0, TRANSITION_FADE_MS);

  isTransitioning = false;
  movementEnabled = true;
  draw();
}

function checkWarpZones() {
  const warp = findWarpZone(currentMapKey, player.x, player.y);
  if (warp) {
    executeMapTransition(warp);
  }
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
  if (typeof closePauseMenu === 'function') {
    closePauseMenu();
  }
  document.getElementById('map-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  startBattle();
}

function tryRandomEncounter() {
  if (isPaused || isTransitioning) {
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
    checkWarpZones();
    return true;
  }

  return false;
}

window.onBattleVictory = function () {
  movementEnabled = true;
  if (typeof closePauseMenu === 'function') {
    closePauseMenu();
  }
  draw();
};

document.addEventListener('keydown', (event) => {
  if (!movementEnabled || isPaused || isTransitioning || !isArrowKey(event.key) || keysHeld.has(event.key)) {
    return;
  }

  const now = performance.now();
  keysHeld.add(event.key);
  lastHeldKey = event.key;

  if (keysHeld.size === 1) {
    player.walkStartedAt = now;
    lastMoveStepAt = 0;
  }

  player.isMoving = true;
  setPlayerDirection(event.key);

  const delta = getMovementDelta(event.key);
  if (delta) {
    movePlayer(delta.dx, delta.dy);
    lastMoveStepAt = now;
  }

  draw();
  event.preventDefault();
});

document.addEventListener('keyup', (event) => {
  if (!isArrowKey(event.key)) {
    return;
  }

  keysHeld.delete(event.key);

  if (event.key === lastHeldKey) {
    lastHeldKey = getPrimaryHeldKey();
  }

  if (keysHeld.size === 0) {
    player.isMoving = false;
    player.walkStartedAt = 0;
    lastMoveStepAt = 0;
    if (!isPaused && !isTransitioning) {
      draw();
    }
    return;
  }

  player.isMoving = true;
  player.walkStartedAt = performance.now();
  lastMoveStepAt = 0;
});

window.addEventListener('blur', () => {
  keysHeld.clear();
  lastHeldKey = null;
  lastMoveStepAt = 0;
  player.isMoving = false;
  player.walkStartedAt = 0;
});

function initGame() {
  if (!canvas || !ctx) {
    document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
    return;
  }

  drawMapFallback('Loading map assets...');
  preloadAssets(() => {
    draw();
    startAnimationLoop();
  });
}

window.initGame = initGame;
window.applyWorldMap = applyWorldMap;
window.executeMapTransition = executeMapTransition;
