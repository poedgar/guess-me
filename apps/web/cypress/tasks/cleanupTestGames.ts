import admin from 'firebase-admin';
import { getAdminApp } from './adminApp';

/**
 * Deletes every `games` document whose adminId matches the test1 admin
 * account's uid, so production Firestore doesn't accumulate test games
 * run over run. Looks up test1's uid via Firebase Auth (by email) rather
 * than hardcoding it, since a uid isn't known until the account exists.
 */
export async function cleanupTestGames(
  serviceAccountPath: string,
  adminEmail: string,
): Promise<{ deleted: number }> {
  const app = getAdminApp(serviceAccountPath);
  const auth = admin.auth(app);
  const db = admin.firestore(app);

  const adminUser = await auth.getUserByEmail(adminEmail);
  const snapshot = await db
    .collection('games')
    .where('adminId', '==', adminUser.uid)
    .get();

  const batchDeletes = snapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(batchDeletes);

  return { deleted: snapshot.size };
}
