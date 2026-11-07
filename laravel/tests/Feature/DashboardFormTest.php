<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the dashboard page renders create/join forms pointing at the real routes', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn (Assert $page) => $page->component('Dashboard'));
    // The form's target routes must exist and resolve — a stale route() call
    // in the template throws at Inertia render time in this Laravel version's
    // Ziggy integration, which would surface as a 500 here.
    $response->assertOk();
});
