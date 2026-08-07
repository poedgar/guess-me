describe('Locale switching', () => {
  it('toggles the UI language and persists the choice across a reload', () => {
    const SETTLE_MS = 1500;

    // ── test1 creates a game — the language selector lives in GameHeader,
    // shown once inside a game (not on the pre-game JoinScreen). No second
    // participant needed — locale is a per-user UI preference, not shared
    // game state. ─────────────────────────────────────────────────────────
    cy.signInAsTestUser('test1');

    // ── i18n.ts's detectLocale() picks the locale from navigator.language
    // at module-load time (before Firebase auth or LanguageContext ever
    // run) — Ukrainian is only its fallback for a browser-language tag it
    // doesn't recognize, not an unconditional default. Headless Cypress
    // Chrome reports navigator.language as 'en-US', which IS a recognized
    // SUPPORTED_LOCALES tag, so without this stub the app legitimately
    // renders English on first load (confirmed by an earlier run of this
    // spec) and the "switch to English" step below would be a no-op.
    // Stubbing navigator.language to 'uk-UA' before the page's own scripts
    // run reproduces what an actual Ukrainian-locale browser sees, matching
    // index.html's lang="uk" and this test's intent of proving the toggle
    // moves the UI *away* from its Ukrainian default. ──────────────────────
    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, 'language', {
          value: 'uk-UA',
          configurable: true,
        });
      },
    });

    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    let gameUrl = '';
    cy.url().then((url) => {
      gameUrl = url;
    });

    // ── Default locale is Ukrainian (the stubbed browser language above,
    // resolved via i18n.ts's detectLocale()). The leave-game button's text
    // is a simple, already-instrumented (Task 1) known string that changes
    // with locale. ───────────────────────────────────────────────────────
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Покинути гру');

    // ── Switch to English ────────────────────────────────────────────────
    cy.get('[data-cy=language-button][data-cy-lang=en]').click();
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Leave Game');
    cy.wait(SETTLE_MS);

    // ── Reload — locale is saved to localStorage (LanguageContext.tsx) and
    // restored on load, so this proves persistence, not just the in-session
    // toggle. A plain cy.reload() wouldn't actually prove that: headless
    // Cypress Chrome's real navigator.language ('en-US') is itself a
    // recognized SUPPORTED_LOCALES tag, so i18n.ts's detectLocale() would
    // independently re-resolve 'en' on reload even if the localStorage
    // save/restore in LanguageContext.tsx were completely broken — the
    // assertion would pass for the wrong reason. Stubbing
    // navigator.language to an UNRECOGNIZED tag ('fr-FR') for this specific
    // navigation forces detectLocale()'s own fallback to 'uk' instead;
    // seeing 'Leave Game' (English) afterward can then only be explained by
    // LanguageContext.tsx's persisted localStorage value overriding that
    // fresh detection — which is the actual thing this step needs to
    // prove. cy.reload() has no onBeforeLoad hook, so cy.visit() to the
    // already-captured game URL is used instead. ───────────────────────────
    cy.then(() => {
      cy.visit(gameUrl, {
        onBeforeLoad(win) {
          Object.defineProperty(win.navigator, 'language', {
            value: 'fr-FR',
            configurable: true,
          });
        },
      });
    });
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Leave Game');
  });
});
