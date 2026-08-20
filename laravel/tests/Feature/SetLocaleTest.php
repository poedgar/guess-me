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
