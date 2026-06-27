const jobs = {
  job_knight: {
    name: 'Knight',
    description: 'Protects allies and strikes with heavy physical damage.',
    stat_modifiers: {
      hp_multiplier: 1.20,
      mp_multiplier: 0.50,
      strength_bonus: 10,
      magic_bonus: -5,
      speed_bonus: 0,
    },
    innate_abilities: ['cover'],
    allowed_weapons: ['swords', 'shields', 'heavy_armor'],
    level_unlocks: {
      level_1: { cost: 10, ability_unlocked: 'cover' },
      level_2: { cost: 30, ability_unlocked: 'two_handed' },
    },
  },
  job_black_mage: {
    name: 'Black Mage',
    description: 'Casts destructive elemental magic.',
    stat_modifiers: {
      hp_multiplier: 0.75,
      mp_multiplier: 1.50,
      strength_bonus: -5,
      magic_bonus: 12,
      speed_bonus: -2,
    },
    innate_abilities: ['black_magic'],
    allowed_weapons: ['rods', 'daggers', 'cloth_armor'],
    level_unlocks: {
      level_1: { cost: 10, ability_unlocked: 'black_magic_lvl1' },
    },
  },
  job_white_mage: {
    name: 'White Mage',
    description: 'Heals allies with restorative white magic.',
    stat_modifiers: {
      hp_multiplier: 0.90,
      mp_multiplier: 1.75,
      strength_bonus: -8,
      magic_bonus: 10,
      speed_bonus: 0,
    },
    innate_abilities: ['white_magic'],
    allowed_weapons: ['staves', 'rods', 'cloth_armor'],
    level_unlocks: {
      level_1: { cost: 10, ability_unlocked: 'cure' },
    },
  },
};
