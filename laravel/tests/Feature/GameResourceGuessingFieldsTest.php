<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('GameResource exposes guessing and points-given tracking data', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id,
        'status' => 'guessing_phase',
        'players_who_completed_post_comment_phase' => ['7'],
        'players_who_awarded_post_guess_points' => ['9'],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);

    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
        'target_points_given_by' => [(string) $author->id],
        'guessing_all_submitted' => true,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    Guess::factory()->create([
        'round_id' => $round->id, 'comment_id' => $comment->id,
        'guesser_id' => $target->id, 'guessed_author_id' => $author->id, 'correct' => true,
    ]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.guessingPossibleAuthors.0.userId', (string) $author->id)
        ->where('game.currentRound.guesses.0.guessedAuthorId', $author->id)
        ->where('game.currentRound.guesses.0.correct', true)
        ->where('game.currentRound.targetPointsGivenBy', [(string) $author->id])
        ->where('game.currentRound.guessingAllSubmitted', true)
        ->where('game.playersWhoCompletedPostCommentPhase', ['7'])
        ->where('game.playersWhoAwardedPostGuessPoints', ['9'])
    );
});
