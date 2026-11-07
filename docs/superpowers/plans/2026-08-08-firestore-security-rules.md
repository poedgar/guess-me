# Firestore Security Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production Firestore database's wide-open test-mode rules (open to everyone, unauthenticated, until 2094) with real least-privilege access control, verified against a local emulator before deploy.

**Architecture:** Add a `participantIds: string[]` shadow field (rules can't search inside the existing array-of-objects `participants` field), write a `firestore.rules` file enforcing participant/admin-scoped read/write access with a `waiting`-status carve-out for the join flow and stranger reads, and verify all of it with a `@firebase/rules-unit-testing` suite run against the local Firestore emulator.

**Tech Stack:** Firebase Firestore Security Rules (`rules_version = '2'`), `@firebase/rules-unit-testing`, `firebase-tools` (local emulator only — no cloud credentials needed for this plan), Node's built-in `node:test` runner.

## Global Constraints

- Full context: `docs/superpowers/specs/2026-08-08-firestore-security-rules-design.md` — read it if anything below is ambiguous.
- `Game` is defined independently in THREE places that must all change together: `packages/shared/src/types.ts`, `apps/web/src/contexts/GameContext.tsx`, `apps/expo/contexts/GameContext.tsx`. These are NOT the same interface re-exported — they are structurally-synced copies (a project-wide pattern this codebase already has; see any prior plan's notes on it). All three need `participantIds?: string[]`.
- `participantIds` is a **plain array of UID strings**, written alongside every existing write to `participants` (never replacing it) — three call sites per app: `createGame` (seed `[adminId]`), `joinGame` (`arrayUnion` the joining uid), `leaveGame` (filter out the leaving uid, inside the existing transaction).
- Deploying to production Firestore requires the Firebase CLI authenticated as the project owner — this plan does NOT deploy. The final step hands over the exact `firebase deploy --only firestore:rules` command for the human to run themselves.
- The emulator requires a JVM. If `java -version` fails when Task 2 or Task 3 needs to run it, STOP and report back — do not attempt to install one (this requires interactive `sudo`, already handled once by the human partner outside this plan; if it's still missing, ask rather than working around it).
- Do not deploy anything, do not run `firebase login`, do not touch the live Firebase project in any way. Everything in this plan runs against the local emulator only.

---

### Task 1: `participantIds` field + `setGameType` admin guard

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Modify: `apps/expo/contexts/GameContext.tsx`

**Interfaces:**
- Produces: `Game.participantIds?: string[]` on all three `Game` interfaces — later tasks' rules and tests depend on this exact field name and shape (plain string array, not objects).

- [ ] **Step 1: Add `participantIds` to `packages/shared/src/types.ts`**

Find (in the `Game` interface):

```typescript
  participants: Participant[];
  createdAt: Date | Timestamp;
```

Replace with:

```typescript
  participants: Participant[];
  // Plain UIDs mirroring participants, kept in sync at create/join/leave.
  // Exists so Firestore rules can check membership — rules can't search
  // inside an array of objects for a matching field, only exact-value
  // membership over primitive arrays.
  participantIds?: string[];
  createdAt: Date | Timestamp;
```

- [ ] **Step 2: Add `participantIds` to `apps/web/src/contexts/GameContext.tsx`'s local `Game` interface**

Find:

```typescript
  participants: Participant[];
  createdAt: Date | Timestamp;
```

Replace with:

```typescript
  participants: Participant[];
  // Plain UIDs mirroring participants, kept in sync at create/join/leave.
  // Exists so Firestore rules can check membership — rules can't search
  // inside an array of objects for a matching field, only exact-value
  // membership over primitive arrays.
  participantIds?: string[];
  createdAt: Date | Timestamp;
```

- [ ] **Step 3: Add `participantIds` to `apps/expo/contexts/GameContext.tsx`'s local `Game` interface**

Same find/replace as Step 2, applied to `apps/expo/contexts/GameContext.tsx`.

- [ ] **Step 4: Seed `participantIds` in `apps/web/src/contexts/GameContext.tsx`'s `createGame`**

Find:

```typescript
        participants: [
          {
            userId: user.uid,
            userName: user.displayName || "Unknown",
            userEmail: user.email || "",
            photoURL: user.photoURL ?? null,
            joinedAt: now,
          },
        ],
        createdAt: serverTimestamp(),
```

Replace with:

```typescript
        participants: [
          {
            userId: user.uid,
            userName: user.displayName || "Unknown",
            userEmail: user.email || "",
            photoURL: user.photoURL ?? null,
            joinedAt: now,
          },
        ],
        participantIds: [user.uid],
        createdAt: serverTimestamp(),
```

- [ ] **Step 5: Same seeding change in `apps/expo/contexts/GameContext.tsx`'s `createGame`**

Identical find/replace as Step 4, applied to `apps/expo/contexts/GameContext.tsx`.

- [ ] **Step 6: Write `participantIds` alongside `participants` in `apps/web/src/contexts/GameContext.tsx`'s `joinGame`**

Find:

```typescript
      await updateDoc(gameRef, {
        participants: arrayUnion(newParticipant),
      });
```

Replace with:

```typescript
      await updateDoc(gameRef, {
        participants: arrayUnion(newParticipant),
        participantIds: arrayUnion(user.uid),
      });
```

- [ ] **Step 7: Same change in `apps/expo/contexts/GameContext.tsx`'s `joinGame`**

Identical find/replace as Step 6, applied to `apps/expo/contexts/GameContext.tsx`.

- [ ] **Step 8: Filter `participantIds` alongside `participants` in `apps/web/src/contexts/GameContext.tsx`'s `leaveGame`**

Find:

```typescript
        const gameData = gameSnap.data() as Game;
        const leavingUid = auth.currentUser!.uid;
        const updatedParticipants = (gameData.participants || []).filter(
          (p) => p.userId !== leavingUid,
        );

        // If leaving user was the admin, mark the game as finished and flag adminLeft
        if (gameData.adminId === leavingUid) {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            status: "finished",
            currentRound: null,
            adminLeft: true,
            adminNextTargetPreference: null,
            playersWhoCompletedPostCommentPhase: [],
          });
        } else {
          transaction.update(gameRef, {
            participants: updatedParticipants,
          });
        }
```

Replace with:

```typescript
        const gameData = gameSnap.data() as Game;
        const leavingUid = auth.currentUser!.uid;
        const updatedParticipants = (gameData.participants || []).filter(
          (p) => p.userId !== leavingUid,
        );
        const updatedParticipantIds = (gameData.participantIds || []).filter(
          (id) => id !== leavingUid,
        );

        // If leaving user was the admin, mark the game as finished and flag adminLeft
        if (gameData.adminId === leavingUid) {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
            status: "finished",
            currentRound: null,
            adminLeft: true,
            adminNextTargetPreference: null,
            playersWhoCompletedPostCommentPhase: [],
          });
        } else {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
          });
        }
```

- [ ] **Step 9: Same change in `apps/expo/contexts/GameContext.tsx`'s `leaveGame`**

Find (note: expo uses `user.uid` directly, not an `auth.currentUser!.uid`/`leavingUid` local — this file's own established variable naming, not a typo):

```typescript
        const gameData = gameSnap.data() as Game;
        const updatedParticipants = (gameData.participants || []).filter(
          (p) => p.userId !== user.uid,
        );

        // If leaving user was the admin, mark the game as finished and flag adminLeft
        if (gameData.adminId === user.uid) {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            status: "finished",
            currentRound: null,
            adminLeft: true,
            adminNextTargetPreference: null,
            playersWhoCompletedPostCommentPhase: [],
          });
        } else {
          transaction.update(gameRef, {
            participants: updatedParticipants,
          });
```

Replace with:

```typescript
        const gameData = gameSnap.data() as Game;
        const updatedParticipants = (gameData.participants || []).filter(
          (p) => p.userId !== user.uid,
        );
        const updatedParticipantIds = (gameData.participantIds || []).filter(
          (id) => id !== user.uid,
        );

        // If leaving user was the admin, mark the game as finished and flag adminLeft
        if (gameData.adminId === user.uid) {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
            status: "finished",
            currentRound: null,
            adminLeft: true,
            adminNextTargetPreference: null,
            playersWhoCompletedPostCommentPhase: [],
          });
        } else {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
          });
```

- [ ] **Step 10: Add the missing admin guard to `setGameType` in `apps/web/src/contexts/GameContext.tsx`**

Find:

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash' | 'ideas'): Promise<void> => {
    if (!currentGame) return;
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

Replace with:

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash' | 'ideas'): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

This matches the existing guard pattern used by every other admin-only setting setter in this same file (e.g. `updateAdminWritesComments`).

- [ ] **Step 11: Same guard in `apps/expo/contexts/GameContext.tsx`'s `setGameType`**

Find:

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash'): Promise<void> => {
    if (!currentGame) return;
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

Replace with:

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash'): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

- [ ] **Step 12: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json` and `npx tsc --noEmit -p packages/shared/tsconfig.json`

Expected: exactly the 3 known pre-existing baseline errors (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx` around line 487, `packages/shared/src/i18n.ts:2`), no new ones. `apps/expo` has its own long-standing pre-existing `tsc` error count (92 as of the last time it was checked this session, unrelated to this change) — confirm this change doesn't add to it, but don't chase pre-existing expo errors unrelated to this diff.

- [ ] **Step 13: Commit**

```bash
git add packages/shared/src/types.ts apps/web/src/contexts/GameContext.tsx apps/expo/contexts/GameContext.tsx
git commit -m "Add participantIds field and setGameType admin guard

Prep for Firestore security rules: participantIds is a plain UID array
kept in sync with participants, since rules can't search inside an
array of objects. setGameType was the only game-mutation function with
no client-side admin check; the rules will enforce it either way, but
this closes the same inconsistency every other setting setter avoids."
```

---

### Task 2: `firestore.rules` + `firebase.json` wiring

**Files:**
- Create: `firestore.rules`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: `Game.participantIds`, `Game.adminId`, `Game.status` (from Task 1) — the rules read these exact field names.
- Produces: the deployed rule set later tasks' tests validate against; `firebase.json`'s `emulators.firestore.port` (`8080`), which Task 3's test suite connects to.

- [ ] **Step 1: Write `firestore.rules`**

Create `firestore.rules` at the repo root:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin(game) {
      return isSignedIn() && game.adminId == request.auth.uid;
    }

    function isParticipant(game) {
      return isSignedIn()
        && 'participantIds' in game
        && game.participantIds.hasAny([request.auth.uid]);
    }

    match /password/{docId} {
      allow get: if isSignedIn();
      allow list, create, update, delete: if false;
    }

    match /games/{gameId} {
      allow get: if isAdmin(resource.data)
        || isParticipant(resource.data)
        || (isSignedIn() && resource.data.status == "waiting");

      allow list: if false;

      allow create: if isSignedIn()
        && request.resource.data.adminId == request.auth.uid
        && request.resource.data.participantIds == [request.auth.uid];

      allow update: if isAdmin(resource.data)
        || isParticipant(resource.data)
        || (isSignedIn() && resource.data.status == "waiting");

      allow delete: if isAdmin(resource.data);
    }
  }
}
```

- [ ] **Step 2: Wire `firestore.rules` and the emulator port into `firebase.json`**

Find:

```json
{
  "hosting": {
    "public": "apps/web/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Replace with:

```json
{
  "hosting": {
    "public": "apps/web/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    }
  }
}
```

- [ ] **Step 3: Install `firebase-tools` as a root dev dependency**

Run: `npm install --save-dev --workspace=. firebase-tools`

(This installs at the monorepo root, not inside any app workspace — `firebase-tools` provides the `firebase` CLI binary used to run the local emulator; no login/auth needed for local emulator use.)

- [ ] **Step 4: Confirm `java` is available**

Run: `java -version`

Expected: prints a version (any recent JDK — this environment has none installed by default; a human partner needs to run `brew install --cask temurin` first, since it requires an interactive `sudo` password this plan's execution can't provide). If this fails, STOP this task and report back rather than attempting a workaround.

- [ ] **Step 5: Smoke-test that the rules compile (no syntax errors)**

Run: `npx firebase emulators:exec --only firestore --project firestore-rules-test "echo ok"`

Expected: the emulator starts, prints something like `✔  firestore: Firestore Emulator UI websocket is running` / similar startup success lines (no `Error compiling rules` or similar failure), runs `echo ok`, then shuts the emulator down cleanly. If rules fail to compile, the emulator will print a specific line-numbered syntax error — fix `firestore.rules` and re-run.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firebase.json package.json package-lock.json
git commit -m "Add Firestore security rules and wire up the local emulator

Replaces the implicit test-mode-open-until-2094 rules (never
version-controlled, only visible in the Firebase Console) with real
least-privilege access control: participant/admin-scoped reads and
writes, a waiting-status carve-out for the join flow and for
low-stakes pre-game reads, and default-deny everything else. Not yet
deployed — see the plan's final task for the deploy step."
```

---

### Task 3: Rules-unit-test suite

**Files:**
- Create: `firestore-tests/rules.test.mjs`
- Modify: `package.json` (root)

**Interfaces:**
- Consumes: `firestore.rules` (Task 2), the local emulator on port 8080 (Task 2's `firebase.json` config).

- [ ] **Step 1: Install `@firebase/rules-unit-testing`**

Run: `npm install --save-dev --workspace=. @firebase/rules-unit-testing`

(`firebase` itself, used for the client-SDK calls the tests make against the emulator, is already present in the root `node_modules` via `apps/web`'s dependency — workspace hoisting makes it resolvable from a root-level script. If `import { doc } from 'firebase/firestore'` fails to resolve when Step 3 runs, add `firebase` as an explicit root dev dependency too: `npm install --save-dev --workspace=. firebase`.)

- [ ] **Step 2: Write `firestore-tests/rules.test.mjs`**

Create `firestore-tests/rules.test.mjs`:

```javascript
import { before, beforeEach, after, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_UID = 'admin-uid';
const PARTICIPANT_UID = 'participant-uid';
const STRANGER_UID = 'stranger-uid';
const PASSWORD_DOC_ID = 'YR20RZ67FKy88HQVF6yW';

let testEnv;

function baseGame(overrides = {}) {
  return {
    adminId: ADMIN_UID,
    adminName: 'Admin',
    adminEmail: 'admin@example.com',
    participants: [
      { userId: ADMIN_UID, userName: 'Admin', userEmail: 'admin@example.com', joinedAt: new Date().toISOString() },
    ],
    participantIds: [ADMIN_UID],
    status: 'waiting',
    ...overrides,
  };
}

async function seed(id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'games', id), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'firestore-rules-test',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

test('a stranger cannot read an active game', async () => {
  await seed('game1', baseGame({ status: 'active', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(getDoc(doc(strangerDb, 'games', 'game1')));
});

test('a stranger CAN read a waiting game', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertSucceeds(getDoc(doc(strangerDb, 'games', 'game1')));
});

test('a participant can read their own game at any status', async () => {
  await seed('game1', baseGame({ status: 'finished', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const participantDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertSucceeds(getDoc(doc(participantDb, 'games', 'game1')));
});

test('an unauthenticated user cannot read anything', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonDb, 'games', 'game1')));
});

test('a signed-in stranger can update (join) a waiting game', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertSucceeds(updateDoc(doc(strangerDb, 'games', 'game1'), {
    participantIds: [ADMIN_UID, STRANGER_UID],
  }));
});

test('a signed-in stranger cannot update an active game they are not part of', async () => {
  await seed('game1', baseGame({ status: 'active', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(updateDoc(doc(strangerDb, 'games', 'game1'), { status: 'finished' }));
});

test('create succeeds when adminId and participantIds match the caller', async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'games', 'game1'), baseGame()));
});

test('create fails if adminId does not match the caller', async () => {
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(setDoc(doc(strangerDb, 'games', 'game1'), baseGame({ adminId: ADMIN_UID })));
});

test('create fails if participantIds does not match [caller]', async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(setDoc(doc(adminDb, 'games', 'game1'), baseGame({ participantIds: [ADMIN_UID, 'someone-else'] })));
});

test('a non-admin cannot delete a game', async () => {
  await seed('game1', baseGame({ status: 'finished', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const participantDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertFails(deleteDoc(doc(participantDb, 'games', 'game1')));
});

test('the admin can delete their own game', async () => {
  await seed('game1', baseGame({ status: 'finished' }));
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(deleteDoc(doc(adminDb, 'games', 'game1')));
});

test('an old-style game missing participantIds is still readable/writable by its admin', async () => {
  await seed('game1', {
    adminId: ADMIN_UID,
    adminName: 'Admin',
    adminEmail: 'admin@example.com',
    participants: [],
    status: 'active',
  });
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'games', 'game1')));
  await assertSucceeds(updateDoc(doc(adminDb, 'games', 'game1'), { status: 'finished' }));
});

test('an old-style game missing participantIds is NOT accessible to a non-admin participant', async () => {
  await seed('game1', {
    adminId: ADMIN_UID,
    adminName: 'Admin',
    adminEmail: 'admin@example.com',
    participants: [{ userId: PARTICIPANT_UID, userName: 'P', userEmail: 'p@example.com', joinedAt: new Date().toISOString() }],
    status: 'active',
  });
  const participantDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertFails(getDoc(doc(participantDb, 'games', 'game1')));
});

test('password doc is readable when signed in', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'password', PASSWORD_DOC_ID), { password: 'secret123' });
  });
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertSucceeds(getDoc(doc(strangerDb, 'password', PASSWORD_DOC_ID)));
});

test('password doc is not readable when signed out', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'password', PASSWORD_DOC_ID), { password: 'secret123' });
  });
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonDb, 'password', PASSWORD_DOC_ID)));
});

test('password doc is never writable by any client', async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(setDoc(doc(adminDb, 'password', PASSWORD_DOC_ID), { password: 'hacked' }));
});
```

- [ ] **Step 3: Add the `test:rules` script to root `package.json`**

Find:

```json
  "scripts": {
    "expo": "npm -w apps/expo run start",
    "web": "npm -w apps/web run dev",
    "build": "cd apps/web && npm run build",
    "build:web": "npm -w apps/web run build",
    "deploy:web": "vercel --prod"
  }
```

Replace with:

```json
  "scripts": {
    "expo": "npm -w apps/expo run start",
    "web": "npm -w apps/web run dev",
    "build": "cd apps/web && npm run build",
    "build:web": "npm -w apps/web run build",
    "deploy:web": "vercel --prod",
    "test:rules": "firebase emulators:exec --only firestore --project firestore-rules-test \"node --test firestore-tests/rules.test.mjs\""
  }
```

- [ ] **Step 4: Run the suite for real**

Run: `npm run test:rules`

Expected: the emulator starts, all 16 tests in `firestore-tests/rules.test.mjs` pass (`node:test`'s default output reports pass/fail counts), the emulator shuts down. If any test fails, the failure output names the specific `assertSucceeds`/`assertFails` call and Firestore's actual permission-denied (or unexpected-success) detail — fix `firestore.rules` (not the test, unless the test itself has a bug) and re-run until all 16 pass.

- [ ] **Step 5: Commit**

```bash
git add firestore-tests/rules.test.mjs package.json package-lock.json
git commit -m "Add Firestore rules-unit-test suite, run against the local emulator

16 tests covering read/create/update/delete access for strangers,
participants, and admins, the waiting-status join carve-out, the
password doc's read-only-when-signed-in access, and backward
compatibility for pre-existing game documents that lack the new
participantIds field. All passing against the local emulator — this
is the verification gate before anyone runs the actual production
deploy."
```

---

### Final step (not a task — handed to the human partner)

Once Task 3's suite passes, the rules are verified but **not deployed**. Deploying requires the Firebase CLI authenticated as the project owner, which this plan's execution environment does not have. The exact command to run, once ready:

```bash
npx firebase deploy --only firestore:rules --project spygame-2fce3
```

This should be run by a human with access to the `spygame-2fce3` Firebase project, after logging in via `npx firebase login` if not already authenticated. Confirm with the human partner before this step — it's the one action in this whole plan that touches the live, currently-wide-open production database.
