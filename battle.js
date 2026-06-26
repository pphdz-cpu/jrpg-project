const GOBLIN_MAX_HP = 50;
const GOBLIN_SPEED = 30;
const CHARACTER_ID = 'char_001';

const playerNameEl = document.getElementById('playerName');
const playerHpEl = document.getElementById('playerHp');
const enemyHpEl = document.getElementById('enemyHp');
const playerAtbEl = document.getElementById('playerAtb');
const enemyAtbEl = document.getElementById('enemyAtb');
const attackBtn = document.getElementById('attackBtn');
const mapScreen = document.getElementById('map-screen');
const battleScreen = document.getElementById('battle-screen');

let combatPlayer = null;
let goblin = null;
let atbInterval = null;
let battleActive = false;

function updateDisplay() {
  playerHpEl.textContent = combatPlayer.hp;
  enemyHpEl.textContent = goblin.hp;
  playerAtbEl.value = combatPlayer.atb;
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

function returnToMap() {
  battleActive = false;
  pauseAtbLoop();
  attackBtn.disabled = true;

  goblin.hp = GOBLIN_MAX_HP;

  battleScreen.style.display = 'none';
  mapScreen.style.display = 'block';

  if (typeof window.onBattleVictory === 'function') {
    window.onBattleVictory();
  }
}

function checkWinLoss() {
  if (combatPlayer.hp <= 0) {
    battleActive = false;
    pauseAtbLoop();
    attackBtn.disabled = true;
    alert('Game Over');
    return true;
  }

  if (goblin.hp <= 0) {
    alert('Victory!');
    returnToMap();
    return true;
  }

  return false;
}

function atbTick() {
  if (!battleActive) {
    return;
  }

  combatPlayer.atb = Math.min(100, combatPlayer.atb + combatPlayer.speed / 10);
  goblin.atb = Math.min(100, goblin.atb + goblin.speed / 10);

  updateDisplay();

  if (combatPlayer.atb >= 100) {
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

      combatPlayer.hp = Math.max(0, combatPlayer.hp - 10);
      goblin.atb = 0;
      updateDisplay();

      if (checkWinLoss()) {
        return;
      }

      resumeAtbLoop();
    }, 1000);
  }
}

function startBattle() {
  const character = characters[CHARACTER_ID];
  const stats = calculateStats(CHARACTER_ID);

  if (!stats) {
    console.error('Failed to calculate stats for battle.');
    return;
  }

  combatPlayer = {
    name: character.name,
    maxHp: stats.hp,
    hp: stats.hp,
    speed: stats.speed,
    atb: 0,
  };

  goblin = {
    name: 'Goblin',
    maxHp: GOBLIN_MAX_HP,
    hp: GOBLIN_MAX_HP,
    speed: GOBLIN_SPEED,
    atb: 0,
  };

  battleActive = true;
  attackBtn.disabled = true;

  playerNameEl.textContent = combatPlayer.name;
  updateDisplay();
  resumeAtbLoop();
}

attackBtn.addEventListener('click', () => {
  if (!battleActive || combatPlayer.atb < 100) {
    return;
  }

  goblin.hp = Math.max(0, goblin.hp - 15);
  combatPlayer.atb = 0;
  attackBtn.disabled = true;
  updateDisplay();

  if (checkWinLoss()) {
    return;
  }

  resumeAtbLoop();
});
