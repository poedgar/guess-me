# Testing

## Stack

| Tool | Purpose |
|---|---|
| Jest 29 | Test runner |
| jest-expo | Expo-specific Jest preset |
| @testing-library/react-native | Component rendering and assertions |
| ts-jest | TypeScript support |

---

## Running Tests

```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode — re-runs on file change
npm run test:coverage     # Coverage report (output in coverage/)
```

---

## File Layout

```
__tests__/
├── AuthScreen.test.tsx
├── GameScreen.test.tsx
├── Results.test.tsx
├── LanguageSelector.test.tsx
├── QRCodeGenerator.test.tsx
├── QRScanner.test.tsx
├── HeaderLogo.test.tsx
├── IconSymbol.test.tsx
├── HelloWave.test.tsx
└── SimpleComponent.test.tsx
```

Test files mirror their source component names. Place new tests in `__tests__/` with the suffix `.test.tsx`.

---

## Configuration Files

| File | Purpose |
|---|---|
| `jest.config.js` | Main Jest config (preset, transform, coverage) |
| `jest.setup.js` | Global mocks set up after test framework loads |
| `jest.pre-setup.js` | Pre-initialization (runs before Jest setup) |

---

## Mocking Strategy

### Firebase (always mock)

Firebase is fully mocked — tests never hit a real database.

```typescript
// jest.setup.js
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null); // no user by default
    return jest.fn(); // unsubscribe
  }),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn(() => new Date()),
}));
```

### Google Sign-In

```typescript
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));
```

### Expo Modules

```typescript
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
```

### Contexts

When testing a component that consumes a context, wrap it in the real provider with controlled state, or mock the hook:

```typescript
// Option A — mock the hook
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    currentGame: null,
    loading: false,
    enterGame: jest.fn(),
  }),
}));

// Option B — provide real context with test state
render(
  <GameProvider>
    <MyComponent />
  </GameProvider>
);
```

---

## Writing a New Test

### Component Test

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import MyComponent from '@/components/MyComponent';

// Mock dependencies
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({ currentGame: null, loading: false }),
}));

describe('MyComponent', () => {
  it('renders without crashing', () => {
    render(<MyComponent />);
  });

  it('shows correct text', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeTruthy();
  });

  it('calls handler on press', () => {
    const onPress = jest.fn();
    render(<MyComponent onPress={onPress} />);
    fireEvent.press(screen.getByTestId('my-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Context Test

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { GameProvider, useGame } from '@/contexts/GameContext';

const wrapper = ({ children }) => <GameProvider>{children}</GameProvider>;

describe('GameContext', () => {
  it('starts with no game', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(result.current.currentGame).toBeNull();
  });
});
```

---

## Accessibility in Tests

Use `testID` props on interactive elements to make them queryable:

```typescript
<TouchableOpacity testID="submit-button" onPress={handleSubmit}>
```

```typescript
fireEvent.press(screen.getByTestId('submit-button'));
```

---

## Coverage Targets

Coverage is collected for:

```
contexts/**
components/**
utils/**
hooks/**
```

Excluded:
```
**/*.d.ts
node_modules/**
__tests__/**
jest.*.js
scripts/**
```

Run `npm run test:coverage` and open `coverage/lcov-report/index.html` for the full report.

---

## Known Limitations

- `GameScreen.test.tsx` covers basic rendering. Phase-specific UI (guessing keyboard, point awarding) is not yet fully tested.
- Context integration tests (testing the Firestore listener lifecycle) are pending.
- Sound generation tests are not present — `SoundContext` uses Web Audio API which is not available in jsdom.

---

## Cypress E2E Tests (apps/web)

The Jest suite above covers unit/component tests for the Expo app. Separately, `apps/web/cypress/e2e/` holds end-to-end specs for the web app, covering mirror/basket/clash game modes, settings, lifecycle, locale switching, animations, and admin-left handling.

Unlike the Jest tests, these run against **real production Firebase** — there is no local or mocked backend. Run them from `apps/web`:

```bash
npm run cypress:open   # interactive runner
npm run cypress:run    # headless run
```

They also run in CI via `.github/workflows/cypress-e2e.yml`, triggered on push to `apps/web/**` or `packages/shared/**`, plus a 6-hourly schedule.

### Known flaky specs (2026-08-10)

After the Firestore security rules rollout (`firestore.rules`, see `docs/superpowers/specs/2026-08-08-firestore-security-rules-design.md`), the added latency of real rules evaluation (replacing the previous always-permissive test-mode rules) thinned the timing margin throughout the longest, most account-switch-heavy mirror-mode specs — the ones that determine round roles (target vs. commenter) at runtime by switching accounts and reading the DOM, rather than hardcoding, since target selection isn't perfectly predictable even with a stubbed `Math.random`.

**Root cause found and fixed** (via a local Cypress run with video recording enabled — CI's default run has `Video: false` and no trace capture, which made this undiagnosable from CI logs alone): the role-detection "peek" step did a one-shot, non-retrying DOM read (`$body.find(...)`) to determine who got which role. Earlier hardening (waiting for `[data-cy=participant-row]` to disappear, confirming the client had left `WaitingPhase`) closed one race but not the underlying one — the DOM could still be mid-render for a brief instant after that point (e.g. a flash before all `currentRound` fields settle), and the one-shot read could catch that transient moment and misclassify the role, cascading into every subsequent step of the test. Fixed by replacing the one-shot read with a retrying `cy.get('body').should(...)` that waits for one of the two real terminal states (`[data-cy=comment-input]` for the commenter, or a new `[data-cy=target-waiting-view]` added to `ActivePhase.tsx` for the target) before trusting a synchronous read of which one it is. The same principle was applied to the round-1-to-round-2 `finalize-button` transition (confirm on the admin's own page that round 2 has actually started before another account switches in to read it). Applied to `mirror-round.cy.ts`, `mirror-multi-round.cy.ts`, and `admin-writes-comments.cy.ts`. Confirmed via several clean local runs (with video) that this specific failure mode (`comment-input`/`round-info` timeouts from a misidentified role) no longer occurs.

**Residual, accepted flakiness**: these three specs remain the longest and most account-switch-heavy in the suite (10-20+ `signInAsTestUser` calls each, against real production Firebase), and CI runs after the above fix still occasionally show *different*, scattered failures at other points — e.g. `game_not_found` on an early join (a pre-existing, already-documented "write hasn't landed yet" race these files' `SETTLE_MS` waits already partially address), a `guess-author-button` timeout on `GuessingPhase.tsx` (a different component than the `ActivePhase.tsx` fix covers), or a `cy.click()` blocked by an unrelated nav element mid-transition. None of these repeat the diagnosed role-detection mechanism — they look like broadly thinned timing margin across many different interaction points rather than one fixable root cause. `retries.runMode: 1` in `cypress.config.ts` exists precisely to absorb this class of residual variance and usually does; an occasional full CI rerun may still be needed for these three specs specifically. Not pursued further — diminishing returns for how large the fix surface would need to be.
