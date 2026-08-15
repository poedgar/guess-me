<?php

namespace App\Services;

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Support\GameCodeGenerator;
use Illuminate\Support\Facades\DB;

class GameLifecycleService
{
    public function __construct(private GameCodeGenerator $codeGenerator)
    {
    }

    public function createGame(User $admin, bool $adminWritesComments = false): Game
    {
        return DB::transaction(function () use ($admin, $adminWritesComments) {
            $game = Game::create([
                'code' => $this->codeGenerator->generateUnique(),
                'admin_id' => $admin->id,
                'admin_writes_comments' => $adminWritesComments,
            ]);

            GameParticipant::create([
                'game_id' => $game->id,
                'user_id' => $admin->id,
                'joined_at' => now(),
            ]);

            return $game;
        });
    }

    public function joinGame(User $user, string $code): Game
    {
        $game = Game::where('code', $code)->first();
        if (! $game) {
            throw new \App\Exceptions\GameNotFoundException();
        }

        GameParticipant::firstOrCreate(
            ['game_id' => $game->id, 'user_id' => $user->id],
            ['joined_at' => now()],
        );

        return $game;
    }

    public function startGame(Game $game): void
    {
        $participants = $game->participants()->orderBy('joined_at')->orderBy('id')->get();

        if ($participants->count() < 2) {
            throw new \RuntimeException('Need at least 2 participants to start the game');
        }

        DB::transaction(function () use ($game, $participants) {
            foreach ($participants as $index => $participant) {
                $participant->update(['player_number' => $index + 1]);
            }

            $candidates = $participants->reject(fn ($p) => $p->user_id === $game->admin_id);
            $target = $candidates->random();

            Round::create([
                'game_id' => $game->id,
                'round_number' => 1,
                'target_user_id' => $target->user_id,
                'started_at' => now(),
                'start_scores_snapshot' => [],
                'start_guess_results_snapshot' => [],
            ]);

            $game->update(['status' => 'active']);
        });
    }
}
