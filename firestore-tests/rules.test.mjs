import { before, beforeEach, after, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
      port: 8098,
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

test('a signed-in user can get a game doc that does not exist', async () => {
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  const snap = await assertSucceeds(getDoc(doc(strangerDb, 'games', 'does-not-exist')));
  // no assertion needed on snap.exists() — the point is the read itself succeeds
  // (a permission-denied error is what this test guards against), not what it returns
});

test('a signed-in stranger can update (join) a waiting game', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertSucceeds(updateDoc(doc(strangerDb, 'games', 'game1'), {
    participantIds: [ADMIN_UID, STRANGER_UID],
  }));
});

test('a signed-in stranger cannot steal admin while updating a waiting game', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(updateDoc(doc(strangerDb, 'games', 'game1'), {
    participantIds: [ADMIN_UID, STRANGER_UID],
    adminId: STRANGER_UID,
  }));
});

test('a participant cannot steal admin even via the isParticipant branch', async () => {
  await seed('game1', baseGame({ status: 'waiting', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const participantDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertFails(updateDoc(doc(participantDb, 'games', 'game1'), { adminId: PARTICIPANT_UID }));
});

test('a signed-in stranger cannot change status while updating a waiting game', async () => {
  await seed('game1', baseGame({ status: 'waiting' }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(updateDoc(doc(strangerDb, 'games', 'game1'), {
    participantIds: [ADMIN_UID, STRANGER_UID],
    status: 'active',
  }));
});

test('a signed-in stranger cannot update an active game they are not part of', async () => {
  await seed('game1', baseGame({ status: 'active', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(updateDoc(doc(strangerDb, 'games', 'game1'), { status: 'finished' }));
});

test('a participant can update an active game', async () => {
  await seed('game1', baseGame({ status: 'active', participantIds: [ADMIN_UID, PARTICIPANT_UID] }));
  const participantDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertSucceeds(updateDoc(doc(participantDb, 'games', 'game1'), { status: 'active' }));
});

test('create succeeds when adminId and participantIds match the caller', async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'games', 'game1'), baseGame()));
});

test('create fails if adminId does not match the caller', async () => {
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertFails(setDoc(doc(strangerDb, 'games', 'game1'), baseGame({ adminId: ADMIN_UID, participantIds: [STRANGER_UID] })));
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

test('list is always denied, even for the admin', async () => {
  await seed('game1', baseGame());
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(getDocs(collection(adminDb, 'games')));
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

test('a legacy waiting game missing participantIds is still joinable by a stranger', async () => {
  await seed('game1', {
    adminId: ADMIN_UID,
    adminName: 'Admin',
    adminEmail: 'admin@example.com',
    participants: [],
    status: 'waiting',
  });
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
  await assertSucceeds(getDoc(doc(strangerDb, 'games', 'game1')));
  await assertSucceeds(updateDoc(doc(strangerDb, 'games', 'game1'), {
    participantIds: [STRANGER_UID],
  }));
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

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'password', PASSWORD_DOC_ID), { password: 'secret123' });
  });
  await assertFails(updateDoc(doc(adminDb, 'password', PASSWORD_DOC_ID), { password: 'hacked' }));
  await assertFails(deleteDoc(doc(adminDb, 'password', PASSWORD_DOC_ID)));
});
