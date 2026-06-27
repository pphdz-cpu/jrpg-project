const GOBLIN_MAX_HP = 50;
const GOBLIN_SPEED = 30;
const MAGIC_COST = 5;
const PARTY_IDS = ['char_001', 'char_002'];

const enemyHpEl = document.getElementById('enemyHp');
const enemyAtbEl = document.getElementById('enemyAtb');
const attackBtn = document.getElementById('attackBtn');
const magicBtn = document.getElementById('magicBtn');
const battleMessageEl = document.getElementById('battleMessage');
const mapScreen = document.getElementById('map-screen');
const battleScreen = document.getElementById('battle-screen');

const partyUi = [
  {
    id: 'char_001',
    rowEl: document.getElementById('party-bartz'),
    nameEl: document.getElementById('bartzName'),
    hpEl: document.getElementById('bartzHp'),
    mpEl: document.getElementById('bartzMp'),
    atbEl: document.getElementById('bartzAtb'),
  },
  {
    id: 'char_002',
    rowEl: document.getElementById('party-lenna'),
    nameEl: document.getElementById('lennaName'),
    hpEl: document.getElementById('lennaHp'),
    mpEl: document.getElementById('lennaMp'),
    atbEl: document.getElementById('lennaAtb'),
  },
];

let party = [];
let goblin = null;
let activePartyIndex = null;
let atbInterval = null;
let battleActive = false;
let messageTimeout = null;

function showBattleMessage(text) {
  if (!battleMessageEl) {
    return;
  }

  battleMessageEl.textContent = text;

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  messageTimeout = setTimeout(() => {
    if (battleMessageEl.textContent === text) {
      battleMessageEl.textContent = '';
    }
  }, 2000);
}

function setCommandsEnabled(enabled) {
  attackBtn.disabled = !enabled;
  magicBtn.disabled = !enabled;
}

function updateDisplay() {
  party.forEach((member, index) => {
    const ui = partyUi[index];
    ui.nameEl.textContent = member.name;
    ui.hpEl.textContent = `${member.hp}/${member.maxHp}`;
    ui.mpEl.textContent = `${member.mp}/${member.maxMp}`;
    ui.atbEl.value = member.atb;

    ui.rowEl.classList.toggle('active', index === activePartyIndex);
    ui.rowEl.classList.toggle('dead', member.hp <= 0);
  });

  enemyHpEl.textContent = goblin.hp;
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

function getLivingPartyIndices() {
  return party
    .map((member, index) => (member.hp > 0 ? index : -1))
    .filter((index) => index >= 0);
}

function isPartyDefeated() {
  return getLivingPartyIndices().length === 0;
}

function returnToMap() {
  battleActive = false;
  activePartyIndex = null;
  pauseAtbLoop();
  setCommandsEnabled(false);
  showBattleMessage('');

  goblin.hp = GOBLIN_MAX_HP;

  battleScreen.style.display = 'none';
  mapScreen.style.display = 'block';

  if (typeof window.onBattleVictory === 'function') {
    window.onBattleVictory();
  }
}

function checkWinLoss() {
  if (isPartyDefeated()) {
    battleActive = false;
    activePartyIndex = null;
    pauseAtbLoop();
    setCommandsEnabled(false);
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

function getReadyPartyIndex() {
  return party.findIndex((member) => member.hp > 0 && member.atb >= 100);
}

function beginPlayerTurn(partyIndex) {
  activePartyIndex = partyIndex;
  pauseAtbLoop();
  setCommandsEnabled(true);
  updateDisplay();
}

function finishPlayerTurn() {
  if (activePartyIndex === null) {
    return;
  }

  party[activePartyIndex].atb = 0;
  activePartyIndex = null;
  setCommandsEnabled(false);
  updateDisplay();

  if (checkWinLoss()) {
    return;
  }

  resumeAtbLoop();
}

function performEnemyTurn() {
  const livingIndices = getLivingPartyIndices();
  if (livingIndices.length === 0) {
    checkWinLoss();
    return;
  }

  const targetIndex = livingIndices[Math.floor(Math.random() * livingIndices.length)];
  party[targetIndex].hp = Math.max(0, party[targetIndex].hp - 10);
  goblin.atb = 0;
  updateDisplay();

  if (checkWinLoss()) {
    return;
  }

  resumeAtbLoop();
}

function atbTick() {
  if (!battleActive || activePartyIndex !== null) {
    return;
  }

  party.forEach((member) => {
    if (member.hp > 0) {
      member.atb = Math.min(100, member.atb + member.speed / 10);
    }
  });

  goblin.atb = Math.min(100, goblin.atb + goblin.speed / 10);
  updateDisplay();

  const readyPartyIndex = getReadyPartyIndex();
  if (readyPartyIndex >= 0) {
    beginPlayerTurn(readyPartyIndex);
    return;
  }

  if (goblin.atb >= 100) {
    pauseAtbLoop();
    setCommandsEnabled(false);

    setTimeout(() => {
      if (!battleActive || activePartyIndex !== null) {
        return;
      }

      performEnemyTurn();
    }, 1000);
  }
}

function createCombatant(characterId) {
  const character = characters[characterId];
  const stats = calculateStats(characterId);

  if (!character || !stats) {
    return null;
  }

  return {
    id: characterId,
    name: character.name,
    jobId: character.current_job,
    maxHp: stats.hp,
    hp: stats.hp,
    maxMp: stats.mp,
    mp: stats.mp,
    speed: stats.speed,
    atb: 0,
  };
}

function startBattle() {
  party = PARTY_IDS
    .map((characterId) => createCombatant(characterId))
    .filter((member) => member !== null);

  if (party.length === 0) {
    console.error('Failed to create battle party.');
    return;
  }

  goblin = {
    name: 'Goblin',
    maxHp: GOBLIN_MAX_HP,
    hp: GOBLIN_MAX_HP,
    speed: GOBLIN_SPEED,
    atb: 0,
  };

  battleActive = true;
  activePartyIndex = null;
  setCommandsEnabled(false);
  showBattleMessage('');
  updateDisplay();
  resumeAtbLoop();
}

function getActiveMember() {
  if (activePartyIndex === null) {
    return null;
  }

  return party[activePartyIndex];
}

function castMagic() {
  const member = getActiveMember();

  if (!member || member.atb < 100) {
    return;
  }

  if (member.mp < MAGIC_COST) {
    showBattleMessage('Not enough MP');
    return;
  }

  member.mp -= MAGIC_COST;

  if (member.jobId === 'job_black_mage') {
    goblin.hp = Math.max(0, goblin.hp - 25);
    showBattleMessage(`${member.name} casts Fire!`);
  } else if (member.jobId === 'job_white_mage') {
    party.forEach((ally) => {
      if (ally.hp > 0) {
        ally.hp = Math.min(ally.maxHp, ally.hp + 20);
      }
    });
    showBattleMessage(`${member.name} casts Cure!`);
  } else {
    member.mp += MAGIC_COST;
    showBattleMessage('No spell available for this job!');
    updateDisplay();
    return;
  }

  finishPlayerTurn();
}

attackBtn.addEventListener('click', () => {
  const member = getActiveMember();

  if (!member || member.atb < 100) {
    return;
  }

  goblin.hp = Math.max(0, goblin.hp - 15);
  showBattleMessage(`${member.name} attacks!`);
  finishPlayerTurn();
});

magicBtn.addEventListener('click', () => {
  castMagic();
});
