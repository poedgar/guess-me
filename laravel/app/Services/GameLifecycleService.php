<?php

namespace App\Services;

use App\Models\Game;
use App\Models\GameParticipant;
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
}
