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

function markSelectedCharacter(characterId) {
  const { selector } = PauseMenuUI.elements;
  if (!selector) {
    return;
  }

  selector.querySelectorAll('.character-option').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.characterId === characterId);
  });
}

function buildCharacterSelector() {
  const { selector } = PauseMenuUI.elements;
  if (!selector) {
    return;
  }

  selector.innerHTML = '';

  CharacterRoster.characters.forEach((character) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-option';
    button.dataset.characterId = character.id;
    button.setAttribute('aria-label', `Select ${character.label}`);

    const image = document.createElement('img');
    image.src = character.preview;
    image.alt = character.label;
    image.loading = 'lazy';

    const label = document.createElement('span');
    label.textContent = character.label;

    button.appendChild(image);
    button.appendChild(label);

    button.addEventListener('click', () => {
      selectPlayerCharacter(character.id);
    });

    selector.appendChild(button);
  });

  markSelectedCharacter(GameState.currentPlayerImage || CharacterRoster.getDefaultId());
}

async function selectPlayerCharacter(characterId) {
  if (!characterId || characterId === GameState.currentPlayerImage) {
    markSelectedCharacter(characterId);
    return;
  }

  GameState.setCurrentPlayerImage(characterId);
  markSelectedCharacter(characterId);

  const loaded = await setPlayerCharacter(characterId);
  if (loaded && typeof window.redrawGame === 'function') {
    window.redrawGame();
  }
}

function openPauseMenu() {
  if (typeof window.setGamePaused === 'function') {
    window.setGamePaused(true);
  }

  PauseMenuUI.isOpen = true;
  updatePauseMenuStats();
  buildCharacterSelector();

  const { menu } = PauseMenuUI.elements;
  if (menu) {
    menu.classList.add('is-open');
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

function initApp() {
  initPauseMenuUI();
  initGame();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
