<?php

namespace Database\Factories;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_id' => Game::factory(),
            'round_number' => 1,
            'target_user_id' => User::factory(),
            'started_at' => now(),
        ];
    }
}
