// One rgba string per game accent color (see apps/web/tailwind.config.js's
// `game-*` palette), pre-computed with a 0.55 alpha for the pulse glow's
// peak opacity. Each call site of useScrollIntoViewOnChange picks whichever
// entry matches that section's own existing accent color.
export const PULSE_COLORS = {
  green: 'rgba(110, 118, 44, 0.55)',  // game-green #6E762C
  blue: 'rgba(60, 89, 70, 0.55)',    // game-blue #3C5946
  purple: 'rgba(124, 87, 37, 0.55)',   // game-purple #7C5725
  orange: 'rgba(192, 112, 42, 0.55)',  // game-orange #C0702A
  gold: 'rgba(201, 162, 39, 0.55)',  // game-gold #C9A227
  danger: 'rgba(166, 61, 42, 0.55)',   // game-danger #A63D2A
} as const;
