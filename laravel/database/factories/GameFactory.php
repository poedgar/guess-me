<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class GameFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->slug(2),
            'admin_id' => User::factory(),
        ];
    }
}
