// One rgba string per game accent color (see apps/web/tailwind.config.js's
// `game-*` palette), pre-computed with a 0.55 alpha for the pulse glow's
// peak opacity. Each call site of useScrollIntoViewOnChange picks whichever
// entry matches that section's own existing accent color.
export const PULSE_COLORS = {
  green: 'rgba(52, 199, 89, 0.55)',   // game-green #34C759
  blue: 'rgba(0, 122, 255, 0.55)',    // game-blue #007AFF
  purple: 'rgba(175, 82, 222, 0.55)', // game-purple #AF52DE
  orange: 'rgba(255, 149, 0, 0.55)',  // game-orange #FF9500
  gold: 'rgba(255, 215, 0, 0.55)',    // game-gold #FFD700
  danger: 'rgba(255, 59, 48, 0.55)',  // game-danger #FF3B30
} as const;
