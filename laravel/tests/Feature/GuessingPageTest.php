<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('during guessing_phase, the resource exposes possible authors and comments to guess about', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate']);

    $response = $this->actingAs($target)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'guessing_phase')
        ->where('game.currentRound.guessingPossibleAuthors.0.userName', $author->name)
        ->where('game.currentRound.comments.0.text', 'Great teammate')
    );
});

test('during active guessing, before finalization, the target does not receive authorId for a comment they did not write, but the comment\'s own author does', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'guesses_finalized' => false,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate']);

    // The target — actively guessing — must not be handed the answer key.
    $targetResponse = $this->actingAs($target)->get("/games/{$game->id}");
    $targetResponse->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'guessing_phase')
        ->where('game.currentRound.guessesFinalized', false)
        ->where('game.currentRound.comments.0.authorId', null)
    );

    // The comment's own author already knows they wrote it, so seeing it back is not a leak.
    $authorResponse = $this->actingAs($author)->get("/games/{$game->id}");
    $authorResponse->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.comments.0.authorId', $author->id)
    );
});

test('during active guessing, before finalization, a guess\'s correct outcome is hidden from the guesser and everyone else, but visible to the admin', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'guesses_finalized' => false,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    Guess::factory()->create([
        'round_id' => $round->id, 'comment_id' => $comment->id,
        'guesser_id' => $target->id, 'guessed_author_id' => $author->id, 'correct' => true,
    ]);

    // The target guessed correctly, but must not learn that yet — it would spoil the
    // remaining guesses in the round via elimination.
    $targetResponse = $this->actingAs($target)->get("/games/{$game->id}");
    $targetResponse->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.guesses.0.guessedAuthorId', $author->id)
        ->where('game.currentRound.guesses.0.correct', null)
    );

    // The admin can see the outcome for oversight purposes, same as they can read
    // pre-reveal comment text.
    $adminResponse = $this->actingAs($admin)->get("/games/{$game->id}");
    $adminResponse->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.guesses.0.correct', true)
    );
});
