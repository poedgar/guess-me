<?php

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Two\User as SocialiteUser;

test('users table has google_id and photo_url columns', function () {
    expect(Schema::hasColumns('users', ['google_id', 'photo_url']))->toBeTrue();
});

test('firstOrCreateFromGoogle creates a new user on first sign-in', function () {
    $googleUser = new SocialiteUser;
    $googleUser->id = 'google-123';
    $googleUser->email = 'new@example.com';
    $googleUser->name = 'New Person';
    $googleUser->avatar = 'https://example.com/photo.jpg';

    $user = User::firstOrCreateFromGoogle($googleUser);

    expect($user->google_id)->toBe('google-123');
    expect($user->email)->toBe('new@example.com');
    expect($user->name)->toBe('New Person');
    expect($user->photo_url)->toBe('https://example.com/photo.jpg');
});

test('firstOrCreateFromGoogle links to an existing email/password account by email', function () {
    $existing = User::factory()->create(['email' => 'existing@example.com', 'google_id' => null]);

    $googleUser = new SocialiteUser;
    $googleUser->id = 'google-456';
    $googleUser->email = 'existing@example.com';
    $googleUser->name = $existing->name;
    $googleUser->avatar = null;

    $user = User::firstOrCreateFromGoogle($googleUser);

    expect($user->id)->toBe($existing->id);
    expect($user->fresh()->google_id)->toBe('google-456');
});

test('firstOrCreateFromGoogle returns the same user on repeat sign-in', function () {
    $googleUser = new SocialiteUser;
    $googleUser->id = 'google-789';
    $googleUser->email = 'repeat@example.com';
    $googleUser->name = 'Repeat Person';
    $googleUser->avatar = null;

    $first = User::firstOrCreateFromGoogle($googleUser);
    $second = User::firstOrCreateFromGoogle($googleUser);

    expect($second->id)->toBe($first->id);
    expect(User::count())->toBe(1);
});
