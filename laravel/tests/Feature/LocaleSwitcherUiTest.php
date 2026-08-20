<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the dashboard page carries the resolved locale to Inertia', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});
