# Admin Game Cleanup Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hidden, password-gated `/admin/cleanup` page in `apps/web` that lists games with fewer than a configurable number of participants, shows enough detail per game to distinguish real games from test artifacts, and deletes only the games the project owner explicitly checks and confirms.

**Architecture:** Three new `GameContext` methods (`listAllGames`, `deleteGames`, `checkAdminPassword`) — the first genuinely cross-user Firestore access in this codebase, gated entirely by the page itself (password prompt + unlinked route), not by any new security rule. A new page component owns its own sign-in gate (reusing the existing `AuthScreen`), password gate, scan/filter, and checkbox-selection UI, wired into `App.tsx`'s router.

**Tech Stack:** React, Firebase Firestore client SDK, TypeScript (strict). No new dependency.

## Global Constraints

- Scope is `apps/web` only. Do not touch `apps/expo` — this is a project-owner maintenance tool, not a player-facing feature.
- All Firestore access goes through `GameContext` methods, per this project's existing convention (`CLAUDE.md`: "Do not call Firestore from components. Use `GameContext` methods.") — the new page component must not import `db`/`doc`/`getDoc`/etc. from `firebase/firestore` directly.
- `checkAdminPassword` duplicates a few lines of the password-lookup logic already inline in `enterGame` — this is intentional. Do **not** refactor `enterGame` to share code with it; that touches an already-working, unrelated flow for no benefit this plan needs.
- The admin password value itself (`YR20RZ67FKy88HQVF6yW3`, doc ID `YR20RZ67FKy88HQVF6yW`, field `password`) must never be hardcoded in the new page component — it's looked up from Firestore via `checkAdminPassword`, exactly like every other place in the app that checks it.
- `deleteGames` deletes only the top-level `games/{gameId}` document per ID given — do not add any subcollection-deletion logic; none exists for this app's data model (comments/guesses/rounds all live as nested arrays inside the game document itself).
- The route must not be linked from `NavBar` or any other in-app navigation — reachable only by typing `/admin/cleanup` directly.
- `apps/web` has no test runner (established in prior work) — verify via `tsc --noEmit` and manual browser walkthrough.

---

## Task 1: GameContext additions

**Files:**
- Modify: `apps/web/src/contexts/GameContext.tsx`

**Interfaces:**
- Produces: `listAllGames(): Promise<Game[]>`, `deleteGames(gameIds: string[]): Promise<void>`, `checkAdminPassword(input: string): Promise<boolean>` — all three added to `GameContextType` and the `useGame()` return value. Task 2 consumes all three by these exact names.

- [ ] **Step 1: Add `collection`, `getDocs`, and `deleteDoc` to the `firebase/firestore` import**

The import currently reads:

```typescript
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Transaction,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
```

Change it to:

```typescript
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Transaction,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
```

- [ ] **Step 2: Add the three new methods to `GameContextType`**

The interface currently ends:

```typescript
  startPostGuessingPointPhase: () => Promise<void>;
  awardPointsToPlayers: (
    awards: { recipientId: string; points: number }[],
  ) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
}
```

Change it to:

```typescript
  startPostGuessingPointPhase: () => Promise<void>;
  awardPointsToPlayers: (
    awards: { recipientId: string; points: number }[],
  ) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
  /**
   * Fetches every document in the `games` collection, unscoped to the
   * signed-in user — the only place in this app that reads across all
   * users' data. Used solely by the hidden /admin/cleanup page.
   */
  listAllGames: () => Promise<Game[]>;
  /** Deletes each listed game document outright. No subcollections exist
   * for this app's data model (comments/guesses/rounds are nested arrays
   * inside the game document itself), so nothing else needs cleaning up. */
  deleteGames: (gameIds: string[]) => Promise<void>;
  /** Checks a candidate string against the real admin password stored in
   * Firestore, the same doc/field enterGame() already reads. Returns
   * true/false rather than throwing, so callers can show an inline error
   * instead of a thrown-exception flow. */
  checkAdminPassword: (input: string) => Promise<boolean>;
}
```

- [ ] **Step 3: Implement the three functions**

Find the end of `advanceClashGuessing` (the function immediately before the `const value: GameContextType = useMemo(` block) and add the three new functions right after it, before the `useMemo` call:

```typescript
  const listAllGames = async (): Promise<Game[]> => {
    const snapshot = await getDocs(collection(db, "games"));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Game);
  };

  const deleteGames = async (gameIds: string[]): Promise<void> => {
    await Promise.all(gameIds.map((id) => deleteDoc(doc(db, "games", id))));
  };

  const checkAdminPassword = async (input: string): Promise<boolean> => {
    const passwordRef = doc(db, "password", "YR20RZ67FKy88HQVF6yW");
    const pwDoc = await getDoc(passwordRef);
    const realPassword = pwDoc.exists()
      ? (pwDoc.data() as { password?: string }).password
      : null;
    return !!realPassword && input === realPassword;
  };
```

- [ ] **Step 4: Add the three functions to the `value` object**

The `useMemo` object currently ends:

```typescript
      setNextRoundTarget,
      skipNextRoundTarget,
      resetTargetControls,
    }),
    [currentGame, loading, user],
  ); // eslint-disable-line react-hooks/exhaustive-deps
```

Change it to:

```typescript
      setNextRoundTarget,
      skipNextRoundTarget,
      resetTargetControls,
      listAllGames,
      deleteGames,
      checkAdminPassword,
    }),
    [currentGame, loading, user],
  ); // eslint-disable-line react-hooks/exhaustive-deps
```

(The dependency array doesn't need `listAllGames`/`deleteGames`/`checkAdminPassword` added — none of the three closes over `currentGame`, `loading`, or `user`, so they behave the same as every other function in this object that isn't itself in the deps array.)

- [ ] **Step 5: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors beyond the 3 pre-existing baseline errors (`PostCommentPointsPanel.tsx:69`, `GameContext.tsx:433`, `packages/shared/src/i18n.ts:2`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/contexts/GameContext.tsx
git commit -m "$(cat <<'EOF'
Add listAllGames/deleteGames/checkAdminPassword to GameContext

The first genuinely cross-user Firestore access in this app —
listAllGames() is unscoped to the signed-in user. Backing methods
for the upcoming hidden /admin/cleanup page; no UI wiring yet.
EOF
)"
```

---

## Task 2: Admin cleanup page

**Files:**
- Create: `apps/web/src/pages/AdminCleanupPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `listAllGames`, `deleteGames`, `checkAdminPassword` (Task 1), `useAuth().isSignedIn` (existing), `AuthScreen` (existing component, reused as-is), `useAlert` (existing hook, reused as-is).

- [ ] **Step 1: `apps/web/src/pages/AdminCleanupPage.tsx`**

```tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame, Game } from '../contexts/GameContext';
import { useAlert } from '../hooks/useAlert';
import { AuthScreen } from '../components/auth/AuthScreen';

function toDisplayDate(value: unknown): string {
  if (!value) return '—';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  return '—';
}

export function AdminCleanupPage() {
  const { isSignedIn } = useAuth();
  const { listAllGames, deleteGames, checkAdminPassword } = useGame();
  const { showAlert, AlertModal } = useAlert();

  const [passwordInput, setPasswordInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(4);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<Game[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  if (!isSignedIn) {
    return <AuthScreen />;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingPassword(true);
    setGateError(null);
    try {
      const ok = await checkAdminPassword(passwordInput);
      if (ok) {
        setUnlocked(true);
      } else {
        setGateError('Incorrect password.');
      }
    } catch (err) {
      setGateError(
        (err instanceof Error && err.message) || 'Could not verify password.',
      );
    } finally {
      setCheckingPassword(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            Admin Cleanup
          </h1>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {gateError && (
              <p className="text-sm text-game-danger text-center">{gateError}</p>
            )}
            <button
              type="submit"
              disabled={checkingPassword || !passwordInput.trim()}
              className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {checkingPassword ? 'Checking...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setSelectedIds(new Set());
    try {
      const allGames = await listAllGames();
      const filtered = allGames
        .filter((g) => (g.participants?.length ?? 0) < threshold)
        .sort((a, b) => {
          const aTime =
            a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : (a.createdAt as { toDate: () => Date })?.toDate?.().getTime() ?? 0;
          const bTime =
            b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : (b.createdAt as { toDate: () => Date })?.toDate?.().getTime() ?? 0;
          return bTime - aTime;
        });
      setCandidates(filtered);
    } catch (err) {
      setScanError(
        (err instanceof Error && err.message) || 'Could not scan games.',
      );
      setCandidates(null);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelected = (gameId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    showAlert(
      'Confirm deletion',
      `Delete ${idsToDelete.length} game(s)? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'secondary' },
        {
          text: 'Delete',
          style: 'danger',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGames(idsToDelete);
              setCandidates(
                (prev) => prev?.filter((g) => !selectedIds.has(g.id)) ?? null,
              );
              setSelectedIds(new Set());
            } catch (err) {
              setScanError(
                (err instanceof Error && err.message) || 'Could not delete games.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Cleanup
        </h1>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Fewer than this many participants
            </label>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 1)}
              className="w-24 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="bg-game-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {scanError && (
          <p className="text-sm text-game-danger">{scanError}</p>
        )}

        {candidates && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {candidates.length} game(s) found
              </p>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting || selectedIds.size === 0}
                className="bg-game-danger text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting
                  ? 'Deleting...'
                  : `Delete selected (${selectedIds.size})`}
              </button>
            </div>

            <div className="space-y-3">
              {candidates.map((game) => (
                <div
                  key={game.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(game.id)}
                    onChange={() => toggleSelected(game.id)}
                    className="w-5 h-5 mt-1 accent-game-danger flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-mono font-bold text-gray-900 dark:text-white">
                      {game.id}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Created: {toDisplayDate(game.createdAt)} · Type:{' '}
                      {game.gameType ?? 'mirror'} · Status: {game.status} ·
                      Rounds: {game.rounds?.length ?? 0}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      Admin: {game.adminName} ({game.adminEmail})
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      Participants ({game.participants?.length ?? 0}):{' '}
                      {game.participants
                        ?.map((p) => `${p.userName} (${p.userEmail})`)
                        .join(', ') || 'none'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire the route into `App.tsx`**

The imports currently read:

```tsx
import { HomePage } from './pages/HomePage';
import { GameJoinPage } from './pages/GameJoinPage';
import { ResultsPage } from './pages/ResultsPage';
import { RulesPage } from './pages/RulesPage';
```

Change to:

```tsx
import { HomePage } from './pages/HomePage';
import { GameJoinPage } from './pages/GameJoinPage';
import { ResultsPage } from './pages/ResultsPage';
import { RulesPage } from './pages/RulesPage';
import { AdminCleanupPage } from './pages/AdminCleanupPage';
```

The `<Routes>` block currently reads:

```tsx
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/game/:gameId" element={<GameJoinPage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
```

Change to:

```tsx
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/game/:gameId" element={<GameJoinPage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/admin/cleanup" element={<AdminCleanupPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
```

Do not add a `NavLink` for this route anywhere in `NavBar` — it must stay unlinked, reachable only by typing the URL.

- [ ] **Step 3: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors beyond the 3 pre-existing baseline errors.

Then manually verify in a browser: run `npm run dev` from `apps/web/`, sign in, navigate directly to `/admin/cleanup`. Confirm: the password gate appears, a wrong password shows an inline error and stays locked, the correct password (`YR20RZ67FKy88HQVF6yW3`) unlocks the page. Scan with the default threshold of 4 and confirm the table renders with game ID, admin name/email, participant names/emails, created date, game type, status, and round count for each result, sorted newest-first. Confirm checkboxes start unchecked, "Delete selected" stays disabled until at least one is checked, and clicking it opens a confirmation dialog before anything is actually deleted. Confirm `/admin/cleanup` does not appear anywhere in the bottom nav bar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/AdminCleanupPage.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
Add hidden /admin/cleanup page for deleting test games

Password-gated (same admin password as game creation), not linked
from any nav. Scans all games via the new listAllGames(), filters
to those with fewer than a configurable number of participants,
shows full detail per game, and only deletes the ones explicitly
checked and confirmed via the existing alert-confirm pattern.
EOF
)"
```
