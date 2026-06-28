const CHARACTER_IMAGE_ROOT = 'assets/images/characters';

const DEFAULT_PLAYER_CHARACTER_ID = 'chain_armor';

const FALLBACK_ROSTER = [
  {
    id: 'chain_armor',
    label: 'Chain Knight',
    preview: `${CHARACTER_IMAGE_ROOT}/chain_armor/preview.png`,
    idle: `${CHARACTER_IMAGE_ROOT}/chain_armor/player_idle.png`,
    walk: `${CHARACTER_IMAGE_ROOT}/chain_armor/player_walk.png`,
    meta: `${CHARACTER_IMAGE_ROOT}/chain_armor/player.json`,
  },
];

const CharacterRoster = {
  characters: [...FALLBACK_ROSTER],
  loaded: false,

  getById(id) {
    return this.characters.find((entry) => entry.id === id) || this.characters[0];
  },

  getDefaultId() {
    return this.characters[0] ? this.characters[0].id : DEFAULT_PLAYER_CHARACTER_ID;
  },
};

async function loadCharacterRoster() {
  try {
    const response = await fetch(`${CHARACTER_IMAGE_ROOT}/roster.json`);
    if (!response.ok) {
      throw new Error(`Failed to load roster (${response.status})`);
    }

    const roster = await response.json();
    if (Array.isArray(roster) && roster.length > 0) {
      CharacterRoster.characters = roster;
    }
  } catch (error) {
    CharacterRoster.characters = [...FALLBACK_ROSTER];
  }

  CharacterRoster.loaded = true;
  return CharacterRoster.characters;
}

window.CHARACTER_IMAGE_ROOT = CHARACTER_IMAGE_ROOT;
window.DEFAULT_PLAYER_CHARACTER_ID = DEFAULT_PLAYER_CHARACTER_ID;
window.CharacterRoster = CharacterRoster;
window.loadCharacterRoster = loadCharacterRoster;
