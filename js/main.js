const PauseMenuUI = {
  isOpen: false,
  elements: {},
};

function getPauseElements() {
  return {
    menu: document.getElementById('pause-menu'),
    pauseBtn: document.getElementById('pause-btn'),
    closeBtn: document.getElementById('close-menu-btn'),
    selector: document.getElementById('character-selector'),
    selectStatus: document.getElementById('character-select-status'),
    nameEl: document.getElementById('pause-name'),
    jobEl: document.getElementById('pause-job'),
    hpEl: document.getElementById('pause-hp'),
    speedEl: document.getElementById('pause-speed'),
    switchKnightBtn: document.getElementById('switch-knight-btn'),
    switchBlackMageBtn: document.getElementById('switch-black-mage-btn'),
  };
}

function updatePauseMenuStats() {
  const { nameEl, jobEl, hpEl, speedEl } = PauseMenuUI.elements;
  if (!nameEl || !jobEl || !hpEl || !speedEl) {
    return;
  }

  const character = characters[CHARACTER_ID];
  const stats = calculateStats(CHARACTER_ID);
  const job = jobs[character.current_job];

  if (!stats || !job) {
    return;
  }

  nameEl.textContent = character.name;
  jobEl.textContent = job.name;
  hpEl.textContent = stats.hp;
  speedEl.textContent = stats.speed;
}

function updateCharacterSelectStatus(message) {
  const { selectStatus } = PauseMenuUI.elements;
  if (selectStatus) {
    selectStatus.textContent = message;
  }
}

function markSelectedCharacter(characterId) {
  const { selector } = PauseMenuUI.elements;
  if (!selector) {
    return;
  }

  selector.querySelectorAll('.character-option').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.characterId === characterId);
  });
}

async function buildCharacterSelector() {
  const { selector } = PauseMenuUI.elements;
  if (!selector) {
    return;
  }

  await loadCharacterRoster();
  selector.innerHTML = '';

  if (!CharacterRoster.characters.length) {
    const empty = document.createElement('p');
    empty.id = 'character-selector-empty';
    empty.textContent = 'No characters found. Run: npm run build:characters';
    selector.appendChild(empty);
    return;
  }

  CharacterRoster.characters.forEach((character) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-option';
    button.dataset.characterId = character.id;
    button.setAttribute('aria-label', `Select ${character.label}`);

    const image = document.createElement('img');
    image.src = character.preview;
    image.alt = character.label;

    const label = document.createElement('span');
    label.textContent = character.label;

    button.appendChild(image);
    button.appendChild(label);

    button.addEventListener('click', () => {
      selectPlayerCharacter(character.id);
    });

    selector.appendChild(button);
  });

  const activeId = GameState.currentPlayerImage || CharacterRoster.getDefaultId();
  markSelectedCharacter(activeId);

  const activeCharacter = CharacterRoster.getById(activeId);
  if (activeCharacter) {
    updateCharacterSelectStatus(`Playing as ${activeCharacter.label}. Click another hero to swap.`);
  }
}

async function selectPlayerCharacter(characterId) {
  if (!characterId) {
    return;
  }

  const selected = CharacterRoster.getById(characterId);
  updateCharacterSelectStatus(`Loading ${selected.label}...`);
  markSelectedCharacter(characterId);

  GameState.setCurrentPlayerImage(characterId);

  const loaded = await setPlayerCharacter(characterId);
  if (!loaded) {
    updateCharacterSelectStatus(`Could not load ${selected.label}. Run: npm run build:characters`);
    return;
  }

  if (window.player) {
    window.player.isMoving = false;
    window.player.walkStartedAt = 0;
  }

  if (typeof window.redrawGame === 'function') {
    window.redrawGame();
  }

  updateCharacterSelectStatus(`Now playing as ${selected.label}. Press Resume to walk around!`);
  markSelectedCharacter(characterId);
}

async function openPauseMenu() {
  if (typeof window.setGamePaused === 'function') {
    window.setGamePaused(true);
  }

  PauseMenuUI.isOpen = true;
  updatePauseMenuStats();
  await buildCharacterSelector();

  const { menu } = PauseMenuUI.elements;
  if (menu) {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
  }
}

function closePauseMenu() {
  if (typeof window.setGamePaused === 'function') {
    window.setGamePaused(false);
  }

  PauseMenuUI.isOpen = false;

  const { menu } = PauseMenuUI.elements;
  if (menu) {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
  }

  if (typeof window.redrawGame === 'function') {
    window.redrawGame();
  }
}

function togglePauseMenu() {
  if (typeof window.canOpenPauseMenu === 'function' && !window.canOpenPauseMenu()) {
    return;
  }

  if (PauseMenuUI.isOpen) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
}

function switchJob(jobId) {
  characters[CHARACTER_ID].current_job = jobId;
  updatePauseMenuStats();
}

function initPauseMenuUI() {
  PauseMenuUI.elements = getPauseElements();
  const {
    pauseBtn,
    closeBtn,
    switchKnightBtn,
    switchBlackMageBtn,
  } = PauseMenuUI.elements;

  if (pauseBtn) {
    pauseBtn.addEventListener('click', togglePauseMenu);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closePauseMenu);
  }

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

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (typeof window.canOpenPauseMenu === 'function' && !window.canOpenPauseMenu()) {
      return;
    }

    togglePauseMenu();
    event.preventDefault();
  });
}

window.PauseMenuUI = PauseMenuUI;
window.initPauseMenuUI = initPauseMenuUI;
window.openPauseMenu = openPauseMenu;
window.closePauseMenu = closePauseMenu;
window.togglePauseMenu = togglePauseMenu;
window.selectPlayerCharacter = selectPlayerCharacter;

async function initApp() {
  initPauseMenuUI();
  await loadCharacterRoster();
  initGame();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
