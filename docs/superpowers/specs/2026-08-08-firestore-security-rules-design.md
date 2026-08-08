# Firestore Security Rules

**Date:** 2026-08-08
**Scope:** `firestore.rules` (new), `firebase.json` (wire in the rules file), `packages/shared/src/types.ts` and both apps' local `Game` interfaces (add `participantIds`), both apps' `GameContext.tsx` (write `participantIds` alongside `participants`; add the missing admin guard to `setGameType`), and a new rules-unit-test suite run against the local Firestore emulator.

## Problem

The Firebase project (`spygame-2fce3`) currently has zero real Firestore access control. The deployed rules are the default "test mode" boilerplate, with its expiry manually pushed out to the year 2094:

```
match /{document=**} {
  allow read, write: if request.time < timestamp.date(2094, 6, 9);
}
```

This allows any client — signed in or not, participant or not — to read, write, or delete every document in the database, indefinitely. Concretely, right now: any visitor can read every game ever played (all comments, scores, incognito ratings), read the `password/{docId}` document directly (defeating the only gate on game creation), and write or delete arbitrary data.

There is no `firestore.rules` file anywhere in the repo — rules are not source-controlled at all, and `firebase.json` has no `firestore` key.

## Behavior

### Data model change: `participantIds`

`Game.participants` is an array of objects (`{userId, userName, userEmail, photoURL, joinedAt}`). Firestore's rules language has no way to search inside an array of objects for a matching field — only exact-value membership (`hasAny`/`hasAll`/`in`) over primitive arrays. Checking "is this caller a participant" against the existing field is not expressible in rules.

Add a parallel field:

```typescript
participantIds?: string[];  // plain UIDs, kept in sync with participants
```

Written alongside every existing write to `participants`:
- `createGame`: seeded as `[adminId]`.
- `joinGame`: `arrayUnion(uid)` in the same `updateDoc` call that already does `arrayUnion(newParticipant)` on `participants`.
- `leaveGame`: filtered out alongside the existing `participants` filter, inside the same transaction.

Add this to `packages/shared/src/types.ts`'s `Game` interface AND both `apps/web/src/contexts/GameContext.tsx`'s and `apps/expo/contexts/GameContext.tsx`'s local `Game` interfaces (per this codebase's established dual-type-definition pattern — see any prior plan's Global Constraints for the full explanation). No existing read path changes — every component keeps reading `participants` exactly as today; `participantIds` exists solely for rules to check.

**Migration:** existing game documents in production predate this field. The rules fall back to `adminId == request.auth.uid` for admin access (always safe — `adminId` already exists on every doc), but a non-admin participant on an old, fieldless game would lose read/write access to that specific game once the new rules deploy. Accepted as transient, low-impact risk: games are short single-play sessions, not long-lived records; no backfill script.

### `setGameType` client-side guard

`setGameType` (`apps/web/src/contexts/GameContext.tsx:1854`, `apps/expo/contexts/GameContext.tsx:1798`) is the only game-mutation function in either app with no role guard at all — every other admin-only setting setter checks `auth.currentUser.uid === currentGame.adminId` before writing. Add the same check here, matching the existing pattern exactly. The Firestore rule enforces this regardless (see below), so this is a consistency fix, not the actual security boundary — but leaving the one exception in place is confusing for future readers of this file.

### `firestore.rules`

New file at the repo root. `firebase.json` gains:

```json
"firestore": {
  "rules": "firestore.rules"
}
```

alongside the existing `hosting` block.

#### `password/{docId}`

- `allow get: if request.auth != null;` — any signed-in user, needed because `enterGame()` reads this document on every single join/create attempt in both apps (not just during creation), to decide which branch to take.
- `allow list, create, update, delete: if false;` — never listable or writable by any client.

#### `games/{gameId}`

Helper functions:
- `isSignedIn()` → `request.auth != null`
- `isAdmin(game)` → `isSignedIn() && game.adminId == request.auth.uid`
- `isParticipant(game)` → `isSignedIn() && 'participantIds' in game && game.participantIds.hasAny([request.auth.uid])`

**Read:**
```
allow get: if isAdmin(resource.data) || isParticipant(resource.data)
  || (isSignedIn() && resource.data.status == "waiting");
```
Non-participants (the join-flow bootstrap case — checking a game exists / isn't already joined, before the user is added) can read a game only while it's `waiting`, when there's no gameplay content yet (just admin name + participant list). Once a game leaves `waiting`, only actual participants/admin can read it — closing the exposure from guessable game IDs (an adjective+noun pair from ~231×140 ≈ 32,000 combinations).

**Behavior change, called out explicitly:** today's `joinGame` doesn't check game status at all, so a brand-new stranger can technically join a game that's already `active`/`finished`/etc. This rule removes that (a stranger's `getDoc` — the necessary first step of `joinGame` — now fails once the game leaves `waiting`). This does **not** affect the already-shipped reload/rejoin-mid-game flow: an *existing* participant reloading is covered by `isParticipant()` regardless of status. Only "a stranger who was never added joins an in-progress game" changes, which isn't documented anywhere as an intended feature.

No `list` rule is granted on `games` at all (default deny) — every legitimate read in the app is a `get`-by-known-id or an `onSnapshot`-by-known-id; nothing queries the collection except the admin-cleanup tool (see below).

**Create:**
```
allow create: if isSignedIn()
  && request.resource.data.adminId == request.auth.uid
  && request.resource.data.participantIds == [request.auth.uid];
```
Any signed-in user, provided they can't spoof someone else as the admin/creator. The admin password is deliberately NOT enforced here — CLAUDE.md already documents it as "not production-grade access control," a soft speed bump against accidental creation, not a security boundary. Enforcing it in a rule would require a `get()` call against `password/{docId}` inside the create rule (extra read cost, extra complexity) for a guarantee the project has already decided not to rely on.

**Update:**
```
allow update: if isAdmin(resource.data) || isParticipant(resource.data)
  || (isSignedIn() && resource.data.status == "waiting");
```
Coarse-grained: any participant or the admin can update the document. This matches the "participant + role-membership only" scope decision — the rule does not re-validate fine-grained business logic (e.g. "is this comment's claimed writer→subject pairing actually correct per the stored schedule," "is this caller really the round's target," "is this caller really the active clash group leader"). Those checks remain exactly where they are today: enforced by the app's own `GameContext.tsx` logic and, for the one function that already re-validates server-side (`submitIdeaRating`, via `runTransaction`), inside the transaction itself. This rule closes "a random stranger with a guessed game ID can write anything" while accepting the same self-asserted-role trust level the app already has today among actual participants.

**Join carve-out (correction from an earlier draft of this spec):** an initial draft of this rule was `isAdmin || isParticipant` only, checked against the pre-write `resource.data` — which would have broken joining entirely, since a brand-new participant isn't yet in `participantIds` at the exact moment they're adding themselves. The third clause (`status == "waiting"`) mirrors the read rule's own carve-out: any signed-in stranger can update a `waiting` game, not just append themselves — broader than strictly necessary for joining, but consistent with the read rule's already-established reasoning (no real gameplay content exists at that status, so the low-stakes trust boundary already accepted for reads extends naturally to writes there too). A narrower "only allow appending the caller's own uid, touch nothing else" carve-out was considered and rejected as more failure-prone to get exactly right in rules language, for a status where the broader access is already low-risk.

A stricter field-level split (e.g. "only admin can write `status`/`basketData`/`clashData`/`ideaData`/settings fields; only the round target can write `currentRound.comments[].points`") was considered and explicitly deferred — see Out of Scope.

**Delete:**
```
allow delete: if isAdmin(resource.data);
```

#### Admin-cleanup tool (`listAllGames`, `deleteGames`, web-only)

`listAllGames()` does an unfiltered `getDocs(collection(db, "games"))`; `deleteGames()` bulk-deletes arbitrary IDs from that result. Firestore evaluates `list` queries against the query shape itself, not per-returned-document — a per-document participant/admin rule cannot support an unfiltered collection list. Real hardening (e.g. custom claims marking a true admin role, checked via `request.auth.token.admin == true`) is new infrastructure, out of scope for this pass. Since no `list` rule is granted (see Read, above), **this tool will stop working once these rules deploy** — the admin-cleanup page's own UI already gates on the same shared admin password before these calls are reachable, so today's tool has exactly this same trust level, just enforced client-side instead of by Firestore. This is a deliberate, known regression of that one internal tool's functionality; flagged explicitly so it isn't discovered as a surprise. Fixing it (e.g. moving cleanup to an authenticated Cloud Function using the Admin SDK, which bypasses client rules entirely) is a separate follow-up if the tool still gets used.

### Testing & rollout

1. `firestore.rules` + `firebase.json` wiring.
2. `participantIds` field: types + the 3 write sites, both apps.
3. `setGameType` client guard, both apps.
4. A rules-unit-test suite using `@firebase/rules-unit-testing` against the **local Firestore emulator** (no cloud credentials required — runs entirely on-machine), covering at minimum:
   - A stranger cannot `get` an `active`/`finished`/etc. game; can `get` a `waiting` one.
   - A participant can `get`/`update` their own game at any status.
   - A non-admin cannot write admin-gated operations that the rule doesn't specifically carve out for participants (this rule is coarse per the scope decision, so this mostly validates the coarse boundary is where intended, not fine-grained denial).
   - `password/{docId}` is readable signed-in, never writable, never listable.
   - `create` fails if `adminId`/`participantIds` don't match the caller.
   - `delete` fails for non-admins.
   - An old-style document missing `participantIds` is still readable/writable by its `adminId`.
5. Deploying to production requires the Firebase CLI authenticated as you — this session has neither installed nor logged in, so the actual `firebase deploy --only firestore:rules` step is yours to run once the emulator suite passes.

## Out of Scope

- Full basket/clash schedule-pairing re-validation inside rules (writer→subject, group-leader identity) — stays at today's self-asserted trust level among real participants.
- A backfill script for `participantIds` on pre-existing game documents — accepted as transient risk.
- Hardening `listAllGames`/`deleteGames` via custom claims or a Cloud Function — the admin-cleanup tool loses its `list` capability as a known, accepted consequence of this pass; a proper fix is separate follow-up work.
- Enforcing the admin password inside the `create` rule — intentionally left as a soft, client-side-only speed bump, matching CLAUDE.md's existing documented intent.
- Any change to `apps/expo`'s lack of a Group Ideas mode — irrelevant to this pass; the rules apply uniformly to whatever fields exist on a document, whichever app wrote them.
