# Admin Pass
YR20RZ67FKy88HQVF6yW3

# Deploy command
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview

# Scheme change
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview

eas credentials

and insert SHA-1 into Firebase

# Firebase Google Auth 👋

- No need in Google Cloud Console

- WebClient ID: 841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com is from Firebase Console (Google Sign-in Method)

- SHA-1: D8:48:0E:63:2A:FA:61:30:E3:B9:0A:12:BD:DF:1F:CD:A1:40:12:2E is mapped in Firebase Console (app with package name com.pscycho.play)

- google-services.json is from Firebase Console (app with package name com.pscycho.play)

# Inviroments

1. Node v22

# TODO

Готово

Давати бали може тільки адмін і віднімати також

Ад хок черговість

Можливість додати більше балів ніж один за комент цілі

Жіночий рід

Звуки на мобілі

Анімація

Звуки шо показують шо адмін може тиснути кніпку

Publish to Google Play

Here's a list of graphic design improvements, from highest to lowest visual impact:

1. Unify the color system
The palette mixes Android Material colors (#4CAF50, #9C27B0) with iOS-native colors (#34C759, #FF3B30). They clash on screen — the greens especially read as two different hues. Pick one system (ideally the iOS palette, since the game targets mobile-first) and align everything to it.
2. Phase-specific visual identity
All four game phases render with the same neutral card style. Each phase could carry a distinct mood — a warm amber tint in waiting, energized blue-green in active, deep purple+blur in guessing, gold celebration in results. Even a subtle background tint per phase would make transitions feel intentional.
3. Icon-only primary buttons are unlearnable
The main action buttons (start game, leave, submit guesses, finalize round) are all icon-only pill buttons with no label. A first-time user has no idea what the checkered flag does, or the door icon. Add a text label, at least for first-time screens.
4. Game ID display needs more presence
The game ID is the single most-shared element (people send it to friends), but it sits in a small green box with tiny monospace text. It should be the hero of the waiting screen — large, bold, with a big obvious "Copy" button and the QR code prominently alongside it, not buried.
5. Cards are visually identical
Comment cards, player cards, score rows, toggle settings, and guess cards all use rgba(0,0,0,0.05) with the same borderRadius: 8. They're visually indistinguishable at a glance. Different card types should have distinct shapes, borders, or accent colors to create scannable hierarchy.
6. The leaderboard lacks drama
Top-3 ranks use medal emojis in plain text rows. A podium layout for 1st/2nd/3rd (larger card, distinct treatment) with the rest as a compact list below would make results feel rewarding and worth anticipating.
7. The brand palette doesn't match the concept
"In The Mirror" is a psychological, introspective game. The current palette is generic Material Design. A brand-appropriate palette — deep indigo/slate for primary, warm gold for points, soft rose for feedback — would make the app feel distinct and purposeful instead of like a generic quiz app.
8. Dark mode contrast issues
inputDark (#2a2a2a) on the dark background (#151718) is ~1.3:1 contrast — effectively invisible. The input fields and card backgrounds in dark mode need more separation, either through a slightly lighter fill or a visible border.
9. No phase transition animation
The app snaps between phases (waiting → active → guessing → results) with no animation. A short fade or slide-up transition when the game status changes would make the experience feel more dynamic and signal to players that something significant just happened.
10. Toggle switches feel like developer UI
The custom toggles use #767577 (cold gray) when off, clashing with the warmer palette. They're also slightly undersized at 51×31px. Using the OS native Switch component, or a redesigned toggle that matches the brand palette, would feel more polished.










Critical (Production Risk)
Security
1. Hardcoded Firestore password doc ID — GameContext.tsx has 'YR20RZ67FKy88HQVF6yW' as a literal in source. Should move to an environment variable.
2. Firebase config in source control — config/firebase.js exposes all keys including appId and webClientId. Should use app.config.js + expo-constants pulling from .env (.env in .gitignore).
3. Missing auth guards — Several GameContext methods (submitComment, startGame, givePoints) use user.uid without verifying the user is still authenticated, risking runtime errors if auth state changes mid-session.
i18n / Broken Features
4. Dynamic language switching is broken — i18n/index.ts sets i18n.locale once at init time. LanguageContext updates its own state but never calls i18n.locale = newLocale, so language changes don't actually take effect.
5. Missing en.json keys — results.comments and results.noComments exist in uk.json and are used in results.tsx but are absent from en.json, rendering raw key strings to English users.
6. Hardcoded Ukrainian strings in AuthScreen — Error messages "Помилка входу", "Не вдалося увійти", "Помилка виходу", "Не вдалося вийти", and the fallback "ОК" button are hardcoded Ukrainian regardless of selected locale.

High Priority (Functionality & Code Health)
Debug Pollution
7. 50+ console.log('DEBUG:…') in production — GameContext.tsx and GameScreen.tsx are full of debug statements (e.g. console.log('DEBUG: getRequiredComments'), console.log('DEBUG: Show Comments button clicked')). Should either be removed or gated behind __DEV__.
Code Duplication
8. HeaderLogo defined three times — Identical component implementation in AuthScreen.tsx, GameScreen.tsx, and results.tsx. Extract to components/ui/HeaderLogo.tsx.
9. FancyAlert pattern duplicated — The fancy modal alert rendering exists independently in both AuthScreen and GameScreen. Extract to components/ui/FancyAlert.tsx.
10. Repeated toggle handler pattern — handleToggleAdminComments, handleToggleShowSurnames, handleToggleTargetSelectionMode, handleToggleShowGuessResults all follow the same structure. Could be a single handleToggleSetting(key) factory.
Architecture
11. GameScreen.tsx is ~2,500 lines — One file renders every game phase (waiting / active / guessing / post-guessing / finished) plus admin controls, participant lists, leaderboard, and the no-game join screen. Split into phase-specific components: WaitingPhase, ActivePhase, GuessingPhase, ResultsPhase, JoinScreen.
12. isAdmin / derived state recalculated on every render — isAdmin, commentsForPlayer, totalTargets, isFinalRound etc. are computed inline in the render body. Move to useMemo or expose them from GameContext.
13. Context value object not memoized — GameContext returns a plain object literal every render, causing every consumer to re-render on any state change. Wrap in useMemo.
14. No data service layer — All Firestore calls live directly in GameContext. A thin gameService.ts (pure functions, no state) would make testing and swapping backends easier.
Missing Error Handling
15. No input length validation on comments — submitComment() accepts any string with no maximum length, which could bloat Firestore documents.
16. handleLeaveGame button not disabled during operation — No isLeaving state, so rapid taps can fire multiple leave attempts.
17. No distinction between wrong admin password and non-existent game ID — handleEnterGame shows the same generic error for both failure modes.

Medium Priority (Performance & Type Safety)
Performance
18. No useCallback on any handler — All 40+ handler functions in GameScreen are recreated every render. Apply useCallback to at least the ones passed to child components.
19. selectedGuesses updated with object spread — Every guess keystroke creates a new object. Use useReducer instead.
20. getRequiredComments() called multiple times per render — Complex conditional function recomputed on every render pass. Memoize with useMemo.
21. getDisplayName() called in multiple render paths — Pure function called many times per render. Move to a useMemo map.
22. SoundContext setTimeout calls without cleanup — Web Audio oscillator timeouts (lines ~95–182) are never cleared if the component unmounts, causing memory leaks.
TypeScript
23. Timestamp fields typed as any — createdAt, joinedAt, submittedAt in interfaces should be Date | Timestamp (import Timestamp from firebase/firestore).
24. (response as any) in AuthContext — Google Sign-In response cast unsafely. Define a proper union type for web vs. native response shapes.
25. catch (error: any) everywhere — Replace with catch (error: unknown) and narrow with error instanceof Error.
26. (window as any).webkitAudioContext — Define a proper AudioContextConstructor interface instead of casting.

Lower Priority (UX, Accessibility, Polish)
Accessibility
27. Zero accessibilityLabel attributes in GameScreen — Icon-only buttons (start game, leave game, enter game, show comments) have no accessible labels for screen readers.
28. Zero testID attributes in GameScreen — Makes UI testing very difficult. Add testID to key interactive elements.
29. Emoji-only indicators in leaderboard — ['🥇','🥈','🥉'] in results.tsx use emoji as the sole ranking indicator. Add a text alternative.
30. Color-only point indicators — Green styling on points in results has no text alternative for color-blind users.
UX Gaps
31. No loading state while awarding points — Some async operations (point awarding) don't disable buttons or show a spinner.
32. No character counter on comment input — Users can't see how close they are to any limit.
33. Hardcoded marginTop: 75 in AuthScreen — Brittle fixed position for the language toggle; breaks on small screens. Use useSafeAreaInsets.
34. Locale defaults to Ukrainian regardless of system — i18n/index.ts forces 'uk' instead of reading from expo-localization and falling back to 'uk' only if unsupported.
35. No "copy game ID" feedback on non-iOS — Clipboard copy is implemented but the success feedback (Haptics) only fires on iOS due to the process.env.EXPO_OS === 'ios' check.
Missing Features (clearly implied)
36. No game cleanup / expiry — Finished games stay in Firestore forever. Add a Cloud Function or client-side "delete old games" mechanism.
37. No deep-link / QR code join — react-native-qrcode-svg is installed and a QR code is rendered, but there's no corresponding scanner entry point for joining a game by scanning.
38. No push notifications — Players have no way to know when it's their turn without keeping the app open. expo-notifications is not set up.
39. No profile photo — Firebase Auth provides photoURL but the app ignores it.
40. Admin password is global and static — There's no per-user or per-game admin role system; the single Firestore password never rotates.
Testing Gaps (beyond what exists)
41. Zero tests for results.tsx — The leaderboard/history screen has no test coverage.
42. No integration test for the full game flow — The happy path (create → join → comment → guess → score) is untested end-to-end.
43. No edge-case tests for GameContext — Admin leaving mid-game, concurrent submissions, and empty participant lists are all handled in code but untested.
44. gameIdGenerator word lists not validated — No test verifying all adjectives/nouns are unique and lowercase, which could generate duplicate IDs.

Highest ROI starting points: fixing the broken i18n switching (#4), adding the missing en.json keys (#5), removing debug logs (#7), extracting HeaderLogo (#8), and fixing the missing auth guards (#3) — these are small changes with outsized impact on correctness and user experience.





______


Stylistic Improvements
High Impact
1. Extract a game color palette into constants/theme.ts
~30 hardcoded hex values are scattered across all phase components with no shared name. The same colors appear in 5+ files:
* #4CAF50 (action green) — 15+ occurrences
* #9C27B0 (guessing purple) — 6+ occurrences
* #FF9800 (admin orange) — 4+ occurrences
* #4285F4 (Google blue) — 4+ occurrences
* #ff3b30 (danger red) — 3+ occurrences
Suggest adding Colors.game.green, Colors.game.purple, Colors.game.admin, Colors.game.danger, Colors.game.waiting to the theme.
2. Add status phase colors as named constants
The status badge background is inlined identically in WaitingPhase, ActivePhase, and GuessingPhase:

// Currently inline in 3 files:
backgroundColor: '#FFA500'  // waiting
backgroundColor: '#4CAF50'  // active  
backgroundColor: '#9C27B0'  // guessing
These should be a statusColors map in theme, and the status badge itself could be a shared <StatusBadge status={game.status} /> component.
3. Extract duplicate leaderboard styles into a shared Leaderboard component
leaderboardItem, leaderboardFirst, leaderboardCurrentUser, rankEmoji, pointsValue, pointsLabel, and 8 more styles are copy-pasted identically in both WaitingPhase.tsx and ResultsPhase.tsx. The JSX is also near-identical. This is the strongest case for a shared <Leaderboard> component.
4. Fix ~15 hardcoded Ukrainian/English strings not going through t()
Across ActivePhase, GuessingPhase, PostGuessingPointsPanel, and ResultsPhase:
* 'Завантаження...' (2×), 'Готово', 'Бали нараховано', 'Дати 1 бал цільовому гравцю', 'Пропущено', 'Пропустити' in ActivePhase
* 'Результати вгадування', 'Ви правильно вгадали...', 'Ви отримали...' in GuessingPhase
* 'Гра:', 'Вгадування:', 'всього', '(Ви)' in ResultsPhase
* Multiple English strings in PostGuessingPointsPanel (admin UI copy)

Medium Impact
5. Move isDark color branching into useThemeColor or theme constants
The same branching pattern appears in ActivePhase, JoinScreen, and WaitingPhase:

// Repeated in 3 files for TextInput styling:
backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5'
borderColor: isDark ? '#444' : '#ddd'
placeholderTextColor={isDark ? '#888' : '#999'}
These pairs belong in theme, not inline.
6. Deduplicate statusBadge / statusLabel / statusText / gameFlowContainer / buttonDisabled styles
These are defined identically in 3–5 files each:
* gameFlowContainer: { marginTop: 24, marginBottom: 24 } — in WaitingPhase, ActivePhase, GuessingPhase, PostGuessingPointsPanel, ResultsPhase
* buttonDisabled: { opacity: 0.6 } — in 5 files
* The status badge trio — in WaitingPhase, ActivePhase, GuessingPhase
These belong in a components/game/gameStyles.ts shared stylesheet.
7. Standardize button shape
There are two competing button shapes with no clear rule about when each is used:
* borderRadius: 999 (pill) — most icon-only action buttons
* borderRadius: 8 (rounded rect) — some submit/destructive buttons
The pill is used for icon-only buttons and the rounded rect for text buttons — but this isn't applied consistently. Define a rule and apply it uniformly.
8. Fix two redundant ternaries
* AuthScreen.tsx: isDark ? '#ff3b30' : '#ff3b30' — both branches identical
* AuthScreen.tsx: isDark ? '#000' : '#000' — same

Low Impact / Polish
9. Standardize icon sizes
Almost everything uses size={16}, but size={14} appears in ActivePhase for "plus.circle.fill" (same visual role as 16px icons elsewhere), and size={20} in AuthScreen. Pick one size for in-button icons.
10. Lift complex inline styles to StyleSheet
Several inline style objects are verbose enough to deserve named entries:
* The language toggle row in WaitingPhase/GameHeader/JoinScreen: { marginTop: 12, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 12 } — repeated ~5 times
* The guess result card coloring in GuessingPhase (inline background + border in the modal map)
11. Remove leftover fancyModal/fancyButton/headerLogoContainer styles from AuthScreen
After extracting FancyAlert and HeaderLogo, ~8 now-unused style entries remain in AuthScreen.tsx's StyleSheet.

Quick Count
Category	Issues
Hardcoded colors	~30
Missing t()	~15
Duplicate styles	~6 style groups across 3–5 files each
Redundant code	2 identical ternaries, leaderboard JSX copy-paste
Inconsistencies	button shape, icon size, isDark branching pattern


# Testing Documentation

## Overview
This project uses Jest and React Native Testing Library for comprehensive testing of components and functionality.

## Test Structure

### Test Files Location
- `__tests__/` - Main test directory for component tests
- `components/**/__tests__/` - Component-specific tests (removed in favor of centralized tests)

### Current Test Suite

#### AuthScreen Tests (`__tests__/AuthScreen.test.tsx`)
**Purpose**: Tests the authentication screen component functionality.

**Test Cases**:
1. **renders without crashing** - Verifies the AuthScreen component can be imported and rendered without throwing errors
2. **renders sign-in content** - Tests that the component renders properly with all required providers (SafeAreaProvider, LanguageProvider, AuthProvider)
3. **handles sign-in function call** - Ensures the signIn function from AuthContext is properly available and callable

**Mocked Dependencies**:
- `@/components/themed-text` - Mocked as React Native Text component
- `@/components/themed-view` - Mocked as React Native View component  
- `@/components/LanguageSelector` - Mocked as simple View component
- `@/components/ui/icon-symbol` - Mocked as Text component
- `@/contexts/AuthContext` - Mocked with default auth state and mock functions
- `@/contexts/LanguageContext` - Mocked with default language state
- `@/i18n` - Mocked to return translation keys

#### LanguageSelector Tests (`__tests__/LanguageSelector.test.tsx`)
**Purpose**: Tests the language selection component functionality.

#### SimpleComponent Tests (`__tests__/SimpleComponent.test.tsx`)
**Purpose**: Basic component rendering tests for validation.

## Running Tests

### Command
```bash
npm test
```

### Specific Test File
```bash
npm test -- __tests__/AuthScreen.test.tsx
```

### Test Configuration
- **Jest Config**: `jest.config.js`
- **Setup Files**: 
  - `jest.pre-setup.js` - Pre-initialization
  - `jest.setup.js` - Global mocks and setup

## Mocked Dependencies

### Firebase Services
- Firebase Auth, Firestore, and Storage are fully mocked
- Google Sign-In functionality is mocked
- AsyncStorage is mocked for local storage

### Expo Services
- Expo Haptics are mocked
- Expo Image is mocked
- React Native Safe Area Context is properly configured

### UI Components
- Custom themed components are mocked to their React Native equivalents
- Icon components are mocked as Text components
- Platform-specific components are handled appropriately

## Testing Best Practices Used

1. **Isolation**: Each test is independent and doesn't rely on state from other tests
2. **Mocking**: External dependencies are properly mocked to ensure consistent test results
3. **Provider Wrapping**: Components are tested with their required context providers
4. **Error Handling**: Tests verify components don't throw errors during rendering
5. **Functionality Testing**: Core functions (like signIn) are verified to be available

## Future Test Additions

Consider adding tests for:
- GameScreen component functionality
- GameContext state management
- Integration tests for user flows
- Error boundary testing
- Accessibility testing

# Rules
Психологічна гра (комунікативний тренінг)
З чим працюємо:
з анонімними висловлюваннями учасників щодо один одного.
Що тестуємо та розвиваємо:
вміння «прочитати» другу людину, відчути її образ;
гнучкість реагування на те, як сприймають тебе інші та вміння, за необхідності, корегувати таке бачення;
здатність оцінити влучне спостереження іншого щодо тебе.
Очікуваний ефект:
Прискорене проходження комунікативної «дистанції» та вихід на більш продуктивний рівень психологічної взаємодії.
Різновиди гри:
А («телескоп») - всі про одного;
Б («кошик») - знайди висловлювання, котре стосується саме тебе;
В («обмін кошиками») – кожна з двох команд спільно вирішує кого стосуются висловлювання від іншої команди.
Основні кроки та їх можлива технічна реалізація:
Психологічне налаштування та ознайомлення з правилами – модератор усно або\та інформація на екрані 
(зокрема, висловлювання можуть бути довільними або згідно певної теми, можливі слова-підказки).
Нумерація учасників (на час гри № буде на столі біля учасника). Оптималька кількість 6 -12.
Вхід у гру (дозвіл надає ведучий). Учасник бачить пронумеровані папки, кількість активованих папок = кількості учасників.
Вхід у власну ігрову папку (згідно номера). За кожним письмовим висловлюванням, яке буде надіслано з даної папки, буде приховано № учасника (А) та + номер адресата (Б і В)
Поле1: вікно запису висловлювання; вікно № адресата (щодо кого вислів); кнопка зберегти-надіслати. 
Гра А № адресата  один для всіх на раунд; змінюється автоматично кожного раунду за порядком зростання чисел. 
Гра Б № адресата на раунд для кожного інший (генерує компютер), але кожен буде в ролі адресата протягом гри.
Гра В № ад-та  на раунд  для кожного учасника однієї команди -  з числа чл команди-суперника. (і, одночасно,-навпаки). (для №рів 1-5 комп генерує з №рів 6-10. І, одночас, для №6-10 - з №1-5). протягом гри кожен буде в ролі адресата.
Поле 2, на яке учасник автоматично входить після надсилання вислову; його компоненти: 
вікно перегляду висловів; (перемішані, можна гортати, приховано № автора (А), або + прихов № адресата (Б і В);
цифрова клавіатура;  кількість активних цифр на клавіатурі=кількості учасників; автоматично блокуються певні №; 
гра А – одна клавіатура + 2 кнопки додаткових балів: від адресата (за вдалий вислів), від учасників (за цікаве реагування адресата).
гра Б і В - дві цифрові клавіатури; кнопки додаткових балів та вподобайок відсутні. Якщо вгадано адресат на клавіатурі 1 (підсвічується), вгадуємо автора на клавіатурі 2.
кнопка збереження (після обрання №,  коли вислів навпроти клавіатури)
кнопка надсилання (після опрацювання всіх висловів); виправити вибір вже неможливо.
Таблиця результатів гри по учасниках (командах) – бали по кожному раунду та кінцевий результат. 
Дії учасника на пристрої:
1.Отримує доступ до гри (вікна входу)
2.Самостійно входить на своє поле, згідно номера, який присвоєно попередньо.
3.Створює вислів щодо адресата, № якого - у вікні поля 1 та надсилає для загального перегляду (поле 2)
4.А: адресат коментує (усно) висловлювання щодо себе, дає, за бажанням, бал автору за влучний вислів і може отриматии бал за вдале реагування від учасників:    вгадує авторів висловів.
Б і В: учасник приймає участь у спільному обговоренні, вибираючи вислів, котрий стосується саме його; вгадавши (висвітлиться), переходить до вгадування автора (лише даного висловлювання).
5. Переходить до таблиці результатів, яка фіксує та сумує набрані бали.
Дії ведучого на пристрої:
1.Надає доступ до гри
2.Забезпечує, щоб активована кількість папок для входу, активних кнопок на клавіатурі вибору та кількість рядків у таблиці результатів відповідала кількості учасників (це має відбутися одночасно-паралельно)
3. Заохочує коментування та спільний пошук, активує перехід до наступних раундів 
Базове в технічному плані:
-Вислови, до яких «прив»язані» 1 (гра А) або 2 (Б і В) номери
-Клавіатура, на якій «законтачуємо» №ри (вибраний нами та прихований), при вгадуванні № підсвічується
