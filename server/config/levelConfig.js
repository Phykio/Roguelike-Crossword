export const LEVEL_CONFIG = [
  { level: 1,  size: 3,  difficulty: 1 },
  { level: 1,  size: 4,  difficulty: 1 },
  { level: 2,  size: 5,  difficulty: 1 },
  { level: 3,  size: 6,  difficulty: 2 },
  { level: 4,  size: 7,  difficulty: 2 },
  { level: 5,  size: 8,  difficulty: 3 },
  { level: 6,  size: 9,  difficulty: 3 },
  { level: 7,  size: 10, difficulty: 4 },
  { level: 8, size: 11, difficulty: 4 },
  { level: 9, size: 12, difficulty: 5 },
  { level: 10, size: 13, difficulty: 5 },
  { level: 11, size: 14, difficulty: 5 },
  { level: 12, size: 15, difficulty: 5 },
];

export function getLevelConfig(level) {
  const clamped = Math.max(1, Math.min(level, LEVEL_CONFIG.length));
  return LEVEL_CONFIG[clamped - 1];
}

export const UPGRADE_COSTS = {
  extra_hints:   20,
  time_bonus:    15,
  reveal_letter: 30,
  skip_word:     25,
};