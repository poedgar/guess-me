# Localization

## Setup

The app uses `i18n-js` v4. Configuration is in `i18n/index.ts`. Locale files live in `locales/`.

**Supported locales:**

| Code | Language | Default |
|---|---|---|
| `uk` | Ukrainian | Yes |
| `en` | English | No |

---

## Using Translations in Components

Always use the `t()` function from `useLanguage()`. Never hardcode user-facing strings.

```typescript
import { useLanguage } from '@/contexts/LanguageContext';

function MyComponent() {
  const { t } = useLanguage();

  return <Text>{t('game.submitComment')}</Text>;
}
```

### Interpolation

```typescript
t('game.roundNumber', { round: 3 })
// locales/en.json: "roundNumber": "Round {{round}}"
// → "Round 3"
```

### Pluralization

```typescript
t('results.points', { count: 5 })
// locales/en.json: "points": { "one": "{{count}} point", "other": "{{count}} points" }
// → "5 points"
```

---

## Translation Key Structure

```json
{
  "common": {
    "ok", "cancel", "yes", "no", "done", "back", "next",
    "save", "delete", "edit", "loading", "error", "success"
  },
  "navigation": {
    "home", "rules", "results", "profile"
  },
  "auth": {
    "signIn", "signOut", "welcome", "signingIn",
    "signedInAs", "confirmSignOut", "signOutConfirmMessage"
  },
  "game": {
    "createGame", "joinGame", "enterGameId", "start",
    "submitComment", "yourComment", "commentsAboutYou",
    "guessAuthor", "submitGuess", "correct", "wrong",
    "roundNumber", "targetIs", "waitingForPlayers",
    "givePoints", "skipPoints", "leaveGame",
    "settings": {
      "adminWritesComments", "showSurnames",
      "targetSelectionMode", "showGuessResults"
    },
    "alerts": { ... }
  },
  "rules": {
    "title", "overview", "howToPlay",
    "gameVariations", "scoring", "targetSelection"
  },
  "results": {
    "noResultsTitle", "leaderboardTitle", "roundHistoryTitle",
    "totalPoints", "guessPoints", "commentPoints"
  }
}
```

---

## Adding a New String

1. Add the key/value to `locales/en.json`.
2. Add the **same key** with the Ukrainian value to `locales/uk.json`.
3. Use `t('your.new.key')` in the component.

Both files must stay in sync. Missing keys fall back to the key name itself (e.g. `"game.missingKey"`).

---

## Switching Language at Runtime

```typescript
const { locale, setLocale } = useLanguage();

// Current locale: 'uk'
setLocale('en');  // Switches to English, persists across app restarts
```

The `LanguageSelector` component (`components/LanguageSelector.tsx`) provides a ready-made UI for this.

---

## Adding a New Language

1. Create `locales/{code}.json` with all keys from `en.json` translated.
2. Import it in `i18n/index.ts` and add it to the translations object:
   ```typescript
   import pl from '@/locales/pl.json';
   i18n.translations = { uk, en, pl };
   ```
3. Add the language option to `LanguageSelector.tsx`.
4. Update this file.

---

## Locale Persistence

The selected locale is saved to `AsyncStorage` under the key `@locale`. On startup, `LanguageContext` reads this value. If not set, defaults to `'uk'`.
