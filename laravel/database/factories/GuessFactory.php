<?php

namespace Database\Factories;

use App\Models\Comment;
use App\Models\Round;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class GuessFactory extends Factory
{
    public function definition(): array
    {
        return [
            'round_id' => Round::factory(),
            'comment_id' => Comment::factory(),
            'guesser_id' => User::factory(),
            'guessed_author_id' => User::factory(),
            'correct' => false,
        ];
    }
}
