<?php

use App\Events\GameUpdated;
use Illuminate\Broadcasting\PrivateChannel;

test('GameUpdated broadcasts on the private game channel with only the game id', function () {
    $event = new GameUpdated(42);

    expect($event->broadcastOn())->toHaveCount(1);
    expect($event->broadcastOn()[0])->toBeInstanceOf(PrivateChannel::class);
    expect($event->broadcastOn()[0]->name)->toBe('private-game.42');
    expect($event->broadcastWith())->toBe(['gameId' => 42]);
});
