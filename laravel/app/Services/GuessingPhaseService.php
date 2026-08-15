<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameGuessResult;
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
            throw new RuntimeException('Cannot start the guessing phase until comments have been shown and points have been awarded.');
        }

        $nonTargetParticipants = $game->participants()
            ->where('user_id', '!=', $round->target_user_id)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->get();

        $completed = $game->players_who_completed_post_comment_phase ?? [];
        $incomplete = $nonTargetParticipants->reject(fn ($p) => in_array((string) $p->user_id, $completed, true));

        if ($incomplete->isNotEmpty()) {
            throw new RuntimeException(
                "Cannot start guessing phase. Waiting for {$incomplete->count()} player(s) to complete the post-comment phase."
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
            throw new RuntimeException('Only the target can make guesses');
        }

        if (Guess::where('comment_id', $comment->id)->where('guesser_id', $guesser->id)->exists()) {
            throw new RuntimeException('You already guessed for this comment');
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
            throw new RuntimeException('Only the admin can mark another player as submitted');
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
}
