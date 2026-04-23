# Phase Visual Identity & Button Labels — Design Spec
_2026-04-22_

## Overview

Two UI improvements to make game phases feel distinct and primary buttons self-explanatory.

---

## 1. Phase-Specific Visual Identity

### Goal
Each game phase wraps its content in a subtle colored tint so players immediately sense which phase they are in, even without reading the status badge.

### Color palette

| Phase | Color | Hex | Tint bg | Border |
|---|---|---|---|---|
| Waiting | Orange | `#FF9500` | `rgba(255,149,0,0.06)` | `rgba(255,149,0,0.15)` |
| Active | Green | `#34C759` | `rgba(52,199,89,0.06)` | `rgba(52,199,89,0.15)` |
| Guessing | Deep Orange | `#FF7800` | `rgba(255,120,0,0.06)` | `rgba(255,120,0,0.15)` |
| Results | Gold | `#FFD700` | `rgba(255,215,0,0.08)` | `rgba(255,215,0,0.25)` |

### Implementation

- Add `#FF7800` as `GameColors.deepOrange` in `constants/theme.ts`.
- Add four tint constants to `GameColors`: `waitingTint`, `waitingTintBorder`, `activeTint`, `activeTintBorder`, `guessingTint`, `guessingTintBorder`, `resultsTint`, `resultsTintBorder`.
- Each phase component (`WaitingPhase`, `ActivePhase`, `GuessingPhase`, `ResultsPhase`) wraps its root `<>` fragment in a `<View>` with `style={styles.phaseWrapper}`.
- `phaseWrapper` style: `borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 8` plus the phase-specific `backgroundColor` and `borderColor` from GameColors.
- No changes to `GameScreen.tsx` — the wrapper lives inside each phase component.

---

## 2. Icon-Only Button Labels

### Goal
Primary action buttons currently show only an SF Symbol icon. A new player cannot tell what tapping them does. Each button gets a small text label rendered below the icon.

### Buttons affected

| Button | Icon | Label text (localized) | Location |
|---|---|---|---|
| Start game | `arrow.right.circle.fill` | `game.ui.startGame` | `WaitingPhase` |
| Next round | `forward.end.fill` | `game.ui.nextRound` | `GuessingPhase` |
| Finalize | `flag.checkered` | `game.ui.finalize` | `GuessingPhase` |
| Leave game | `door.left.hand.open` | `game.ui.leaveGame` | `GameScreen` |

### Implementation

- Each button `TouchableOpacity` changes from a fixed `44×44` circle to a `flexDirection: 'column', alignItems: 'center', gap: 4` container.
- Icon size stays the same (`16`).
- Label: `<ThemedText style={styles.buttonLabel}>` — `fontSize: 10, fontWeight: '600', color: GameColors.white, textAlign: 'center'`.
- Button minimum tap area preserved via `minWidth: 44, minHeight: 44`.
- All label strings added to `locales/en.json` and `locales/uk.json`.

### Label strings (Ukrainian)

| Key | English | Ukrainian |
|---|---|---|
| `game.ui.startGame` | Start | Старт |
| `game.ui.nextRound` | Next | Далі |
| `game.ui.finalize` | Finish | Завершити |
| `game.ui.leaveGame` | Leave | Вийти |

---

## Files to change

1. `constants/theme.ts` — add `deepOrange` + 8 tint constants to `GameColors`
2. `components/game/WaitingPhase.tsx` — phase wrapper + start button label
3. `components/game/ActivePhase.tsx` — phase wrapper only
4. `components/game/GuessingPhase.tsx` — phase wrapper + next/finalize button labels
5. `components/game/ResultsPhase.tsx` — phase wrapper only
6. `components/game/GameScreen.tsx` — leave button label
7. `locales/en.json` — 4 new keys
8. `locales/uk.json` — 4 new keys

---

## Out of scope

- Dark mode tint variants (same rgba values work on dark backgrounds at this opacity)
- Animated tint transitions between phases (phase components unmount/remount — transition is handled by React)
- Changing icon sizes or colors
