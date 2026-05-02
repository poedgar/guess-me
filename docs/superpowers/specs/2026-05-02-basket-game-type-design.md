# Basket Game Type — Design Spec
**Date:** 2026-05-02
**Status:** Approved

---

## Overview

Add a second game type ("Basket") to the app alongside the existing "In the Mirror" game. The admin selects the game type in the waiting room before starting. For this iteration, Basket is a placeholder screen — the full Basket mechanics will be designed and implemented separately.

---

## Folder Structure

All game-specific phase components are moved into sub-folders under `components/game/`. Shared infrastructure stays at the `components/game/` level.

```
components/game/
  mirror/                        ← new sub-folder (files moved, not rewritten)
    WaitingPhase.tsx
    ActivePhase.tsx
    GuessingPhase.tsx
    ResultsPhase.tsx
    PostGuessingPointsPanel.tsx
  basket/                        ← new sub-folder
    BasketScreen.tsx             ← placeholder component
  GameScreen.tsx                 ← stays; updated imports + routing
  GameHeader.tsx                 ← shared; stays
  Leaderboard.tsx                ← shared; stays
  gameStyles.ts                  ← shared; stays
```

All `@/components/game/WaitingPhase` import paths become `@/components/game/mirror/WaitingPhase`. Test files in `__tests__/` are updated accordingly.

---

## Data Layer

### `Game` interface — new field

```typescript
gameType?: 'mirror' | 'basket';   // defaults to 'mirror' when absent
```

Added to `GameContext.tsx`. Old games without this field behave identically (treated as `'mirror'`).

### New GameContext method

```typescript
setGameType: (type: 'mirror' | 'basket') => Promise<void>;
```

Writes `gameType` to Firestore via `updateDoc`. Only the admin calls this; no permission guard needed in the context (WaitingPhase already restricts the UI to admins).

---

## WaitingPhase UI

A two-button toggle is added to the admin settings area, visually consistent with the existing `adminWritesComments` and `showSurnames` toggles.

- Buttons: "In the Mirror" / "Basket"
- Visibility: admin only (same guard as other settings)
- Default selected: "In the Mirror"
- On press: calls `setGameType()`

New i18n keys added to both `locales/en.json` and `locales/uk.json`:
- `game.ui.gameTypeMirror` → "In the Mirror" / "В дзеркалі"
- `game.ui.gameTypeBasket` → "Basket" / "Кошик"
- `game.ui.gameTypeLabel` → "Game type" / "Тип гри"

---

## GameScreen Routing

Before the existing `status`-based routing block, add a `gameType` check:

```typescript
const gameType = currentGame.gameType ?? 'mirror';

if (gameType === 'basket') {
  return <BasketScreen game={currentGame} user={user} locale={locale} />;
}
// existing status machine below (waiting / active / guessing_phase / finished)
```

The basket screen renders regardless of `status` — it owns its own full-screen UI.

---

## BasketScreen Component

`components/game/basket/BasketScreen.tsx` — a minimal placeholder.

Props:
```typescript
interface Props {
  game: Game;
  user: { uid: string } | null;
  locale: string;
}
```

Renders: game name ("Basket") and a "Coming soon" message. No phase logic, no Firestore writes. The leave-game button is rendered by `GameScreen.tsx` outside the game-type routing block, so `BasketScreen` does not need its own leave action.

---

## Backward Compatibility

- `gameType` is optional on `Game`; absence equals `'mirror'`.
- All existing games continue to work without any migration.
- `setGameType` is a no-op if called by a non-admin (Firestore security rules govern writes; the UI guard prevents the call).

---

## Testing

- Unit test for `setGameType`: verify it calls `updateDoc` with `{ gameType: type }`.
- GameScreen routing test: when `gameType === 'basket'`, BasketScreen renders instead of WaitingPhase.
- WaitingPhase toggle test: pressing "Basket" calls `setGameType('basket')`.
- Move all existing phase-component test imports to new paths.

---

## Out of Scope

- Basket game mechanics (rounds, comments, scoring) — future spec.
- Preventing mid-game type switching — deferred; the toggle is only meaningful before `startGame()` is called.
