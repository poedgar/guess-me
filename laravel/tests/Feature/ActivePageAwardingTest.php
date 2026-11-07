<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once comments are visible, the target sees the comment text and existing points', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id, 'comments_visible' => true,
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate', 'points' => 2]);

    $response = $this->actingAs($target)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.comments.0.text', 'Great teammate')
        ->where('game.currentRound.comments.0.points', 2)
    );
});

test('pre-reveal, comment text is gated: admin and the comment\'s own author see it, other participants do not', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $authorA = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $authorA->id]);
    $authorB = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $authorB->id]);

    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => false,
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $authorA->id, 'text' => 'Comment from A']);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $authorB->id, 'text' => 'Comment from B']);

    // (a) the admin sees every comment's text pre-reveal.
    $adminResponse = $this->actingAs($admin)->get("/games/{$game->id}");
    $adminResponse->assertInertia(function (Assert $page) {
        $comments = collect($page->toArray()['props']['game']['currentRound']['comments']);
        expect($comments->pluck('text')->sort()->values()->all())->toBe(['Comment from A', 'Comment from B']);
    });

    // (b) a comment's own author sees their own text; (c) a non-admin non-author sees null for the other's comment.
    $authorAResponse = $this->actingAs($authorA)->get("/games/{$game->id}");
    $authorAResponse->assertInertia(function (Assert $page) use ($authorA) {
        $comments = collect($page->toArray()['props']['game']['currentRound']['comments']);
        $mine = $comments->firstWhere('authorId', $authorA->id);
        $others = $comments->reject(fn ($c) => $c['authorId'] === $authorA->id);

        expect($mine['text'])->toBe('Comment from A');
        expect($others)->toHaveCount(1);
        expect($others->first()['text'])->toBeNull();
    });
});

test('once comments are visible, every participant sees every comment\'s text', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $bystander = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $bystander->id]);

    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Visible now']);

    $response = $this->actingAs($bystander)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.comments.0.text', 'Visible now')
    );
});
