const characters = require('./characters.json');
const jobs = require('./jobs.json');

/**
 * Calculates a character's final stats from base stats and their current job's modifiers.
 * HP and MP use multipliers; strength, magic, and speed use flat bonuses.
 *
 * @param {string} characterId - The character key (e.g. "char_001")
 * @returns {object} Final calculated stats
 */
function calculateStats(characterId) {
  console.log(`\n--- Calculating stats for character: ${characterId} ---`);

  const character = characters[characterId];
  if (!character) {
    console.error(`Character not found: ${characterId}`);
    return null;
  }

  console.log(`Character: ${character.name} (Level ${character.level})`);
  console.log('Base stats:', character.base_stats);

  const jobId = character.current_job;
  const job = jobs[jobId];
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    return null;
  }

  console.log(`Current job: ${job.name} (${jobId})`);
  console.log('Job stat modifiers:', job.stat_modifiers);

  const { base_stats } = character;
  const modifiers = job.stat_modifiers;

  const finalStats = {
    hp: Math.round(base_stats.hp * modifiers.hp_multiplier),
    mp: Math.round(base_stats.mp * modifiers.mp_multiplier),
    strength: base_stats.strength + modifiers.strength_bonus,
    magic: base_stats.magic + modifiers.magic_bonus,
    speed: base_stats.speed + modifiers.speed_bonus,
  };

  console.log('Final calculated stats:', finalStats);
  console.log('--- Done ---\n');

  return finalStats;
}

// Test runs
console.log('=== Stat Calculator Test ===');

calculateStats('char_001');

// Example with a hypothetical second character on Black Mage (for manual testing)
// Uncomment after adding more characters to characters.json:
// calculateStats('char_002');

module.exports = { calculateStats };
