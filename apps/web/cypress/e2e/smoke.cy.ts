describe('Smoke tests', () => {
  it('signing in with a test account reaches the join-game screen', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').should('be.visible');
    cy.get('[data-cy=game-input-submit]').should('be.visible');
  });

  it('creating a game with the admin password reaches the waiting room', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW');
    cy.get('[data-cy=game-input-submit]').click();
    cy.get('[data-cy=start-game-button]').should('be.visible');
  });

  it('a second test account can join the game the first created', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW');
    cy.get('[data-cy=game-input-submit]').click();

    // The game ID is shown as the page's own <h1>-adjacent button text in
    // WaitingPhase (`{game.id} 🔗`) — read it from the URL instead, which
    // HomePage.tsx navigates to as soon as currentGame.id is set, and is a
    // stable place to read the ID from regardless of that button's markup.
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
    });
  });
});
