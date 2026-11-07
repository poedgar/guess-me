<?php

use App\Models\Game;
use App\Support\GameCodeGenerator;

test('generateUnique returns a lowercase two-word code', function () {
    $code = (new GameCodeGenerator())->generateUnique();

    expect($code)->toMatch('/^[a-zа-яїієґ\'ʼ-]+ [a-zа-яїієґ\'ʼ-]+$/u');
});

test('generateUnique retries when the first code is already taken', function () {
    $generator = new class extends GameCodeGenerator {
        private int $calls = 0;
        protected function randomCode(): string
        {
            $this->calls++;
            return $this->calls === 1 ? 'taken-code' : 'fresh-code';
        }
    };

    Game::factory()->create(['code' => 'taken-code']);

    expect($generator->generateUnique())->toBe('fresh-code');
});

test('generateUnique throws after 10 failed attempts', function () {
    $generator = new class extends GameCodeGenerator {
        protected function randomCode(): string
        {
            return 'always-taken';
        }
    };

    Game::factory()->create(['code' => 'always-taken']);

    expect(fn () => $generator->generateUnique())
        ->toThrow(RuntimeException::class, 'Unable to generate unique game code after multiple attempts');
});
