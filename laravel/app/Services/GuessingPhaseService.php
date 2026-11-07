<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameScore;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GuessingPhaseService
{
    public function startGuessingPhase(Game $game): void
    {
        $round = $game->rounds()->latest('round_number')->firstOrFail();

        if (! $round->comments_visible || ! $round->points_given) {
            throw new RuntimeException(__('Cannot start the guessing phase until comments have been shown and points have been awarded.'));
        }

        $nonTargetParticipants = $game->participants()
            ->where('user_id', '!=', $round->target_user_id)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->get();

        $completed = $game->players_who_completed_post_comment_phase ?? [];
        $incomplete = $nonTargetParticipants->reject(fn ($p) => in_array((string) $p->user_id, $completed, true));

        if ($incomplete->isNotEmpty()) {
            throw new RuntimeException(
                __('Cannot start guessing phase. Waiting for :count player(s) to complete the post-comment phase.', ['count' => $incomplete->count()])
            );
        }

        DB::transaction(function () use ($game, $round) {
            $possibleAuthors = $game->participants()->with('user')->get()->map(fn ($p) => [
                'userId' => (string) $p->user_id,
                'userName' => $p->user->name,
            ])->values()->all();

            $round->update([
                'single_round_guessing_active' => true,
                'guessing_possible_authors' => $possibleAuthors,
                'guessing_players_submitted' => [],
                'guessing_all_submitted' => false,
            ]);

            $game->update(['status' => 'guessing_phase']);
        });
    }

    public function submitGuess(Round $round, User $guesser, Comment $comment, User $guessedAuthor): Guess
    {
        if ($guesser->id !== $round->target_user_id) {
            throw new RuntimeException(__('Only the target can make guesses'));
        }

        if (Guess::where('comment_id', $comment->id)->where('guesser_id', $guesser->id)->exists()) {
            throw new RuntimeException(__('You already guessed for this comment'));
        }

        return DB::transaction(function () use ($round, $guesser, $comment, $guessedAuthor) {
            $correct = $guessedAuthor->id === $comment->author_id;

            $guess = Guess::create([
                'round_id' => $round->id,
                'comment_id' => $comment->id,
                'guesser_id' => $guesser->id,
                'guessed_author_id' => $guessedAuthor->id,
                'correct' => $correct,
            ]);

            if ($correct) {
                $round->increment('target_correct_guesses');
            }

            $totalComments = $round->comments()->count();
            $guessesByThisUser = Guess::where('round_id', $round->id)->where('guesser_id', $guesser->id)->count();

            if ($guessesByThisUser >= $totalComments) {
                $submitted = $round->guessing_players_submitted ?? [];
                if (! in_array((string) $guesser->id, $submitted, true)) {
                    $submitted[] = (string) $guesser->id;
                    $totalTargets = max(count($round->guessing_possible_authors ?? []) > 0 ? 1 : 1, 1);
                    $round->update([
                        'guessing_players_submitted' => $submitted,
                        'guessing_all_submitted' => count($submitted) >= $totalTargets,
                    ]);
                }
            }

            return $guess;
        });
    }

    public function markPlayerGuessesSubmitted(Game $game, Round $round, User $caller, ?User $player = null): void
    {
        $player ??= $caller;

        if ($player->id !== $caller->id && $caller->id !== $game->admin_id) {
            throw new RuntimeException(__('Only the admin can mark another player as submitted'));
        }

        DB::transaction(function () use ($game, $round, $player) {
            $submitted = $round->guessing_players_submitted ?? [];
            if (! in_array((string) $player->id, $submitted, true)) {
                $submitted[] = (string) $player->id;
            }

            $allSubmitted = count($submitted) >= 1; // exactly one guesser (the round's target) in per-round guessing

            $round->update([
                'guessing_players_submitted' => $submitted,
                'guessing_all_submitted' => $allSubmitted,
            ]);

            $roundIds = $game->rounds()->pluck('id');
            $correctGuessCount = Guess::whereIn('round_id', $roundIds)
                ->where('guesser_id', $player->id)
                ->where('correct', true)
                ->count();

            $resultRow = GameGuessResult::firstOrCreate(
                ['game_id' => $game->id, 'user_id' => $player->id],
                ['correct_guesses' => 0],
            );
            $resultRow->update(['correct_guesses' => $correctGuessCount]);

            if ($allSubmitted) {
                $game->update(['post_guessing_point_phase' => true, 'players_who_awarded_post_guess_points' => []]);
            }
        });
    }

    public function awardPointsToPlayers(Game $game, Round $round, User $awarder, array $awards): void
    {
        if (! $game->post_guessing_point_phase) {
            throw new RuntimeException(__('Post-guessing point phase is not active'));
        }

        $alreadyAwarded = $game->players_who_awarded_post_guess_points ?? [];
        if (in_array((string) $awarder->id, $alreadyAwarded, true)) {
            throw new RuntimeException(__('You have already awarded points in this phase'));
        }

        if (count($awards) === 0) {
            throw new RuntimeException(__('No awards specified'));
        }

        foreach ($awards as $award) {
            if ((int) $award['recipientId'] === $awarder->id) {
                throw new RuntimeException(__('You cannot award points to yourself'));
            }
        }

        DB::transaction(function () use ($game, $round, $awarder, $awards, $alreadyAwarded) {
            foreach ($awards as $award) {
                $recipient = User::findOrFail($award['recipientId']);
                GameScore::incrementFor($game, $recipient, (int) $award['points']);
            }

            $history = $game->admin_awards ?? [];
            $history[(string) $awarder->id] = [
                ...($history[(string) $awarder->id] ?? []),
                ...array_map(fn ($award) => [
                    'recipientId' => (string) $award['recipientId'],
                    'points' => (int) $award['points'],
                    'awardedBy' => (string) $awarder->id,
                    'awardedAt' => now()->toIso8601String(),
                    'roundNumber' => $round->round_number,
                ], $awards),
            ];

            $game->update([
                'players_who_awarded_post_guess_points' => [...$alreadyAwarded, (string) $awarder->id],
                'admin_awards' => $history,
            ]);
        });
    }

    public function finalizeGuessingPhase(Game $game, Round $round): void
    {
        DB::transaction(function () use ($game, $round) {
            $round->update(['guesses_finalized' => true, 'single_round_guessing_active' => false]);
            $game->update(['status' => 'active']);
        });
    }
}
