const player = {
  name: 'Player',
  hp: 100,
  speed: 50,
  atb: 0,
};

const goblin = {
  name: 'Goblin',
  hp: 50,
  speed: 30,
  atb: 0,
};

const playerHpEl = document.getElementById('playerHp');
const enemyHpEl = document.getElementById('enemyHp');
const playerAtbEl = document.getElementById('playerAtb');
const enemyAtbEl = document.getElementById('enemyAtb');
const attackBtn = document.getElementById('attackBtn');

let atbInterval = null;
let battleActive = true;

function updateDisplay() {
  playerHpEl.textContent = player.hp;
  enemyHpEl.textContent = goblin.hp;
  playerAtbEl.value = player.atb;
  enemyAtbEl.value = goblin.atb;
}

function pauseAtbLoop() {
  if (atbInterval) {
    clearInterval(atbInterval);
    atbInterval = null;
  }
}

function resumeAtbLoop() {
  if (!battleActive || atbInterval) {
    return;
  }

  atbInterval = setInterval(atbTick, 100);
}

function checkWinLoss() {
  if (player.hp <= 0) {
    battleActive = false;
    pauseAtbLoop();
    attackBtn.disabled = true;
    alert('Game Over');
    return true;
  }

  if (goblin.hp <= 0) {
    battleActive = false;
    pauseAtbLoop();
    attackBtn.disabled = true;
    alert('Victory!');
    return true;
  }

  return false;
}

function atbTick() {
  if (!battleActive) {
    return;
  }

  player.atb = Math.min(100, player.atb + player.speed / 10);
  goblin.atb = Math.min(100, goblin.atb + goblin.speed / 10);

  updateDisplay();

  if (player.atb >= 100) {
    pauseAtbLoop();
    attackBtn.disabled = false;
  }

  if (goblin.atb >= 100) {
    pauseAtbLoop();
    attackBtn.disabled = true;

    setTimeout(() => {
      if (!battleActive) {
        return;
      }

      player.hp = Math.max(0, player.hp - 10);
      goblin.atb = 0;
      updateDisplay();

      if (checkWinLoss()) {
        return;
      }

      resumeAtbLoop();
    }, 1000);
  }
}

attackBtn.addEventListener('click', () => {
  if (!battleActive || player.atb < 100) {
    return;
  }

  goblin.hp = Math.max(0, goblin.hp - 15);
  player.atb = 0;
  attackBtn.disabled = true;
  updateDisplay();

  if (checkWinLoss()) {
    return;
  }

  resumeAtbLoop();
});

updateDisplay();
resumeAtbLoop();
