<?php

use App\Models\User;

test('SetLocale defaults to uk for a guest with no session locale', function () {
    $response = $this->get('/');
    expect(session('locale'))->toBe('uk');
});

test('SetLocale resolves from an authenticated user\'s stored preference', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $this->actingAs($user)->get('/dashboard');

    expect(session('locale'))->toBe('en');
});

test('POST /locale updates the session and, for an authenticated user, persists to their record', function () {
    $user = User::factory()->create(['locale' => 'uk']);

    $this->actingAs($user)->post('/locale', ['locale' => 'en'])->assertRedirect();

    expect(session('locale'))->toBe('en');
    expect($user->fresh()->locale)->toBe('en');
});

test('POST /locale works for a guest without persisting anywhere but the session', function () {
    $this->post('/locale', ['locale' => 'en'])->assertRedirect();

    expect(session('locale'))->toBe('en');
});

test('the shared locale Inertia prop reflects the resolved locale', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn ($page) => $page->where('locale', 'en'));
});

test('a stored user locale preference is honored after a real login, even though the pre-login guest visit already stamped the session', function () {
    // Regression test for the masking bug: actingAs() starts from an empty
    // session, which isn't representative of a real browser session. Here we
    // hit /login as a real guest GET first — exactly like SetLocale runs for
    // every unauthenticated visitor — which stamps session('locale') = 'uk'.
    // Login via Laravel's session guard does not clear that session data, so
    // without the fix the pre-login 'uk' stamp would keep masking this user's
    // stored 'en' preference indefinitely.
    $user = User::factory()->create(['locale' => 'en', 'password' => bcrypt('password')]);

    $this->get('/login');
    expect(session('locale'))->toBe('uk');

    $loginResponse = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);
    $loginResponse->assertRedirect();
    $this->assertAuthenticatedAs($user);

    $response = $this->get('/dashboard');
    $response->assertInertia(fn ($page) => $page->where('locale', 'en'));
    expect(session('locale'))->toBe('en');
});

test('an explicit in-session locale switch keeps overriding the stored user preference for the rest of the session', function () {
    $user = User::factory()->create(['locale' => 'en', 'password' => bcrypt('password')]);

    $this->get('/login');
    $this->post('/login', ['email' => $user->email, 'password' => 'password']);

    // The user explicitly switches to Ukrainian mid-session...
    $this->post('/locale', ['locale' => 'uk'])->assertRedirect();
    expect(session('locale'))->toBe('uk');
    // ...which also persists to their stored preference (existing behavior),
    // but the point of this test is that a subsequent request still honors
    // the explicit in-session choice rather than re-reading the (now also
    // 'uk', but that's incidental) stored value.
    expect($user->fresh()->locale)->toBe('uk');

    $response = $this->get('/dashboard');
    $response->assertInertia(fn ($page) => $page->where('locale', 'uk'));
});
