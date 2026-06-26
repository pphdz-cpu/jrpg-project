/**
 * Calculates a character's final stats from base stats and their current job's modifiers.
 * HP and MP use multipliers; strength, magic, and speed use flat bonuses.
 *
 * @param {string} characterId - The character key (e.g. "char_001")
 * @returns {object|null} Final calculated stats
 */
function calculateStats(characterId) {
  const character = characters[characterId];
  if (!character) {
    console.error(`Character not found: ${characterId}`);
    return null;
  }

  const jobId = character.current_job;
  const job = jobs[jobId];
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    return null;
  }

  const { base_stats } = character;
  const modifiers = job.stat_modifiers;

  return {
    hp: Math.round(base_stats.hp * modifiers.hp_multiplier),
    mp: Math.round(base_stats.mp * modifiers.mp_multiplier),
    strength: base_stats.strength + modifiers.strength_bonus,
    magic: base_stats.magic + modifiers.magic_bonus,
    speed: base_stats.speed + modifiers.speed_bonus,
  };
}
