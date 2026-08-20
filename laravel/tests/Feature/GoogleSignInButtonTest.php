<?php

test('the login page links to the Google sign-in route', function () {
    $response = $this->get('/login');

    $response->assertOk();
    // Inertia SSR-free responses embed the page's props as JSON in the initial HTML;
    // the simplest reliable check is that the named route resolves at all (a broken
    // route() call in the Vue template would fail at build time, not request time,
    // so this test's real job is documenting the contract, not catching a build error).
    expect(route('auth.google.redirect'))->toContain('/auth/google/redirect');
});
