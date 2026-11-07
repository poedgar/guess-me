<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\User;

test('a full Mirror round trip: create, join, start, comment, award, guess, and finish the round', function () {
    config(['game.admin_password' => 'secret-123']);

    $admin = User::factory()->create();
    $target = User::factory()->create();
    $author = User::factory()->create();

    // Create
    $this->actingAs($admin)->post('/games', ['password' => 'secret-123'])->assertRedirect();
    $game = Game::first();

    // Join
    $this->actingAs($target)->post('/games/join', ['code' => $game->code])->assertRedirect();
    $this->actingAs($author)->post('/games/join', ['code' => $game->code])->assertRedirect();

    // Start — target selection is random among non-admin participants, so force determinism
    // by asserting on whichever of $target/$author was NOT picked as commenter vs target is
    // irrelevant to the test: submit the comment as whichever participant isn't the round's target.
    $this->actingAs($admin)->post("/games/{$game->id}/start")->assertRedirect();
    $round = $game->fresh()->rounds()->sole();
    $commenter = $round->target_user_id === $target->id ? $author : $target;

    // Comment phase
    $this->actingAs($commenter)->post("/games/{$game->id}/comments", ['text' => 'Always shows up early.'])->assertRedirect();
    $this->actingAs($admin)->post("/games/{$game->id}/show-comments")->assertRedirect();

    $comment = $round->fresh()->comments()->sole();
    $roundTarget = User::find($round->target_user_id);
    $this->actingAs($roundTarget)->post("/games/{$game->id}/comment-points/{$comment->id}", ['points' => 3])->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/finish-awarding-points")->assertRedirect();
    $this->actingAs($commenter)->post("/games/{$game->id}/target-points", ['points' => 1])->assertRedirect();

    // Guessing phase
    $this->actingAs($admin)->post("/games/{$game->id}/start-guessing")->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/guesses", [
        'comment_id' => $comment->id,
        'guessed_author_id' => $commenter->id,
    ])->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/mark-guesses-submitted")->assertRedirect();

    expect($game->fresh()->post_guessing_point_phase)->toBeTrue();

    $this->actingAs($admin)->post("/games/{$game->id}/finalize-guessing")->assertRedirect();

    expect($round->fresh()->guesses_finalized)->toBeTrue();
    expect($game->fresh()->status)->toBe('active');
    expect(GameScore::where('game_id', $game->id)->where('user_id', $commenter->id)->value('points'))->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $roundTarget->id)->value('points'))->toBe(1);

    // Next round: the game has two non-admin participants (target, author), and per
    // GameLifecycleService::startNextRound / docs/game-mechanics.md, the game only finishes
    // once EVERY non-admin participant has been the target. Round 1 used $roundTarget, so
    // round 2 must target the remaining participant ($commenter) before the game can finish.
    $this->actingAs($admin)->post("/games/{$game->id}/next-round")->assertRedirect();
    $round2 = $game->fresh()->rounds()->where('round_number', 2)->sole();
    expect($round2->target_user_id)->toBe($commenter->id);
    expect($game->fresh()->status)->toBe('active');

    // With both non-admin participants now having served as target, this next call finds no
    // eligible target left and finishes the game.
    $this->actingAs($admin)->post("/games/{$game->id}/next-round")->assertRedirect();
    expect($game->fresh()->status)->toBe('finished');
});
