export type TestUserRole = 'test1' | 'test2' | 'test3';

declare global {
  namespace Cypress {
    interface Chainable {
      signInAsTestUser(role: TestUserRole): Chainable<void>;
      // TEMPORARY diagnostic command — logs the Firebase Auth identity
      // actually persisted in IndexedDB at the moment it's called, to
      // directly observe account-switch state instead of inferring it.
      logPersistedAuthEmail(label: string): Chainable<void>;
    }
  }

  interface Window {
    __cypressSignInWithEmail?: (email: string, password: string) => Promise<void>;
  }
}

// Firebase Auth's web persistence lives in IndexedDB (`firebaseLocalStorageDb`
// / `firebaseLocalStorage`), which is *not* part of what cy.session
// snapshots and restores (cookies, localStorage, sessionStorage only). That
// means switching cy.session ids alone does not switch the real signed-in
// Firebase user — the app can stay authenticated as whichever account last
// actually ran a real sign-in, regardless of which session id Cypress just
// restored. Reading the persisted record directly (rather than adding a new
// production hook, which wouldn't take effect until deployed — this suite
// runs against real production) lets `validate()` catch that mismatch and
// force a real re-login via `setup` to correct it.
const getPersistedFirebaseAuthEmail = (win: Window): Promise<string | null> =>
  new Promise((resolve) => {
    const request = win.indexedDB.open('firebaseLocalStorageDb');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction('firebaseLocalStorage', 'readonly');
      const getAllRequest = tx.objectStore('firebaseLocalStorage').getAll();
      getAllRequest.onsuccess = () => {
        const records = getAllRequest.result as Array<{
          fbase_key?: string;
          value?: { email?: string };
        }>;
        // Match on the record's own key, not merely "the first record that
        // happens to carry an email". @firebase/auth stores each record under
        // the keyPath `fbase_key` (DB_DATA_KEYPATH) with the name built by
        // `_persistenceKeyName(key, apiKey, appName)` =>
        // `firebase:<key>:<apiKey>:<appName>`. The signed-in user lives under
        // key `authUser`, but sibling records in the same object store also
        // hold a user object with an `email` — notably `firebase:redirectUser:…`
        // — and a second Firebase app instance would add more. Picking the
        // wrong one here would silently defeat this whole check, whose only
        // job is to detect that the persisted account is not the expected one.
        const email =
          records.find((r) => String(r?.fbase_key ?? '').startsWith('firebase:authUser:'))?.value
            ?.email ?? null;
        db.close();
        resolve(email);
      };
      getAllRequest.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });

// Polls the IndexedDB read above until it matches `expectedEmail` or gives
// up. This can't be a plain `cy.window().then(...).should(...)` — `.should()`
// only re-asserts on the value `.then()` already resolved once, it does not
// re-run an async `.then()` callback on retry. Without real retrying here, a
// single unlucky read (IndexedDB write still in flight) intermittently
// misjudges the signed-in identity, which is exactly what was observed
// (wrong participant treated as commenter/target, admin controls briefly
// not recognized) before this was polling.
const waitForPersistedFirebaseAuthEmail = (
  win: Window,
  expectedEmail: string,
  attemptsLeft = 20,
): PromiseLike<string | null> => {
  return Cypress.Promise.resolve(getPersistedFirebaseAuthEmail(win)).then((email) => {
    if (email === expectedEmail || attemptsLeft <= 0) {
      return email;
    }
    return new Cypress.Promise((resolve) => setTimeout(resolve, 250)).then(() =>
      waitForPersistedFirebaseAuthEmail(win, expectedEmail, attemptsLeft - 1),
    );
  });
};

Cypress.Commands.add('signInAsTestUser', (role: TestUserRole) => {
  const account = Cypress.env('testAccounts')[role];
  if (!account) {
    throw new Error(`No test account configured for role "${role}" in cypress.env.json`);
  }

  cy.session(
    role,
    () => {
      cy.visit('/');
      cy.window().should('have.property', '__cypressSignInWithEmail');
      cy.window().then((win) => {
        return win.__cypressSignInWithEmail!(account.email, account.password);
      });
      // Wait until the sign-in button is gone — proof onAuthStateChanged
      // fired and the app moved past the sign-in screen — before
      // cy.session snapshots storage.
      cy.get('[data-cy=google-signin-button]').should('not.exist');
    },
    {
      validate: () => {
        cy.visit('/');
        cy.get('[data-cy=google-signin-button]').should('not.exist');
        cy.window()
          .then((win) => waitForPersistedFirebaseAuthEmail(win, account.email))
          .then((email) => {
            // TEMPORARY diagnostic — see logPersistedAuthEmail below.
            cy.log(`[DIAG] validate(${role}): expected=${account.email} actual=${email}`);
            return email;
          })
          .should('eq', account.email);
      },
      cacheAcrossSpecs: false,
    },
  );

  cy.visit('/');
});

// TEMPORARY diagnostic command — not a permanent addition. Logs whatever
// email is actually persisted in Firebase Auth's IndexedDB storage at the
// moment it's called, labeled by the caller. Used to directly observe which
// account the app is really authenticated as at a specific point in a test,
// rather than inferring it from rendered UI state.
Cypress.Commands.add('logPersistedAuthEmail', (label: string) => {
  cy.window().then((win) => getPersistedFirebaseAuthEmail(win)).then((email) => {
    cy.log(`[DIAG] ${label}: persisted auth email = ${email}`);
  });
});
