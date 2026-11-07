<?php

namespace Database\Factories;

use App\Models\Round;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'round_id' => Round::factory(),
            'author_id' => User::factory(),
            'text' => fake()->sentence(),
        ];
    }
}
