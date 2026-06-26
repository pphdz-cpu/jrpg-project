const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const MAP_SIZE = 10;
const ENCOUNTER_CHANCE = 0.15;

const map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const player = {
  x: 1,
  y: 1,
};

let movementEnabled = true;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const tile = map[row][col];
      ctx.fillStyle = tile === 0 ? '#4caf50' : '#888888';
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.fillStyle = '#2196f3';
  ctx.fillRect(
    player.x * TILE_SIZE,
    player.y * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE
  );
}

function isWalkable(x, y) {
  return map[y][x] === 0;
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
    draw();
    tryRandomEncounter();
  }
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
      return;
  }

  event.preventDefault();
});

if (!canvas || !ctx) {
  document.body.innerHTML = '<p style="color:#fff;padding:2rem;">Error: game canvas not found. Make sure index.html and all .js files are in the same folder.</p>';
} else {
  draw();
}
