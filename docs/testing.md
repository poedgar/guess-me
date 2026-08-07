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
