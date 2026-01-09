# Game Tests

This directory contains comprehensive tests for the game functionality.

## Test Structure

### Unit Tests

#### `contexts/__tests__/GameContext.test.tsx`
Tests for the GameContext provider covering all game functions:
- **Game Creation & Joining**
  - `createGame()` - Creates a new game
  - `joinGame()` - Joins an existing game
  - `enterGame()` - Unified entry point (create or join)
  - `leaveGame()` - Leaves the current game

- **Game Flow**
  - `startGame()` - Admin starts the game
  - `submitComment()` - Players submit anonymous comments
  - `showComments()` - Admin reveals all comments
  - `givePoints()` - Target gives points to comments
  - `finishGivingPoints()` - Target marks points as complete
  - `givePointsToTarget()` - Players give points to target
  - `startNextRound()` - Admin starts next round
  - `startGuessingPhase()` - Admin starts guessing phase
  - `submitGuess()` - Target guesses comment authors
  - `finalizeGuessingPhase()` - Admin finalizes and calculates scores
  - `markPlayerGuessesSubmitted()` - Marks player as submitted

- **Edge Cases**
  - Permission checks (admin vs player)
  - Validation (minimum participants, game state)
  - Error handling (network errors, invalid operations)

### Component Tests

#### `components/game/__tests__/GameScreen.test.tsx`
Tests for the GameScreen React component:
- **UI Rendering**
  - Initial state (signed in/out, game/no game)
  - Game status displays (waiting, active, guessing_phase, finished)
  - Leaderboard display
  - Participant list

- **User Interactions**
  - Form submissions (create/join game)
  - Button clicks (start game, submit comments, etc.)
  - Input handling (comment text, game ID)
  - Navigation flows

- **State Management**
  - Loading states
  - Error displays
  - Success feedback

### Integration Tests

#### `__tests__/integration/gameFlow.test.tsx`
End-to-end tests for complete game flows:
- **Complete Game Flow**
  - Full game lifecycle from creation to completion
  - Multiple rounds progression
  - Score calculation (game points + guess points)
  - Round transitions

- **Score Calculation**
  - Separation of game points and guess points
  - Total score calculation
  - Leaderboard updates

- **Round Progression**
  - Multiple rounds with different targets
  - Game completion when all participants have been targets

- **Error Handling**
  - Network error recovery
  - Invalid operation prevention

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test GameContext.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="should create"
```

## Test Coverage

The tests aim to cover:
- ✅ All GameContext functions
- ✅ All GameScreen UI states
- ✅ Complete game flow scenarios
- ✅ Edge cases and error handling
- ✅ Score calculation logic
- ✅ Permission checks
- ✅ State transitions

## Mocking

Tests use mocks for:
- Firebase Firestore operations
- Authentication context
- Expo Haptics
- React Native components (Alert, Clipboard, Platform)
- AsyncStorage

## Writing New Tests

When adding new features:

1. **Add unit tests** in `contexts/__tests__/` for new context functions
2. **Add component tests** in `components/game/__tests__/` for new UI elements
3. **Add integration tests** in `__tests__/integration/` for new flows
4. **Update mocks** in `jest.setup.js` if needed
5. **Update this README** with new test descriptions

## Test Best Practices

- Use descriptive test names that explain what is being tested
- Test both success and failure cases
- Test edge cases (empty states, boundary conditions)
- Keep tests isolated and independent
- Mock external dependencies
- Use `act()` for async operations
- Use `waitFor()` for async assertions

