# Laravel Mirror-Mode Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a standalone Laravel application under `/laravel` that replaces Firebase entirely for auth, game creation/join, and the Mirror game mode — a full re-implementation against a relational schema, real-time via Reverb/Echo, UI via Inertia + Vue 3.

**Architecture:** Inertia.js controllers render Vue 3 page components per game phase (`Waiting`, `Active`, `Guessing`, `Results`). Three focused service classes (`GameLifecycleService`, `CommentPhaseService`, `GuessingPhaseService`) own the Mirror state machine's write paths, each wrapping its mutations in a DB transaction with row locking and firing a `GameUpdated` broadcast (private channel `game.{id}`, payload is just the game ID) on success. The browser's only reaction to that broadcast is an Inertia partial reload of the `game` prop — there is exactly one code path that shapes game state for the client, used by both the initial page load and every real-time update.

**Tech Stack:** Latest stable Laravel, Inertia.js + Vue 3, Laravel Breeze (Vue stack) for auth scaffolding, Laravel Socialite (Google), Laravel Reverb + Echo, SQLite (dev), Pest.

**Spec:** [docs/superpowers/specs/2026-08-15-laravel-mirror-port-design.md](../specs/2026-08-15-laravel-mirror-port-design.md)

## Global Constraints

- Lives entirely under `/laravel` at the repo root — own `composer.json`, not part of the npm workspace, no dependency on `packages/shared`.
- Real-time payload is the game ID only, never game state — every client re-fetches through the same controller path (spec's "Real-Time Strategy").
- No Firestore/Firebase reads or writes anywhere in this app.
- Admin password gate is a shared `.env` value (`ADMIN_GAME_PASSWORD`), checked at game creation, not a persistent role.
- Session-based auth (Laravel default), not token-based.
- Basket, Clash, and Ideas modes, `AdminCleanupPage` parity, functional `showSurnames`/`showGuessResults` gating, sound effects, and QR-code join are explicitly out of scope for this plan (spec's Non-Goals).
- The "legacy/fallback all-rounds-at-once guessing" code path in the original `GameContext.tsx` (used only for pre-existing Firestore documents with no per-round `singleRoundTargetId`) has no equivalent in a fresh relational schema and is intentionally not ported — only the per-round guessing path is implemented.
- Admin round-tools beyond the core state machine (`setNextRoundTarget`, `skipNextRoundTarget`, `resetTargetControls`, `restartMirrorRound`, `skipMirrorRound`) are not in the spec's route list and are out of scope for this plan.

---

## Reference: Source Behavior Being Ported

Every task below implements one piece of the state machine documented in `docs/game-mechanics.md` and implemented in `apps/web/src/contexts/GameContext.tsx` (lines noted per task). Read the cited lines before implementing — the Laravel version preserves the *rules*, not the Firestore-specific mechanics (transactions become DB transactions with row locks; Firestore's `arrayUnion`/optimistic-update-then-rollback has no equivalent need here since the ping+reload real-time design means the browser already waits for the server response).

---

## Phase A: Project Scaffolding

### Task 1: Bootstrap the Laravel + Inertia/Vue + Pest project

**Files:**
- Create: `laravel/` (entire Laravel project)

**Interfaces:**
- Produces: a working Laravel app at `laravel/`, reachable via `php artisan serve`, with Breeze's Vue+Inertia auth scaffolding (login, register, password reset) and Pest as the test runner.

- [ ] **Step 1: Create the base Laravel project**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
composer create-project laravel/laravel laravel
```

- [ ] **Step 2: Install Breeze with the Vue (Inertia) stack and Pest, non-interactively**

```bash
cd laravel
composer require laravel/breeze --dev
php artisan breeze:install vue --pest --no-interaction
```

- [ ] **Step 3: Set the app name and configure SQLite for local dev**

Edit `laravel/.env`: set `APP_NAME="In The Mirror"`, confirm `DB_CONNECTION=sqlite` (Laravel's current default — no `DB_DATABASE` needed, it resolves to `database/database.sqlite`).

```bash
touch database/database.sqlite
php artisan migrate
```

- [ ] **Step 4: Install JS dependencies and verify the dev build boots**

```bash
npm install
npm run build
```

- [ ] **Step 5: Run the default Breeze test suite to confirm the scaffold works**

Run: `php artisan test`
Expected: PASS (Breeze's default auth feature tests — registration, login, password reset — all pass out of the box)

- [ ] **Step 6: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add laravel/
git commit -m "Bootstrap Laravel app with Inertia/Vue/Breeze/Pest scaffolding"
```

---

### Task 2: Install and verify Reverb (WebSocket broadcasting)

**Files:**
- Modify: `laravel/.env`, `laravel/config/broadcasting.php` (via installer)
- Create: `laravel/app/Events/GameUpdated.php`
- Test: `laravel/tests/Feature/GameUpdatedEventTest.php`

**Interfaces:**
- Produces: `App\Events\GameUpdated` — constructed with `int $gameId`, broadcasts on `PrivateChannel('game.' . $gameId)` as event name `GameUpdated`, payload `['gameId' => $gameId]`. Every later task that mutates game state dispatches this event.

- [ ] **Step 1: Install Reverb**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/laravel
php artisan install:broadcasting --reverb --no-interaction
```

This sets `BROADCAST_CONNECTION=reverb` in `.env`, adds Reverb env vars, installs `laravel-echo`/`pusher-js` in `package.json`, and publishes `routes/channels.php`.

- [ ] **Step 2: Write the failing test for the event's channel/payload shape**

```php
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GameUpdatedEventTest`
Expected: FAIL — `App\Events\GameUpdated` not found

- [ ] **Step 3: Implement the event**

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class GameUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $gameId)
    {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('game.' . $this->gameId)];
    }

    public function broadcastWith(): array
    {
        return ['gameId' => $this->gameId];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=GameUpdatedEventTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Events/GameUpdated.php tests/Feature/GameUpdatedEventTest.php .env.example config/ composer.json composer.lock package.json
git commit -m "Install Reverb and add GameUpdated broadcast event"
```

---

### Task 3: Add Google OAuth (Socialite) alongside Breeze's email/password auth

**Files:**
- Create: `laravel/database/migrations/xxxx_add_google_id_and_photo_url_to_users_table.php`
- Modify: `laravel/app/Models/User.php`
- Create: `laravel/app/Http/Controllers/Auth/GoogleAuthController.php`
- Modify: `laravel/routes/auth.php`
- Test: `laravel/tests/Feature/GoogleAuthTest.php`

**Interfaces:**
- Consumes: Breeze's existing session-auth scaffolding from Task 1.
- Produces: `GET /auth/google/redirect` and `GET /auth/google/callback` routes. `User::firstOrCreateFromGoogle(\Laravel\Socialite\Contracts\User $googleUser): User` static method — later tasks that need "the current user" just use Breeze's existing `auth()->user()`, so no other task depends on this one beyond the routes existing.

- [ ] **Step 1: Install Socialite**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/laravel
composer require laravel/socialite
```

Add to `laravel/config/services.php`:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI', '/auth/google/callback'),
],
```

Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` to `.env` and `.env.example` (blank values in `.env.example`).

- [ ] **Step 2: Write the failing migration test — users table has the new columns**

```php
<?php

use Illuminate\Support\Facades\Schema;

test('users table has google_id and photo_url columns', function () {
    expect(Schema::hasColumns('users', ['google_id', 'photo_url']))->toBeTrue();
});
```

Save as `laravel/tests/Feature/GoogleAuthTest.php` (first test in the file; more appended below).

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=GoogleAuthTest`
Expected: FAIL — columns don't exist

- [ ] **Step 4: Create the migration**

```bash
php artisan make:migration add_google_id_and_photo_url_to_users_table --table=users
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('email');
            $table->string('photo_url')->nullable()->after('google_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['google_id', 'photo_url']);
        });
    }
};
```

Run: `php artisan migrate`

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=GoogleAuthTest`
Expected: PASS

- [ ] **Step 6: Add `google_id`/`photo_url` to `User`'s fillable and the `firstOrCreateFromGoogle` helper, with a failing test first**

Append to `GoogleAuthTest.php`:

```php
use App\Models\User;
use Laravel\Socialite\Two\User as SocialiteUser;

test('firstOrCreateFromGoogle creates a new user on first sign-in', function () {
    $googleUser = new SocialiteUser();
    $googleUser->id = 'google-123';
    $googleUser->email = 'new@example.com';
    $googleUser->name = 'New Person';
    $googleUser->avatar = 'https://example.com/photo.jpg';

    $user = User::firstOrCreateFromGoogle($googleUser);

    expect($user->google_id)->toBe('google-123');
    expect($user->email)->toBe('new@example.com');
    expect($user->name)->toBe('New Person');
    expect($user->photo_url)->toBe('https://example.com/photo.jpg');
});

test('firstOrCreateFromGoogle links to an existing email/password account by email', function () {
    $existing = User::factory()->create(['email' => 'existing@example.com', 'google_id' => null]);

    $googleUser = new SocialiteUser();
    $googleUser->id = 'google-456';
    $googleUser->email = 'existing@example.com';
    $googleUser->name = $existing->name;
    $googleUser->avatar = null;

    $user = User::firstOrCreateFromGoogle($googleUser);

    expect($user->id)->toBe($existing->id);
    expect($user->fresh()->google_id)->toBe('google-456');
});

test('firstOrCreateFromGoogle returns the same user on repeat sign-in', function () {
    $googleUser = new SocialiteUser();
    $googleUser->id = 'google-789';
    $googleUser->email = 'repeat@example.com';
    $googleUser->name = 'Repeat Person';
    $googleUser->avatar = null;

    $first = User::firstOrCreateFromGoogle($googleUser);
    $second = User::firstOrCreateFromGoogle($googleUser);

    expect($second->id)->toBe($first->id);
    expect(User::count())->toBe(1);
});
```

- [ ] **Step 7: Run to verify these three fail**

Run: `php artisan test --filter=GoogleAuthTest`
Expected: FAIL — method `firstOrCreateFromGoogle` doesn't exist

- [ ] **Step 8: Implement on `User`**

Add to `laravel/app/Models/User.php` (inside the class, alongside the existing `fillable`):

```php
protected $fillable = [
    'name',
    'email',
    'password',
    'google_id',
    'photo_url',
];

public static function firstOrCreateFromGoogle(\Laravel\Socialite\Contracts\User $googleUser): self
{
    $user = static::where('google_id', $googleUser->getId())->first();
    if ($user) {
        return $user;
    }

    $user = static::where('email', $googleUser->getEmail())->first();
    if ($user) {
        $user->update(['google_id' => $googleUser->getId(), 'photo_url' => $googleUser->getAvatar()]);
        return $user;
    }

    return static::create([
        'name' => $googleUser->getName(),
        'email' => $googleUser->getEmail(),
        'google_id' => $googleUser->getId(),
        'photo_url' => $googleUser->getAvatar(),
        'password' => bcrypt(str()->random(32)),
        'email_verified_at' => now(),
    ]);
}
```

- [ ] **Step 9: Run test to verify all pass**

Run: `php artisan test --filter=GoogleAuthTest`
Expected: PASS

- [ ] **Step 10: Add the controller and routes**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        $googleUser = Socialite::driver('google')->user();
        $user = User::firstOrCreateFromGoogle($googleUser);

        Auth::login($user, remember: true);

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
```

Add to `laravel/routes/auth.php` (inside the `guest` middleware group, alongside the other login routes):

```php
Route::get('auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('auth.google.redirect');
Route::get('auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');
```

(Add the corresponding `use App\Http\Controllers\Auth\GoogleAuthController;` import at the top of the file.)

- [ ] **Step 11: Run the full auth suite**

Run: `php artisan test --filter=Auth`
Expected: PASS (Breeze's existing tests plus the new Google ones)

- [ ] **Step 12: Commit**

```bash
git add app/Models/User.php app/Http/Controllers/Auth/GoogleAuthController.php routes/auth.php database/migrations tests/Feature/GoogleAuthTest.php config/services.php .env.example composer.json composer.lock
git commit -m "Add Google sign-in via Socialite alongside Breeze's email/password auth"
```

---

## Phase B: Core Data Model

### Task 4: `games` and `game_participants` tables and models

**Files:**
- Create: `laravel/database/migrations/xxxx_create_games_table.php`
- Create: `laravel/database/migrations/xxxx_create_game_participants_table.php`
- Create: `laravel/app/Models/Game.php`
- Create: `laravel/app/Models/GameParticipant.php`
- Create: `laravel/database/factories/GameFactory.php`
- Create: `laravel/database/factories/GameParticipantFactory.php`
- Test: `laravel/tests/Unit/GameModelTest.php`

**Interfaces:**
- Produces: `Game` (belongsTo `admin` [User], hasMany `participants` [GameParticipant], hasMany `rounds` [Round, Task 5], hasMany `scores` [GameScore, Task 6], hasMany `guessResults` [GameGuessResult, Task 6]) with columns per the spec's Data Model section: `code`, `admin_id`, `status` (enum: waiting/active/guessing_phase/finished), `admin_writes_comments`, `show_surnames`, `show_guess_results`, `target_selection_mode` (enum: random/chronological), `post_guessing_point_phase`, `players_who_awarded_post_guess_points` (json array), `admin_awards` (json), `players_who_completed_post_comment_phase` (json array), `admin_left`, `admin_next_target_preference`, `admin_skipped_targets` (json array). `GameParticipant` (belongsTo `game`, belongsTo `user`) with `joined_at`, `has_been_target`, `player_number`.
- Consumes: `users` table (Task 1's Breeze scaffold).

- [ ] **Step 1: Write the failing model test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

test('game belongs to an admin and has many participants', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $participant = GameParticipant::factory()->create(['game_id' => $game->id]);

    expect($game->admin->is($admin))->toBeTrue();
    expect($game->participants->first()->is($participant))->toBeTrue();
    expect($participant->game->is($game))->toBeTrue();
});

test('game casts json array and boolean columns', function () {
    $game = Game::factory()->create([
        'players_who_awarded_post_guess_points' => ['u1', 'u2'],
        'admin_writes_comments' => true,
    ]);

    $fresh = $game->fresh();
    expect($fresh->players_who_awarded_post_guess_points)->toBe(['u1', 'u2']);
    expect($fresh->admin_writes_comments)->toBeTrue();
});

test('game defaults status to waiting and settings to their documented defaults', function () {
    $game = Game::factory()->create();

    expect($game->status)->toBe('waiting');
    expect($game->admin_writes_comments)->toBeFalse();
    expect($game->show_surnames)->toBeFalse();
    expect($game->show_guess_results)->toBeFalse();
    expect($game->target_selection_mode)->toBe('random');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GameModelTest`
Expected: FAIL — class `Game` not found

- [ ] **Step 3: Create the migrations**

```bash
php artisan make:migration create_games_table
php artisan make:migration create_game_participants_table
```

`create_games_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('admin_id')->constrained('users');
            $table->enum('status', ['waiting', 'active', 'guessing_phase', 'finished'])->default('waiting');
            $table->boolean('admin_writes_comments')->default(false);
            $table->boolean('show_surnames')->default(false);
            $table->boolean('show_guess_results')->default(false);
            $table->enum('target_selection_mode', ['random', 'chronological'])->default('random');
            $table->boolean('post_guessing_point_phase')->default(false);
            $table->json('players_who_awarded_post_guess_points')->nullable();
            $table->json('admin_awards')->nullable();
            $table->json('players_who_completed_post_comment_phase')->nullable();
            $table->boolean('admin_left')->default(false);
            $table->foreignId('admin_next_target_preference')->nullable()->constrained('users');
            $table->json('admin_skipped_targets')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};
```

`create_game_participants_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->timestamp('joined_at');
            $table->boolean('has_been_target')->default(false);
            $table->unsignedInteger('player_number')->nullable();
            $table->timestamps();
            $table->unique(['game_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_participants');
    }
};
```

Run: `php artisan migrate`

- [ ] **Step 4: Create the models**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'admin_id',
        'status',
        'admin_writes_comments',
        'show_surnames',
        'show_guess_results',
        'target_selection_mode',
        'post_guessing_point_phase',
        'players_who_awarded_post_guess_points',
        'admin_awards',
        'players_who_completed_post_comment_phase',
        'admin_left',
        'admin_next_target_preference',
        'admin_skipped_targets',
    ];

    protected $casts = [
        'admin_writes_comments' => 'boolean',
        'show_surnames' => 'boolean',
        'show_guess_results' => 'boolean',
        'post_guessing_point_phase' => 'boolean',
        'admin_left' => 'boolean',
        'players_who_awarded_post_guess_points' => 'array',
        'admin_awards' => 'array',
        'players_who_completed_post_comment_phase' => 'array',
        'admin_skipped_targets' => 'array',
    ];

    protected $attributes = [
        'status' => 'waiting',
        'admin_writes_comments' => false,
        'show_surnames' => false,
        'show_guess_results' => false,
        'target_selection_mode' => 'random',
        'post_guessing_point_phase' => false,
        'admin_left' => false,
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(GameParticipant::class);
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Round::class);
    }

    public function scores(): HasMany
    {
        return $this->hasMany(GameScore::class);
    }

    public function guessResults(): HasMany
    {
        return $this->hasMany(GameGuessResult::class);
    }

    public function currentRound(): HasMany
    {
        return $this->rounds()->latest('round_number');
    }
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameParticipant extends Model
{
    use HasFactory;

    protected $fillable = ['game_id', 'user_id', 'joined_at', 'has_been_target', 'player_number'];

    protected $casts = [
        'joined_at' => 'datetime',
        'has_been_target' => 'boolean',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 5: Create the factories**

```php
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
```

```php
<?php

namespace Database\Factories;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class GameParticipantFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_id' => Game::factory(),
            'user_id' => User::factory(),
            'joined_at' => now(),
        ];
    }
}
```

Add `use HasFactory;` and `protected static function newFactory()` is auto-resolved by Laravel's naming convention — no extra code needed for that.

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=GameModelTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Models/Game.php app/Models/GameParticipant.php database/migrations database/factories tests/Unit/GameModelTest.php
git commit -m "Add games and game_participants tables and models"
```

---

### Task 5: `rounds`, `comments`, `guesses` tables and models

**Files:**
- Create: `laravel/database/migrations/xxxx_create_rounds_table.php`
- Create: `laravel/database/migrations/xxxx_create_comments_table.php`
- Create: `laravel/database/migrations/xxxx_create_guesses_table.php`
- Create: `laravel/app/Models/Round.php`
- Create: `laravel/app/Models/Comment.php`
- Create: `laravel/app/Models/Guess.php`
- Create: `laravel/database/factories/RoundFactory.php`
- Test: `laravel/tests/Unit/RoundModelTest.php`

**Interfaces:**
- Consumes: `Game` (Task 4).
- Produces: `Round` (belongsTo `game`, belongsTo `target` [User], hasMany `comments`, hasMany `guesses`) with `round_number`, `comments_visible`, `points_given`, `guesses_finalized`, `target_points`, `target_points_given_by` (json array), `target_points_by_player` (json map), `target_correct_guesses`, `started_at`, `start_scores_snapshot` (json), `start_guess_results_snapshot` (json), `guessing_possible_authors` (json), `guessing_players_submitted` (json array), `guessing_all_submitted` (bool), `single_round_guessing_active` (bool — true once `startGuessingPhase` has moved this round into the guessing UI; replaces the JS version's `singleRoundTargetId` marker, scoped per-round instead of per-game since each round is its own row here). `Comment` (belongsTo `round`, belongsTo `author` [User]) with `text`, `points`. `Guess` (belongsTo `round`, belongsTo `comment`, belongsTo `guesser` [User], belongsTo `guessedAuthor` [User]) with `correct`.

- [ ] **Step 1: Write the failing model test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;

test('round belongs to a game and a target, and has many comments and guesses', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    $comment = Comment::factory()->for($round)->create();
    $guess = Guess::factory()->for($round)->for($comment)->create();

    expect($round->game->is($game))->toBeTrue();
    expect($round->target->is($target))->toBeTrue();
    expect($round->comments->first()->is($comment))->toBeTrue();
    expect($round->guesses->first()->is($guess))->toBeTrue();
    expect($comment->round->is($round))->toBeTrue();
    expect($comment->author)->toBeInstanceOf(User::class);
});

test('round casts json columns to arrays and booleans to bool', function () {
    $round = Round::factory()->create([
        'target_points_given_by' => ['u1'],
        'comments_visible' => 1,
    ]);

    $fresh = $round->fresh();
    expect($fresh->target_points_given_by)->toBe(['u1']);
    expect($fresh->comments_visible)->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=RoundModelTest`
Expected: FAIL — classes not found

- [ ] **Step 3: Create the migrations**

```bash
php artisan make:migration create_rounds_table
php artisan make:migration create_comments_table
php artisan make:migration create_guesses_table
```

`create_rounds_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('round_number');
            $table->foreignId('target_user_id')->constrained('users');
            $table->boolean('comments_visible')->default(false);
            $table->boolean('points_given')->default(false);
            $table->boolean('guesses_finalized')->default(false);
            $table->integer('target_points')->default(0);
            $table->json('target_points_given_by')->nullable();
            $table->json('target_points_by_player')->nullable();
            $table->unsignedInteger('target_correct_guesses')->default(0);
            $table->timestamp('started_at');
            $table->json('start_scores_snapshot')->nullable();
            $table->json('start_guess_results_snapshot')->nullable();
            $table->json('guessing_possible_authors')->nullable();
            $table->json('guessing_players_submitted')->nullable();
            $table->boolean('guessing_all_submitted')->default(false);
            $table->boolean('single_round_guessing_active')->default(false);
            $table->timestamps();
            $table->unique(['game_id', 'round_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rounds');
    }
};
```

`create_comments_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('round_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users');
            $table->string('text', 500);
            $table->unsignedInteger('points')->nullable();
            $table->timestamps();
            $table->unique(['round_id', 'author_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
```

`create_guesses_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('round_id')->constrained()->cascadeOnDelete();
            $table->foreignId('comment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('guesser_id')->constrained('users');
            $table->foreignId('guessed_author_id')->constrained('users');
            $table->boolean('correct');
            $table->timestamps();
            $table->unique(['comment_id', 'guesser_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guesses');
    }
};
```

Run: `php artisan migrate`

- [ ] **Step 4: Create the models**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Round extends Model
{
    use HasFactory;

    protected $fillable = [
        'game_id', 'round_number', 'target_user_id', 'comments_visible', 'points_given',
        'guesses_finalized', 'target_points', 'target_points_given_by', 'target_points_by_player',
        'target_correct_guesses', 'started_at', 'start_scores_snapshot', 'start_guess_results_snapshot',
        'guessing_possible_authors', 'guessing_players_submitted', 'guessing_all_submitted',
        'single_round_guessing_active',
    ];

    protected $casts = [
        'comments_visible' => 'boolean',
        'points_given' => 'boolean',
        'guesses_finalized' => 'boolean',
        'started_at' => 'datetime',
        'target_points_given_by' => 'array',
        'target_points_by_player' => 'array',
        'start_scores_snapshot' => 'array',
        'start_guess_results_snapshot' => 'array',
        'guessing_possible_authors' => 'array',
        'guessing_players_submitted' => 'array',
        'guessing_all_submitted' => 'boolean',
        'single_round_guessing_active' => 'boolean',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function guesses(): HasMany
    {
        return $this->hasMany(Guess::class);
    }
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Comment extends Model
{
    use HasFactory;

    protected $fillable = ['round_id', 'author_id', 'text', 'points'];

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guess extends Model
{
    use HasFactory;

    protected $fillable = ['round_id', 'comment_id', 'guesser_id', 'guessed_author_id', 'correct'];

    protected $casts = ['correct' => 'boolean'];

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function guesser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guesser_id');
    }

    public function guessedAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guessed_author_id');
    }
}
```

- [ ] **Step 5: Create factories for `Round`, `Comment`, `Guess`**

```php
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
```

```bash
php artisan make:factory CommentFactory --model=Comment
php artisan make:factory GuessFactory --model=Guess
```

`CommentFactory`:

```php
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
```

`GuessFactory`:

```php
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=RoundModelTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Models/Round.php app/Models/Comment.php app/Models/Guess.php database/migrations database/factories tests/Unit/RoundModelTest.php
git commit -m "Add rounds, comments, and guesses tables and models"
```

---

### Task 6: `game_scores` and `game_guess_results` tables and models

**Files:**
- Create: `laravel/database/migrations/xxxx_create_game_scores_table.php`
- Create: `laravel/database/migrations/xxxx_create_game_guess_results_table.php`
- Create: `laravel/app/Models/GameScore.php`
- Create: `laravel/app/Models/GameGuessResult.php`
- Test: `laravel/tests/Unit/GameScoreModelTest.php`

**Interfaces:**
- Consumes: `Game` (Task 4).
- Produces: `GameScore` (belongsTo `game`, belongsTo `user`, `points` int, unique on `[game_id, user_id]`) and `GameGuessResult` (same shape, `correct_guesses` int) — both with a static `incrementFor(Game $game, User $user, int $by): void` helper used by every scoring task from here on, so the "add N points, creating the row if it doesn't exist yet" logic lives in exactly one place.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameScore;
use App\Models\User;

test('GameScore::incrementFor creates the row on first award and accumulates on repeat awards', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    GameScore::incrementFor($game, $user, 3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $user->id)->value('points'))->toBe(3);

    GameScore::incrementFor($game, $user, 2);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $user->id)->value('points'))->toBe(5);
});

test('GameGuessResult::incrementFor creates the row on first award and accumulates on repeat awards', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    GameGuessResult::incrementFor($game, $user, 1);
    GameGuessResult::incrementFor($game, $user, 1);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $user->id)->value('correct_guesses'))->toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GameScoreModelTest`
Expected: FAIL — classes not found

- [ ] **Step 3: Create the migrations**

```bash
php artisan make:migration create_game_scores_table
php artisan make:migration create_game_guess_results_table
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->integer('points')->default(0);
            $table->timestamps();
            $table->unique(['game_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_scores');
    }
};
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_guess_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->unsignedInteger('correct_guesses')->default(0);
            $table->timestamps();
            $table->unique(['game_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_guess_results');
    }
};
```

Run: `php artisan migrate`

- [ ] **Step 4: Create the models**

```php
<?php

namespace App\Models;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameScore extends Model
{
    protected $fillable = ['game_id', 'user_id', 'points'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function incrementFor(Game $game, User $user, int $by): void
    {
        $row = static::firstOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['points' => 0]);
        $row->increment('points', $by);
    }
}
```

```php
<?php

namespace App\Models;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameGuessResult extends Model
{
    protected $fillable = ['game_id', 'user_id', 'correct_guesses'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function incrementFor(Game $game, User $user, int $by): void
    {
        $row = static::firstOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['correct_guesses' => 0]);
        $row->increment('correct_guesses', $by);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=GameScoreModelTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Models/GameScore.php app/Models/GameGuessResult.php database/migrations tests/Unit/GameScoreModelTest.php
git commit -m "Add game_scores and game_guess_results tables and models"
```

---

## Phase C: Game Creation, Join, and the Orchestrator Page

### Task 7: Port the Ukrainian-word game code generator

**Files:**
- Create: `laravel/app/Support/GameCodeGenerator.php`
- Test: `laravel/tests/Unit/GameCodeGeneratorTest.php`

**Interfaces:**
- Produces: `App\Support\GameCodeGenerator::generateUnique(): string` — returns a `"adjective noun"` code (ported from `packages/shared/src/utils/gameIdGenerator.ts`) not already used by any row in `games.code`, retrying up to 10 times before throwing `RuntimeException('Unable to generate unique game code after multiple attempts')`, matching the `maxAttempts` behavior in `GameContext.tsx:411-443`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Support\GameCodeGenerator;

test('generateUnique returns a lowercase two-word code', function () {
    $code = (new GameCodeGenerator())->generateUnique();

    expect($code)->toMatch('/^[a-zа-яїієґ\'-]+ [a-zа-яїієґ\'-]+$/u');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GameCodeGeneratorTest`
Expected: FAIL — class not found

- [ ] **Step 3: Implement the generator**

Copy the `ukrainianAdjectives` and `ukrainianNouns` arrays verbatim from `packages/shared/src/utils/gameIdGenerator.ts` (lines 2–141) into the PHP file below, translating JS array-literal syntax to PHP (`['Весела', 'Сонячна', ...]`) — every entry, not a subset, so generated codes have the same variety as the existing apps.

```php
<?php

namespace App\Support;

use App\Models\Game;
use RuntimeException;

class GameCodeGenerator
{
    /** @var string[] */
    private const ADJECTIVES = [
        'Весела', 'Сонячна', 'Зимова', 'Весняна',
        // ... copy the full list from packages/shared/src/utils/gameIdGenerator.ts:2-99 here
    ];

    /** @var string[] */
    private const NOUNS = [
        'Кішка', 'Собака', 'Кобила', 'Птаха', 'Рибка',
        // ... copy the full list from packages/shared/src/utils/gameIdGenerator.ts:101-141 here
    ];

    public function generateUnique(): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $code = $this->randomCode();
            if (! Game::where('code', $code)->exists()) {
                return $code;
            }
        }

        throw new RuntimeException('Unable to generate unique game code after multiple attempts');
    }

    protected function randomCode(): string
    {
        $adjective = mb_strtolower(str_replace(' ', '-', self::ADJECTIVES[array_rand(self::ADJECTIVES)]));
        $noun = mb_strtolower(str_replace(' ', '-', self::NOUNS[array_rand(self::NOUNS)]));

        return "{$adjective} {$noun}";
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=GameCodeGeneratorTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Support/GameCodeGenerator.php tests/Unit/GameCodeGeneratorTest.php
git commit -m "Port the Ukrainian-word game code generator from packages/shared"
```

---

### Task 8: Admin password config and `GameLifecycleService::createGame`

**Files:**
- Create: `laravel/config/game.php`
- Create: `laravel/app/Services/GameLifecycleService.php`
- Create: `laravel/app/Http/Controllers/GameController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/CreateGameTest.php`

**Interfaces:**
- Produces: `App\Services\GameLifecycleService::createGame(User $admin, bool $adminWritesComments): Game` — creates the game row (status `waiting`, settings at their defaults, `code` from `GameCodeGenerator`) and a `GameParticipant` row for the admin (`joined_at` = now), inside a DB transaction. `POST /games` route, gated on `ADMIN_GAME_PASSWORD` in the controller (per spec — the service itself does not know about the password).
- Consumes: `GameCodeGenerator::generateUnique()` (Task 7), `Game`/`GameParticipant` (Task 4).

- [ ] **Step 1: Add the config value**

```php
<?php

return [
    'admin_password' => env('ADMIN_GAME_PASSWORD'),
];
```

Save as `laravel/config/game.php`. Add `ADMIN_GAME_PASSWORD=` to `.env.example` and set a real value in `.env` (any string — this is a local dev secret, not committed).

- [ ] **Step 2: Write the failing feature test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

beforeEach(function () {
    config(['game.admin_password' => 'secret-123']);
});

test('creating a game with the correct password creates the game and adds the creator as a participant', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', [
        'password' => 'secret-123',
        'admin_writes_comments' => true,
    ]);

    $game = Game::first();
    expect($game)->not->toBeNull();
    expect($game->admin_id)->toBe($user->id);
    expect($game->status)->toBe('waiting');
    expect($game->admin_writes_comments)->toBeTrue();
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->exists())->toBeTrue();
    $response->assertRedirect("/games/{$game->id}");
});

test('creating a game with the wrong password fails validation and creates nothing', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', [
        'password' => 'wrong',
        'admin_writes_comments' => false,
    ]);

    $response->assertSessionHasErrors('password');
    expect(Game::count())->toBe(0);
});

test('guests cannot create a game', function () {
    $response = $this->post('/games', ['password' => 'secret-123']);

    $response->assertRedirect('/login');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=CreateGameTest`
Expected: FAIL — route/controller don't exist

- [ ] **Step 4: Implement the service**

```php
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
```

- [ ] **Step 5: Implement the controller and route**

```php
<?php

namespace App\Http\Controllers;

use App\Services\GameLifecycleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GameController extends Controller
{
    public function __construct(private GameLifecycleService $lifecycle)
    {
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
            'admin_writes_comments' => ['sometimes', 'boolean'],
        ]);

        if ($validated['password'] !== config('game.admin_password')) {
            throw ValidationException::withMessages(['password' => 'Incorrect admin password.']);
        }

        $game = $this->lifecycle->createGame($request->user(), $validated['admin_writes_comments'] ?? false);

        return redirect("/games/{$game->id}");
    }
}
```

Add to `laravel/routes/web.php` (inside the existing `auth` middleware group Breeze created for `dashboard`):

```php
use App\Http\Controllers\GameController;

Route::post('games', [GameController::class, 'store'])->name('games.store');
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=CreateGameTest`
Expected: PASS (the redirect assertion will 404 until Task 10 adds `GET /games/{game}` — for now assert only the response status is a redirect, not that the target route resolves; feature tests don't follow redirects by default so this passes)

- [ ] **Step 7: Commit**

```bash
git add config/game.php app/Services/GameLifecycleService.php app/Http/Controllers/GameController.php routes/web.php tests/Feature/CreateGameTest.php .env.example
git commit -m "Add admin password gate and GameLifecycleService::createGame"
```

---

### Task 9: `GameLifecycleService::joinGame`

**Files:**
- Modify: `laravel/app/Services/GameLifecycleService.php`
- Modify: `laravel/app/Http/Controllers/GameController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/JoinGameTest.php`

**Interfaces:**
- Consumes: `GameLifecycleService` (Task 8).
- Produces: `GameLifecycleService::joinGame(User $user, string $code): Game` — throws `App\Exceptions\GameNotFoundException` (new, extends `\RuntimeException`) if no game has that code; no-ops (returns the game) if the user is already a participant, matching `GameContext.tsx:490-534`'s idempotent re-join. `POST /games/join` route.

- [ ] **Step 1: Write the failing feature test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

test('joining an existing game by code adds the user as a participant', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->exists())->toBeTrue();
    $response->assertRedirect("/games/{$game->id}");
});

test('joining a game the user already joined is a no-op, not an error', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $user->id]);

    $response = $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    $response->assertRedirect("/games/{$game->id}");
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->count())->toBe(1);
});

test('joining with an unknown code fails validation', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games/join', ['code' => 'no-such-code']);

    $response->assertSessionHasErrors('code');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=JoinGameTest`
Expected: FAIL — route doesn't exist

- [ ] **Step 3: Add the exception class**

```php
<?php

namespace App\Exceptions;

use RuntimeException;

class GameNotFoundException extends RuntimeException
{
}
```

- [ ] **Step 4: Add `joinGame` to the service**

Add to `GameLifecycleService` (alongside `createGame`):

```php
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
```

- [ ] **Step 5: Add the controller action and route**

Add to `GameController`:

```php
public function join(Request $request): RedirectResponse
{
    $validated = $request->validate(['code' => ['required', 'string']]);

    try {
        $game = $this->lifecycle->joinGame($request->user(), $validated['code']);
    } catch (\App\Exceptions\GameNotFoundException) {
        throw ValidationException::withMessages(['code' => 'No game found with that code.']);
    }

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/join', [GameController::class, 'join'])->name('games.join');
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=JoinGameTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Exceptions/GameNotFoundException.php app/Services/GameLifecycleService.php app/Http/Controllers/GameController.php routes/web.php tests/Feature/JoinGameTest.php
git commit -m "Add GameLifecycleService::joinGame"
```

---

### Task 10: Orchestrator page — `GET /games/{game}`, channel authorization, and phase routing shell

**Files:**
- Create: `laravel/app/Http/Resources/GameResource.php`
- Modify: `laravel/app/Http/Controllers/GameController.php`
- Modify: `laravel/routes/web.php`
- Modify: `laravel/routes/channels.php`
- Create: `laravel/resources/js/Pages/Game/Show.vue`
- Create: `laravel/resources/js/Pages/Game/Mirror/Waiting.vue`
- Create: `laravel/resources/js/echo.js` (Breeze's Reverb install may already scaffold this — verify and adjust rather than duplicating)
- Test: `laravel/tests/Feature/ShowGameTest.php`

**Interfaces:**
- Consumes: `Game` and its relations (Tasks 4–6).
- Produces: `GameResource` — the single place that shapes a `Game` model into the JSON/prop shape the Vue pages consume (`id`, `code`, `status`, `isAdmin` [bool, relative to the authenticated user], `settings` [the four toggleable settings], `participants` [`id`, `name`, `photoUrl`, `playerNumber`], `currentRound` [null or shaped round data], `scores`, `guessResults`). Every later controller action that redirects back to the game page relies on this same resource — no task after this one re-shapes game state independently. `GameController::show(Game $game)` renders `Game/Show.vue` with prop `game` from `GameResource`. `routes/channels.php` authorizes `game.{gameId}` for participants and the admin only.

- [ ] **Step 1: Write the failing feature test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('a participant can view the game page and sees the shaped game data', function () {
    $admin = User::factory()->create(['name' => 'Admin Person']);
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $participant = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $participant->id]);

    $response = $this->actingAs($participant)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->component('Game/Show')
        ->where('game.id', $game->id)
        ->where('game.code', $game->code)
        ->where('game.status', 'waiting')
        ->where('game.isAdmin', false)
        ->has('game.participants', 2)
    );
});

test('a non-participant cannot view the game page', function () {
    $game = Game::factory()->create();
    $outsider = User::factory()->create();

    $response = $this->actingAs($outsider)->get("/games/{$game->id}");

    $response->assertForbidden();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ShowGameTest`
Expected: FAIL — route doesn't exist

- [ ] **Step 3: Implement `GameResource`**

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GameResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $userId = $request->user()->id;
        $currentRound = $this->rounds()->latest('round_number')->first();

        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status,
            'isAdmin' => $this->admin_id === $userId,
            'adminLeft' => $this->admin_left,
            'settings' => [
                'adminWritesComments' => $this->admin_writes_comments,
                'showSurnames' => $this->show_surnames,
                'showGuessResults' => $this->show_guess_results,
                'targetSelectionMode' => $this->target_selection_mode,
            ],
            'postGuessingPointPhase' => $this->post_guessing_point_phase,
            'participants' => $this->participants->map(fn ($p) => [
                'userId' => $p->user_id,
                'name' => $p->user->name,
                'photoUrl' => $p->user->photo_url,
                'playerNumber' => $p->player_number,
                'joinedAt' => $p->joined_at,
            ])->values(),
            'currentRound' => $currentRound && $currentRound->status_is_current ? null : null, // replaced in Task 11 once rounds carry real "is this the open round" state
            'scores' => $this->scores->mapWithKeys(fn ($s) => [$s->user_id => $s->points]),
            'guessResults' => $this->guessResults->mapWithKeys(fn ($r) => [$r->user_id => $r->correct_guesses]),
        ];
    }
}
```

Note the `currentRound` line is intentionally a placeholder *value* (`null`), not placeholder logic-with-a-comment-instead-of-code — at this point in the plan there is no rule yet for "which round is open," because `startGame` (Task 11) hasn't been implemented. Task 11 replaces this whole line with the real lookup. Remove the `status_is_current` reference (not a real column) before running — this task only needs `currentRound` to always resolve to `null` (there are no rounds yet, since games are only ever in `waiting` status when this task's tests run):

```php
'currentRound' => null,
```

- [ ] **Step 4: Implement the controller action, route, and Vue pages**

Add to `GameController`:

```php
public function show(\App\Models\Game $game): \Inertia\Response
{
    $this->authorize('view', $game);

    $game->load(['participants.user', 'scores', 'guessResults']);

    return inertia('Game/Show', [
        'game' => new \App\Http\Resources\GameResource($game),
    ]);
}
```

Create `laravel/app/Policies/GamePolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\Game;
use App\Models\User;

class GamePolicy
{
    public function view(User $user, Game $game): bool
    {
        return $game->admin_id === $user->id || $game->participants()->where('user_id', $user->id)->exists();
    }
}
```

Register it in `laravel/app/Providers/AppServiceProvider.php`'s `boot()`:

```php
\Illuminate\Support\Facades\Gate::policy(\App\Models\Game::class, \App\Policies\GamePolicy::class);
```

Add to `routes/web.php`:

```php
Route::get('games/{game}', [GameController::class, 'show'])->name('games.show');
```

`laravel/resources/js/Pages/Game/Show.vue`:

```vue
<script setup>
import { computed } from 'vue';
import Waiting from './Mirror/Waiting.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    // Only 'waiting' is wired up so far — later tasks add Active/Guessing/Results.
    return Waiting;
});
</script>

<template>
    <component :is="phaseComponent" :game="game" />
</template>
```

`laravel/resources/js/Pages/Game/Mirror/Waiting.vue`:

```vue
<script setup>
defineProps({ game: Object });
</script>

<template>
    <div class="p-6">
        <h1 class="text-xl font-bold">Game {{ game.code }}</h1>
        <p v-if="game.isAdmin" class="text-sm text-gray-500">You are the admin.</p>
        <h2 class="mt-4 font-semibold">Participants ({{ game.participants.length }})</h2>
        <ul>
            <li v-for="p in game.participants" :key="p.userId">{{ p.name }}</li>
        </ul>
    </div>
</template>
```

- [ ] **Step 5: Add channel authorization**

Add to `laravel/routes/channels.php`:

```php
use App\Models\Game;

Broadcast::channel('game.{gameId}', function ($user, $gameId) {
    $game = Game::find($gameId);
    if (! $game) {
        return false;
    }

    return $game->admin_id === $user->id || $game->participants()->where('user_id', $user->id)->exists();
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=ShowGameTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Http/Resources/GameResource.php app/Http/Controllers/GameController.php app/Policies/GamePolicy.php app/Providers/AppServiceProvider.php routes/web.php routes/channels.php resources/js/Pages/Game tests/Feature/ShowGameTest.php
git commit -m "Add the game orchestrator page, GameResource, and channel authorization"
```

---

## Phase D: Active Phase (Comment Submission)

### Task 11: `GameLifecycleService::startGame`

**Files:**
- Modify: `laravel/app/Services/GameLifecycleService.php`
- Modify: `laravel/app/Http/Resources/GameResource.php`
- Modify: `laravel/app/Http/Controllers/GameController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/StartGameTest.php`

**Interfaces:**
- Consumes: `GameLifecycleService` (Task 8), `Round` (Task 5).
- Produces: `GameLifecycleService::startGame(Game $game): void` — throws `\Illuminate\Auth\Access\AuthorizationException`-style `RuntimeException` messages matching the source's own error strings where the UI surfaces them directly (`"Only the admin can start the game"`, `"Need at least 2 participants to start the game"`, ported from `GameContext.tsx:686-734`). Assigns `player_number` to every participant ordered by `joined_at` (ties broken by `id` for determinism — the source has no documented tie-break, so this is the plan's explicit choice). Selects round 1's target at random, **always excluding the admin** regardless of `admin_writes_comments` — this is a deliberate port of `selectRandomParticipant`'s unconditional admin exclusion (`GameContext.tsx:673-684`), which differs from `startNextRound`'s later-rounds rule (Task 21) where the admin *can* become a target if `admin_writes_comments` is true. This inconsistency exists in the source and is preserved, not fixed, per the spec's "port behavior, don't redesign it" stance. `POST /games/{game}/start` route.
- After this task, `GameResource::currentRound` resolves to the real open round instead of always `null` — update it now.

- [ ] **Step 1: Write the failing feature test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GameLifecycleService;

test('starting a game creates round 1 with a non-admin target and assigns player numbers by join order', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id, 'joined_at' => now()->subMinutes(3)]);
    $second = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $second->id, 'joined_at' => now()->subMinutes(2)]);
    $third = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $third->id, 'joined_at' => now()->subMinute()]);

    app(GameLifecycleService::class)->startGame($game->fresh());

    $game->refresh();
    expect($game->status)->toBe('active');

    $round = Round::where('game_id', $game->id)->sole();
    expect($round->round_number)->toBe(1);
    expect($round->target_user_id)->not->toBe($admin->id);
    expect(in_array($round->target_user_id, [$second->id, $third->id]))->toBeTrue();

    expect($game->participants()->where('user_id', $admin->id)->value('player_number'))->toBe(1);
    expect($game->participants()->where('user_id', $second->id)->value('player_number'))->toBe(2);
    expect($game->participants()->where('user_id', $third->id)->value('player_number'))->toBe(3);
});

test('starting a game with fewer than 2 participants throws', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    expect(fn () => app(GameLifecycleService::class)->startGame($game->fresh()))
        ->toThrow(RuntimeException::class, 'Need at least 2 participants to start the game');
});

test('POST /games/{game}/start is admin-only', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/start");

    $response->assertForbidden();
    expect($game->fresh()->status)->toBe('waiting');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=StartGameTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement `startGame`**

Add to `GameLifecycleService`:

```php
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
```

- [ ] **Step 4: Add the controller action, route, and authorization**

Add to `GamePolicy`:

```php
public function manage(User $user, Game $game): bool
{
    return $game->admin_id === $user->id;
}
```

Add to `GameController`:

```php
public function start(\App\Models\Game $game): \Illuminate\Http\RedirectResponse
{
    $this->authorize('manage', $game);

    $this->lifecycle->startGame($game);
    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/start', [GameController::class, 'start'])->name('games.start');
```

- [ ] **Step 5: Update `GameResource::currentRound`**

Replace the placeholder line in `GameResource::toArray`:

```php
'currentRound' => $currentRound ? [
    'roundNumber' => $currentRound->round_number,
    'targetUserId' => $currentRound->target_user_id,
    'targetUserName' => $currentRound->target->name,
    'commentsVisible' => $currentRound->comments_visible,
    'pointsGiven' => $currentRound->points_given,
    'guessesFinalized' => $currentRound->guesses_finalized,
    'targetPoints' => $currentRound->target_points,
    'targetCorrectGuesses' => $currentRound->target_correct_guesses,
    'comments' => $currentRound->comments()->with('author')->get()->map(fn ($c) => [
        'id' => $c->id,
        'authorId' => $currentRound->comments_visible ? $c->author_id : null,
        'text' => $c->text,
        'points' => $c->points,
    ]),
] : null,
```

Also change the resource's constructor usage in `GameController::show` and `start` to eager-load `rounds.comments`:

```php
$game->load(['participants.user', 'scores', 'guessResults', 'rounds.comments', 'rounds.target']);
```

Note `authorId` is withheld (`null`) until `commentsVisible` is true — comments must stay anonymous until the admin reveals them, matching `docs/game-mechanics.md`'s "Comments are stored with an author ID but displayed without attribution" rule. This is enforced server-side here (never sent to the client at all pre-reveal), which is strictly stronger than the original Firestore version's client-side-only omission.

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=StartGameTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Services/GameLifecycleService.php app/Http/Resources/GameResource.php app/Http/Controllers/GameController.php app/Policies/GamePolicy.php routes/web.php tests/Feature/StartGameTest.php
git commit -m "Add GameLifecycleService::startGame"
```

---

### Task 12: `CommentPhaseService::submitComment`

**Files:**
- Create: `laravel/app/Services/CommentPhaseService.php`
- Create: `laravel/app/Http/Controllers/Mirror/CommentController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/SubmitCommentTest.php`

**Interfaces:**
- Consumes: `Round`/`Comment` (Task 5).
- Produces: `App\Services\CommentPhaseService::submitComment(Round $round, User $author, string $text): Comment` — ported from `GameContext.tsx:736-797`: rejects the target commenting about themselves (`"You cannot comment about yourself"`), empty text (`"Comment cannot be empty"`), text over 500 chars (`"Comment must be 500 characters or fewer"`), and a second comment from the same author in the same round (`"You have already submitted a comment for this round"` — enforced here by the `comments` table's `[round_id, author_id]` unique constraint from Task 5 plus an explicit pre-check for a clean error message rather than a DB-constraint exception). `POST /games/{game}/comments` route.

- [ ] **Step 1: Write the failing feature test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

function makeActiveGame(): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id]);

    return compact('game', 'admin', 'target', 'author', 'round');
}

test('a participant can submit one comment about the target', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    $comment = app(CommentPhaseService::class)->submitComment($round, $author, 'You are very observant.');

    expect($comment->text)->toBe('You are very observant.');
    expect($comment->author_id)->toBe($author->id);
    expect($comment->round_id)->toBe($round->id);
});

test('the target cannot comment about themselves', function () {
    ['target' => $target, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $target, 'Hi'))
        ->toThrow(RuntimeException::class, 'You cannot comment about yourself');
});

test('a comment over 500 characters is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, str_repeat('a', 501)))
        ->toThrow(RuntimeException::class, 'Comment must be 500 characters or fewer');
});

test('an empty comment is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, '   '))
        ->toThrow(RuntimeException::class, 'Comment cannot be empty');
});

test('a second comment from the same author in the same round is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();
    app(CommentPhaseService::class)->submitComment($round, $author, 'First comment');

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, 'Second comment'))
        ->toThrow(RuntimeException::class, 'You have already submitted a comment for this round');
});

test('POST comments route stores a comment for the current round', function () {
    ['game' => $game, 'author' => $author, 'round' => $round] = makeActiveGame();

    $response = $this->actingAs($author)->post("/games/{$game->id}/comments", ['text' => 'Great teammate.']);

    $response->assertRedirect("/games/{$game->id}");
    expect(Comment::where('round_id', $round->id)->where('author_id', $author->id)->exists())->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=SubmitCommentTest`
Expected: FAIL — class doesn't exist

- [ ] **Step 3: Implement the service**

```php
<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Round;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CommentPhaseService
{
    public function submitComment(Round $round, User $author, string $text): Comment
    {
        if ($author->id === $round->target_user_id) {
            throw new RuntimeException('You cannot comment about yourself');
        }

        $trimmed = trim($text);
        if ($trimmed === '') {
            throw new RuntimeException('Comment cannot be empty');
        }
        if (mb_strlen($trimmed) > 500) {
            throw new RuntimeException('Comment must be 500 characters or fewer');
        }

        return DB::transaction(function () use ($round, $author, $trimmed) {
            if ($round->comments()->where('author_id', $author->id)->exists()) {
                throw new RuntimeException('You have already submitted a comment for this round');
            }

            return Comment::create([
                'round_id' => $round->id,
                'author_id' => $author->id,
                'text' => $trimmed,
            ]);
        });
    }
}
```

- [ ] **Step 4: Implement the controller and route**

```php
<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\CommentPhaseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    public function __construct(private CommentPhaseService $comments)
    {
    }

    public function store(Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate(['text' => ['required', 'string']]);

        $round = $game->rounds()->latest('round_number')->firstOrFail();

        try {
            $this->comments->submitComment($round, $request->user(), $validated['text']);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['text' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
```

Add to `routes/web.php`:

```php
use App\Http\Controllers\Mirror\CommentController;

Route::post('games/{game}/comments', [CommentController::class, 'store'])->name('games.comments.store');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=SubmitCommentTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/CommentPhaseService.php app/Http/Controllers/Mirror/CommentController.php routes/web.php tests/Feature/SubmitCommentTest.php
git commit -m "Add CommentPhaseService::submitComment"
```

---

### Task 13: `CommentPhaseService::showComments`

**Files:**
- Modify: `laravel/app/Services/CommentPhaseService.php`
- Create: `laravel/app/Http/Controllers/Mirror/RoundController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/ShowCommentsTest.php`

**Interfaces:**
- Consumes: `CommentPhaseService` (Task 12).
- Produces: `CommentPhaseService::showComments(Round $round): void` — sets `comments_visible = true`. `POST /games/{game}/show-comments` route, admin-only (`GameContext.tsx:799-821`).

- [ ] **Step 1: Write the failing feature test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('showComments marks the round comments visible', function () {
    $round = Round::factory()->create();

    app(CommentPhaseService::class)->showComments($round);

    expect($round->fresh()->comments_visible)->toBeTrue();
});

test('POST show-comments is admin-only', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/show-comments");

    $response->assertForbidden();
});

test('admin can reveal comments', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 1]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/show-comments");

    $response->assertRedirect("/games/{$game->id}");
    expect($round->fresh()->comments_visible)->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ShowCommentsTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the service method**

Add to `CommentPhaseService`:

```php
public function showComments(Round $round): void
{
    $round->update(['comments_visible' => true]);
}
```

- [ ] **Step 4: Implement the controller and route**

```php
<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\CommentPhaseService;
use Illuminate\Http\RedirectResponse;

class RoundController extends Controller
{
    public function __construct(private CommentPhaseService $comments)
    {
    }

    public function showComments(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        $round = $game->rounds()->latest('round_number')->firstOrFail();
        $this->comments->showComments($round);
        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
```

Add to `routes/web.php`:

```php
use App\Http\Controllers\Mirror\RoundController;

Route::post('games/{game}/show-comments', [RoundController::class, 'showComments'])->name('games.show-comments');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=ShowCommentsTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/CommentPhaseService.php app/Http/Controllers/Mirror/RoundController.php routes/web.php tests/Feature/ShowCommentsTest.php
git commit -m "Add CommentPhaseService::showComments"
```

---

### Task 14: `CommentPhaseService::awardCommentPoints` and `finishAwardingPoints`

**Files:**
- Modify: `laravel/app/Services/CommentPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/CommentController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/AwardCommentPointsTest.php`

**Interfaces:**
- Consumes: `CommentPhaseService` (Task 12), `GameScore::incrementFor` (Task 6).
- Produces: `CommentPhaseService::awardCommentPoints(Comment $comment, User $target, int $points): void` — only the round's target may award (`"Only the target person can give points"`, `GameContext.tsx:823-883`), repeatable across multiple comments in the same round, adds `$points` to the comment author's `GameScore`. `CommentPhaseService::finishAwardingPoints(Round $round, User $target): void` — only the target (`"Only the target can finish giving points"`, `GameContext.tsx:885-924`), sets `points_given = true`. `POST /games/{game}/comment-points/{comment}` and `POST /games/{game}/finish-awarding-points` routes.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('the target can award points to a comment author, accumulating across multiple comments', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment1 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $author2 = User::factory()->create();
    $comment2 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author2->id]);

    app(CommentPhaseService::class)->awardCommentPoints($comment1, $target, 3);
    app(CommentPhaseService::class)->awardCommentPoints($comment2, $target, 2);

    expect($comment1->fresh()->points)->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author->id)->value('points'))->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author2->id)->value('points'))->toBe(2);
});

test('only the target can award comment points', function () {
    $round = Round::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id]);
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->awardCommentPoints($comment, $someoneElse, 1))
        ->toThrow(RuntimeException::class, 'Only the target person can give points');
});

test('only the target can finish awarding points', function () {
    $round = Round::factory()->create();
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->finishAwardingPoints($round, $someoneElse))
        ->toThrow(RuntimeException::class, 'Only the target can finish giving points');
});

test('finishAwardingPoints marks the round pointsGiven', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id]);

    app(CommentPhaseService::class)->finishAwardingPoints($round, $target);

    expect($round->fresh()->points_given)->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AwardCommentPointsTest`
Expected: FAIL — methods don't exist

- [ ] **Step 3: Implement both methods**

Add to `CommentPhaseService` (needs `use App\Models\GameScore;` and `use App\Models\Round;` added to the file's imports):

```php
public function awardCommentPoints(Comment $comment, User $target, int $points): void
{
    $round = $comment->round;
    if ($target->id !== $round->target_user_id) {
        throw new RuntimeException('Only the target person can give points');
    }

    DB::transaction(function () use ($comment, $round, $points) {
        $comment->update(['points' => $points]);
        GameScore::incrementFor($round->game, $comment->author, $points);
    });
}

public function finishAwardingPoints(Round $round, User $target): void
{
    if ($target->id !== $round->target_user_id) {
        throw new RuntimeException('Only the target can finish giving points');
    }

    $round->update(['points_given' => true]);
}
```

- [ ] **Step 4: Add controller actions and routes**

Add to `CommentController`:

```php
public function awardPoints(Request $request, Game $game, \App\Models\Comment $comment): RedirectResponse
{
    $this->authorize('view', $game);
    $validated = $request->validate(['points' => ['required', 'integer', 'min:0']]);

    try {
        $this->comments->awardCommentPoints($comment, $request->user(), $validated['points']);
    } catch (\RuntimeException $e) {
        abort(403, $e->getMessage());
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}

public function finishAwarding(Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $round = $game->rounds()->latest('round_number')->firstOrFail();

    try {
        $this->comments->finishAwardingPoints($round, $request->user());
    } catch (\RuntimeException $e) {
        abort(403, $e->getMessage());
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/comment-points/{comment}', [CommentController::class, 'awardPoints'])->name('games.comment-points');
Route::post('games/{game}/finish-awarding-points', [CommentController::class, 'finishAwarding'])->name('games.finish-awarding-points');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=AwardCommentPointsTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/CommentPhaseService.php app/Http/Controllers/Mirror/CommentController.php routes/web.php tests/Feature/AwardCommentPointsTest.php
git commit -m "Add CommentPhaseService::awardCommentPoints and finishAwardingPoints"
```

---

### Task 15: `CommentPhaseService::givePointsToTarget` and `skipPostCommentPhase`

**Files:**
- Modify: `laravel/app/Services/CommentPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/CommentController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/GivePointsToTargetTest.php`

**Interfaces:**
- Consumes: `CommentPhaseService` (Task 12), `GameScore::incrementFor` (Task 6).
- Produces: `CommentPhaseService::givePointsToTarget(Round $round, User $giver, int $points = 1): void` — ported from `GameContext.tsx:926-998`, simplified to always target `$round->target_user_id` (the source's `targetUserId` parameter was always called with that same value — there is no call site that awards a different user, so the parameter is dropped rather than ported as dead flexibility). Throws `"You already gave points to this target this round"` on a repeat call from the same giver. Awards `$points` to the target's `GameScore` **and** records the giver in the round's post-comment-phase completion list (this dual effect — awarding *and* completing — is exactly what the source's transaction does at `GameContext.tsx:981-987`, not a simplification). `CommentPhaseService::skipPostCommentPhase(Round $round, User $skipper): void` — ported from `GameContext.tsx:2172-2202`: requires `points_given` already true, rejects the target itself, rejects a repeat call. Both routes: `POST /games/{game}/target-points` and `POST /games/{game}/skip-post-comment-phase`.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('a participant can give the target bonus points once per round', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $giver = User::factory()->create();

    app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 2);

    expect(GameScore::where('game_id', $game->id)->where('user_id', $target->id)->value('points'))->toBe(2);
    expect($round->fresh()->target_points)->toBe(2);
    expect($round->fresh()->target_points_given_by)->toBe([(string) $giver->id]);
    expect($game->fresh()->players_who_completed_post_comment_phase)->toBe([(string) $giver->id]);
});

test('giving points twice in the same round from the same giver throws', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id]);
    $giver = User::factory()->create();
    app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 1);

    expect(fn () => app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 1))
        ->toThrow(RuntimeException::class, 'You already gave points to this target this round');
});

test('skipPostCommentPhase requires points_given to already be true', function () {
    $round = Round::factory()->create(['points_given' => false]);
    $skipper = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->skipPostCommentPhase($round, $skipper))
        ->toThrow(RuntimeException::class, 'Target has not finished giving points yet');
});

test('the target cannot skip their own post-comment phase', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id, 'points_given' => true]);

    expect(fn () => app(CommentPhaseService::class)->skipPostCommentPhase($round, $target))
        ->toThrow(RuntimeException::class, 'Target cannot skip this phase');
});

test('a participant can skip the post-comment phase once', function () {
    $game = Game::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'points_given' => true]);
    $skipper = User::factory()->create();

    app(CommentPhaseService::class)->skipPostCommentPhase($round, $skipper);

    expect($game->fresh()->players_who_completed_post_comment_phase)->toBe([(string) $skipper->id]);
});
```

Note the `(string) $giver->id` casts: JSON arrays of user IDs are compared as strings throughout this port (Firestore's `arrayUnion` stored string UIDs) — store IDs as strings in these JSON columns for consistency with how they're compared (`in_array($userId, ...)` checks below), even though the underlying `user_id` foreign keys are integers.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GivePointsToTargetTest`
Expected: FAIL — methods don't exist

- [ ] **Step 3: Implement both methods**

Add to `CommentPhaseService` (needs `use App\Models\Game;` added):

```php
public function givePointsToTarget(Round $round, User $giver, int $points = 1): void
{
    $alreadyGiven = in_array((string) $giver->id, $round->target_points_given_by ?? [], true);
    if ($alreadyGiven) {
        throw new RuntimeException('You already gave points to this target this round');
    }

    DB::transaction(function () use ($round, $giver, $points) {
        $round->update([
            'target_points' => $round->target_points + $points,
            'target_points_given_by' => [...($round->target_points_given_by ?? []), (string) $giver->id],
            'target_points_by_player' => [
                ...($round->target_points_by_player ?? []),
                (string) $giver->id => $points,
            ],
        ]);

        GameScore::incrementFor($round->game, $round->target, $points);

        $game = $round->game;
        $completed = $game->players_who_completed_post_comment_phase ?? [];
        if (! in_array((string) $giver->id, $completed, true)) {
            $game->update(['players_who_completed_post_comment_phase' => [...$completed, (string) $giver->id]]);
        }
    });
}

public function skipPostCommentPhase(Round $round, User $skipper): void
{
    if (! $round->points_given) {
        throw new RuntimeException('Target has not finished giving points yet');
    }

    $game = $round->game;
    $completed = $game->players_who_completed_post_comment_phase ?? [];

    if (in_array((string) $skipper->id, $completed, true)) {
        throw new RuntimeException('You have already completed this phase');
    }

    if ($skipper->id === $round->target_user_id) {
        throw new RuntimeException('Target cannot skip this phase');
    }

    $game->update(['players_who_completed_post_comment_phase' => [...$completed, (string) $skipper->id]]);
}
```

- [ ] **Step 4: Add controller actions and routes**

Add to `CommentController`:

```php
public function giveTargetPoints(Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $validated = $request->validate(['points' => ['sometimes', 'integer', 'min:1']]);
    $round = $game->rounds()->latest('round_number')->firstOrFail();

    try {
        $this->comments->givePointsToTarget($round, $request->user(), $validated['points'] ?? 1);
    } catch (\RuntimeException $e) {
        throw ValidationException::withMessages(['points' => $e->getMessage()]);
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}

public function skipPostCommentPhase(Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $round = $game->rounds()->latest('round_number')->firstOrFail();

    try {
        $this->comments->skipPostCommentPhase($round, $request->user());
    } catch (\RuntimeException $e) {
        throw ValidationException::withMessages(['phase' => $e->getMessage()]);
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/target-points', [CommentController::class, 'giveTargetPoints'])->name('games.target-points');
Route::post('games/{game}/skip-post-comment-phase', [CommentController::class, 'skipPostCommentPhase'])->name('games.skip-post-comment-phase');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=GivePointsToTargetTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/CommentPhaseService.php app/Http/Controllers/Mirror/CommentController.php routes/web.php tests/Feature/GivePointsToTargetTest.php
git commit -m "Add CommentPhaseService::givePointsToTarget and skipPostCommentPhase"
```

---

## Phase E: Guessing Phase

### Task 16: `GuessingPhaseService::startGuessingPhase`

**Files:**
- Create: `laravel/app/Services/GuessingPhaseService.php`
- Create: `laravel/app/Http/Controllers/Mirror/GuessingController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/StartGuessingPhaseTest.php`

**Interfaces:**
- Consumes: `Round`/`Game` (Tasks 4–5).
- Produces: `GuessingPhaseService::startGuessingPhase(Game $game): void` — admin-only, ported from the per-round branch of `GameContext.tsx:1313–1447` (`GameContext.tsx:1358-1413`); the legacy all-rounds-at-once branch (`GameContext.tsx:1415-1440`) is out of scope per this plan's Global Constraints. Gate: every non-target participant (and the admin too, if `admin_writes_comments`) must appear in `players_who_completed_post_comment_phase`, else throws `"Cannot start guessing phase. Waiting for N player(s) to complete the post-comment phase."` with the real count interpolated. Requires the current round to have `comments_visible && points_given`. On success: `round.single_round_guessing_active = true`, `round.guessing_possible_authors` = every participant's `{userId, userName}`, `round.guessing_players_submitted = []`, `round.guessing_all_submitted = false`, `game.status = 'guessing_phase'`. `POST /games/{game}/start-guessing` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

function makeRoundReadyForGuessing(): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'round_number' => 1,
        'target_user_id' => $target->id,
        'comments_visible' => true,
        'points_given' => true,
    ]);

    return compact('game', 'admin', 'target', 'author', 'round');
}

test('starting the guessing phase requires all non-target participants to have completed the post-comment phase', function () {
    ['game' => $game] = makeRoundReadyForGuessing();

    expect(fn () => app(GuessingPhaseService::class)->startGuessingPhase($game))
        ->toThrow(RuntimeException::class, 'Cannot start guessing phase. Waiting for 1 player(s) to complete the post-comment phase.');
});

test('starting the guessing phase succeeds once all non-target participants have completed the post-comment phase', function () {
    ['game' => $game, 'author' => $author, 'round' => $round] = makeRoundReadyForGuessing();
    $game->update(['players_who_completed_post_comment_phase' => [(string) $author->id]]);

    app(GuessingPhaseService::class)->startGuessingPhase($game->fresh());

    expect($game->fresh()->status)->toBe('guessing_phase');
    $round->refresh();
    expect($round->single_round_guessing_active)->toBeTrue();
    expect($round->guessing_players_submitted)->toBe([]);
    expect($round->guessing_all_submitted)->toBeFalse();
    expect(collect($round->guessing_possible_authors)->pluck('userId'))->toContain((string) $author->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=StartGuessingPhaseTest`
Expected: FAIL — class doesn't exist

- [ ] **Step 3: Implement the service**

```php
<?php

namespace App\Services;

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
}
```

- [ ] **Step 4: Add the controller and route**

```php
<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GuessingPhaseService;
use Illuminate\Http\RedirectResponse;

class GuessingController extends Controller
{
    public function __construct(private GuessingPhaseService $guessing)
    {
    }

    public function start(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        $this->guessing->startGuessingPhase($game);
        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
```

Add to `routes/web.php`:

```php
use App\Http\Controllers\Mirror\GuessingController;

Route::post('games/{game}/start-guessing', [GuessingController::class, 'start'])->name('games.start-guessing');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=StartGuessingPhaseTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuessingPhaseService.php app/Http/Controllers/Mirror/GuessingController.php routes/web.php tests/Feature/StartGuessingPhaseTest.php
git commit -m "Add GuessingPhaseService::startGuessingPhase"
```

---

### Task 17: `GuessingPhaseService::submitGuess`

**Files:**
- Modify: `laravel/app/Services/GuessingPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/GuessingController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/SubmitGuessTest.php`

**Interfaces:**
- Consumes: `GuessingPhaseService` (Task 16), `Guess` (Task 5).
- Produces: `GuessingPhaseService::submitGuess(Round $round, User $guesser, Comment $comment, User $guessedAuthor): Guess` — only the round's target may guess (`"Only the target can make guesses"`, `GameContext.tsx:1000-1177`), one guess per comment (enforced by the `guesses` table's `[comment_id, guesser_id]` unique constraint plus a pre-check for a clean error), increments `target_correct_guesses` when correct. When the guesser has now guessed on every comment in the round, marks them in `round.guessing_players_submitted` and computes `round.guessing_all_submitted` (true once the count reaches the number of possible-author entries the round was started with — always 1 for per-round guessing, since only the target guesses). `POST /games/{game}/guesses` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

function makeGuessableRound(int $commentCount = 1): array {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'target_user_id' => $target->id,
        'comments_visible' => true,
        'single_round_guessing_active' => true,
        'guessing_possible_authors' => [['userId' => (string) $target->id, 'userName' => $target->name]],
    ]);
    $comments = collect();
    for ($i = 0; $i < $commentCount; $i++) {
        $author = User::factory()->create();
        GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
        $comments->push(Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]));
    }

    return compact('game', 'target', 'round', 'comments');
}

test('the target can guess who wrote a comment, correctly', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();

    $guess = app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);

    expect($guess->correct)->toBeTrue();
    expect($round->fresh()->target_correct_guesses)->toBe(1);
});

test('an incorrect guess does not increment target_correct_guesses', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();
    $wrongGuy = User::factory()->create();

    $guess = app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $wrongGuy);

    expect($guess->correct)->toBeFalse();
    expect($round->fresh()->target_correct_guesses)->toBe(0);
});

test('only the target can submit guesses', function () {
    ['round' => $round, 'comments' => $comments] = makeGuessableRound();
    $someoneElse = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->submitGuess($round, $someoneElse, $comments->first(), $someoneElse))
        ->toThrow(RuntimeException::class, 'Only the target can make guesses');
});

test('guessing twice for the same comment throws', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();
    app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);

    expect(fn () => app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author))
        ->toThrow(RuntimeException::class, 'You already guessed for this comment');
});

test('once the target has guessed on every comment, they are marked submitted and all-submitted flips true', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound(2);

    foreach ($comments as $comment) {
        app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);
    }

    $round->refresh();
    expect($round->guessing_players_submitted)->toBe([(string) $target->id]);
    expect($round->guessing_all_submitted)->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=SubmitGuessTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement `submitGuess`**

Add to `GuessingPhaseService` (needs `use App\Models\Comment;` added):

```php
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
```

Note on `$totalTargets`: in per-round guessing only the round's target ever submits guesses, so this is always `1` — the `max(..., 1)` expression looks elaborate for a constant, but it's written this way deliberately to mirror the source's `targetCount > 0 ? targetCount : ...` shape (`GameContext.tsx:1128-1130`) so the rule reads the same in both codebases rather than silently collapsing to a magic `1`.

- [ ] **Step 4: Add the controller action and route**

Add to `GuessingController`:

```php
public function submitGuess(\Illuminate\Http\Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $validated = $request->validate([
        'comment_id' => ['required', 'integer'],
        'guessed_author_id' => ['required', 'integer'],
    ]);

    $round = $game->rounds()->latest('round_number')->firstOrFail();
    $comment = \App\Models\Comment::where('round_id', $round->id)->findOrFail($validated['comment_id']);
    $guessedAuthor = \App\Models\User::findOrFail($validated['guessed_author_id']);

    try {
        $this->guessing->submitGuess($round, $request->user(), $comment, $guessedAuthor);
    } catch (\RuntimeException $e) {
        throw \Illuminate\Validation\ValidationException::withMessages(['guess' => $e->getMessage()]);
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/guesses', [GuessingController::class, 'submitGuess'])->name('games.guesses.store');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=SubmitGuessTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuessingPhaseService.php app/Http/Controllers/Mirror/GuessingController.php routes/web.php tests/Feature/SubmitGuessTest.php
git commit -m "Add GuessingPhaseService::submitGuess"
```

---

### Task 18: `GuessingPhaseService::markPlayerGuessesSubmitted`

**Files:**
- Modify: `laravel/app/Services/GuessingPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/GuessingController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/MarkGuessesSubmittedTest.php`

**Interfaces:**
- Consumes: `GuessingPhaseService` (Tasks 16–17), `GameGuessResult` (Task 6).
- Produces: `GuessingPhaseService::markPlayerGuessesSubmitted(Game $game, Round $round, User $caller, ?User $player = null): void` — ported from `GameContext.tsx:1449-1522`. `$player` defaults to `$caller`; marking someone other than yourself requires being the admin (`"Only the admin can mark another player as submitted"`). This is the explicit "I'm done guessing" signal — it's what the UI calls even when a target has zero comments to guess on (there's nothing for `submitGuess`, Task 17, to auto-trigger from in that case), and it's the one place that (a) writes the permanent `GameGuessResult` for the player, recomputed as their total correct guesses across every round of the game, and (b) flips `game.post_guessing_point_phase = true` once every target-guesser for the round has been marked (always just the one player, per this plan's per-round-guessing scope). `POST /games/{game}/mark-guesses-submitted` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('marking yourself submitted records the recomputed correct-guess total and starts the post-guessing point phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'target_user_id' => $target->id,
        'single_round_guessing_active' => true,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    Guess::factory()->create([
        'round_id' => $round->id, 'comment_id' => $comment->id,
        'guesser_id' => $target->id, 'guessed_author_id' => $author->id, 'correct' => true,
    ]);

    app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $target);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $target->id)->value('correct_guesses'))->toBe(1);
    expect($game->fresh()->post_guessing_point_phase)->toBeTrue();
    expect($game->fresh()->players_who_awarded_post_guess_points)->toBe([]);
});

test('a non-admin cannot mark a different player as submitted', function () {
    $game = Game::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id]);
    $caller = User::factory()->create();
    $otherPlayer = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $caller, $otherPlayer))
        ->toThrow(RuntimeException::class, 'Only the admin can mark another player as submitted');
});

test('the admin can mark a different player as submitted', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $target = User::factory()->create();

    app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $admin, $target);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $target->id)->exists())->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=MarkGuessesSubmittedTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the method**

Add to `GuessingPhaseService` (needs `use App\Models\GameGuessResult;` and `use App\Models\Guess;` — the latter already imported by Task 17):

```php
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
```

- [ ] **Step 4: Add the controller action and route**

Add to `GuessingController`:

```php
public function markSubmitted(\Illuminate\Http\Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $validated = $request->validate(['player_id' => ['sometimes', 'integer']]);

    $round = $game->rounds()->latest('round_number')->firstOrFail();
    $player = isset($validated['player_id']) ? \App\Models\User::findOrFail($validated['player_id']) : null;

    try {
        $this->guessing->markPlayerGuessesSubmitted($game, $round, $request->user(), $player);
    } catch (\RuntimeException $e) {
        abort(403, $e->getMessage());
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/mark-guesses-submitted', [GuessingController::class, 'markSubmitted'])->name('games.mark-guesses-submitted');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=MarkGuessesSubmittedTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuessingPhaseService.php app/Http/Controllers/Mirror/GuessingController.php routes/web.php tests/Feature/MarkGuessesSubmittedTest.php
git commit -m "Add GuessingPhaseService::markPlayerGuessesSubmitted"
```

---

### Task 19: `GuessingPhaseService::awardPointsToPlayers`

**Files:**
- Modify: `laravel/app/Services/GuessingPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/GuessingController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/AwardPointsToPlayersTest.php`

**Interfaces:**
- Consumes: `GuessingPhaseService` (Tasks 16–18), `GameScore::incrementFor` (Task 6).
- Produces: `GuessingPhaseService::awardPointsToPlayers(Game $game, Round $round, User $awarder, array $awards): void` — ported from `GameContext.tsx:2094-2170`. `$awards` is a list of `['recipientId' => int, 'points' => int]`. Requires `game.post_guessing_point_phase` true, rejects a repeat call from the same awarder, rejects an empty award list (`"No awards specified"`), rejects self-awarding (`"You cannot award points to yourself"`). On success: increments each recipient's `GameScore`, records the awarder in `players_who_awarded_post_guess_points`, and appends a history entry per award into `game.admin_awards[awarderId]` (`recipientId`, `points`, `awardedBy`, `awardedAt`, `roundNumber`). `POST /games/{game}/post-guessing-awards` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('a player can award post-guessing bonus points to others', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 3]);
    $awarder = User::factory()->create();
    $recipient1 = User::factory()->create();
    $recipient2 = User::factory()->create();

    app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [
        ['recipientId' => $recipient1->id, 'points' => 2],
        ['recipientId' => $recipient2->id, 'points' => 1],
    ]);

    expect(GameScore::where('game_id', $game->id)->where('user_id', $recipient1->id)->value('points'))->toBe(2);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $recipient2->id)->value('points'))->toBe(1);
    expect($game->fresh()->players_who_awarded_post_guess_points)->toBe([(string) $awarder->id]);
    $history = $game->fresh()->admin_awards[(string) $awarder->id];
    expect($history)->toHaveCount(2);
    expect($history[0]['roundNumber'])->toBe(3);
});

test('awarding requires the post-guessing point phase to be active', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => false]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();
    $recipient = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'Post-guessing point phase is not active');
});

test('a player cannot award points to themselves', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $awarder->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'You cannot award points to yourself');
});

test('a player cannot award points twice in the same phase', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();
    $recipient = User::factory()->create();
    app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]);

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game->fresh(), $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'You have already awarded points in this phase');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AwardPointsToPlayersTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the method**

Add to `GuessingPhaseService` (needs `use App\Models\GameScore;` and `use App\Models\User;` — `User` already present):

```php
public function awardPointsToPlayers(Game $game, Round $round, User $awarder, array $awards): void
{
    if (! $game->post_guessing_point_phase) {
        throw new RuntimeException('Post-guessing point phase is not active');
    }

    $alreadyAwarded = $game->players_who_awarded_post_guess_points ?? [];
    if (in_array((string) $awarder->id, $alreadyAwarded, true)) {
        throw new RuntimeException('You have already awarded points in this phase');
    }

    if (count($awards) === 0) {
        throw new RuntimeException('No awards specified');
    }

    foreach ($awards as $award) {
        if ((int) $award['recipientId'] === $awarder->id) {
            throw new RuntimeException('You cannot award points to yourself');
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
```

- [ ] **Step 4: Add the controller action and route**

Add to `GuessingController`:

```php
public function awardPoints(\Illuminate\Http\Request $request, Game $game): RedirectResponse
{
    $this->authorize('view', $game);
    $validated = $request->validate([
        'awards' => ['required', 'array', 'min:1'],
        'awards.*.recipientId' => ['required', 'integer'],
        'awards.*.points' => ['required', 'integer', 'min:0'],
    ]);

    $round = $game->rounds()->latest('round_number')->firstOrFail();

    try {
        $this->guessing->awardPointsToPlayers($game, $round, $request->user(), $validated['awards']);
    } catch (\RuntimeException $e) {
        throw \Illuminate\Validation\ValidationException::withMessages(['awards' => $e->getMessage()]);
    }

    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/post-guessing-awards', [GuessingController::class, 'awardPoints'])->name('games.post-guessing-awards');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=AwardPointsToPlayersTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuessingPhaseService.php app/Http/Controllers/Mirror/GuessingController.php routes/web.php tests/Feature/AwardPointsToPlayersTest.php
git commit -m "Add GuessingPhaseService::awardPointsToPlayers"
```

---

### Task 20: `GuessingPhaseService::finalizeGuessingPhase`

**Files:**
- Modify: `laravel/app/Services/GuessingPhaseService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/GuessingController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/FinalizeGuessingPhaseTest.php`

**Interfaces:**
- Consumes: `GuessingPhaseService` (Tasks 16–19).
- Produces: `GuessingPhaseService::finalizeGuessingPhase(Game $game, Round $round): void` — admin-only, ported from the per-round branch of `GameContext.tsx:1524-1620` (`GameContext.tsx:1599-1613`; the legacy final/all-rounds branch at `GameContext.tsx:1589-1598` is out of scope, per this plan's Global Constraints). Stamps `round.guesses_finalized = true`, closes the round's guessing session (`round.single_round_guessing_active = false`), and returns `game.status` to `'active'` so `startNextRound` (Task 21) can pick the next target. Scores/guess-results were already written incrementally by `awardCommentPoints`/`givePointsToTarget`/`markPlayerGuessesSubmitted`, so this method does not recompute them — unlike the source's Firestore version, there's no "safe to overwrite" full recompute needed here because there was never a client-side optimistic write to reconcile against. `POST /games/{game}/finalize-guessing` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('finalizing the guessing phase closes the round and returns the game to active', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    $round = Round::factory()->create(['game_id' => $game->id, 'single_round_guessing_active' => true]);

    app(GuessingPhaseService::class)->finalizeGuessingPhase($game, $round);

    expect($round->fresh()->guesses_finalized)->toBeTrue();
    expect($round->fresh()->single_round_guessing_active)->toBeFalse();
    expect($game->fresh()->status)->toBe('active');
});

test('only the admin can finalize the guessing phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/finalize-guessing");

    $response->assertForbidden();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=FinalizeGuessingPhaseTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the method**

Add to `GuessingPhaseService`:

```php
public function finalizeGuessingPhase(Game $game, Round $round): void
{
    DB::transaction(function () use ($game, $round) {
        $round->update(['guesses_finalized' => true, 'single_round_guessing_active' => false]);
        $game->update(['status' => 'active']);
    });
}
```

- [ ] **Step 4: Add the controller action and route**

Add to `GuessingController`:

```php
public function finalize(Game $game): RedirectResponse
{
    $this->authorize('manage', $game);

    $round = $game->rounds()->latest('round_number')->firstOrFail();
    $this->guessing->finalizeGuessingPhase($game, $round);
    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/finalize-guessing', [GuessingController::class, 'finalize'])->name('games.finalize-guessing');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=FinalizeGuessingPhaseTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuessingPhaseService.php app/Http/Controllers/Mirror/GuessingController.php routes/web.php tests/Feature/FinalizeGuessingPhaseTest.php
git commit -m "Add GuessingPhaseService::finalizeGuessingPhase"
```

---

## Phase F: Round Cycling, Leaving, Settings, and Results

### Task 21: `GameLifecycleService::startNextRound`

**Files:**
- Modify: `laravel/app/Services/GameLifecycleService.php`
- Modify: `laravel/app/Http/Controllers/Mirror/RoundController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/StartNextRoundTest.php`

**Interfaces:**
- Consumes: `GameLifecycleService` (Tasks 8–9, 11).
- Produces: `GameLifecycleService::startNextRound(Game $game): void` — admin-only, ported from `GameContext.tsx:1180-1311`. Excludes everyone who has already been a target (`rounds.target_user_id`) and, if `admin_writes_comments` is false, excludes the admin too — this exclusion rule matches `startNextRound`'s own logic exactly (unlike Task 11's `startGame`, which always excludes the admin from round 1 regardless of the setting; both quirks are preserved, not reconciled, per the spec's "port behavior" stance). If no eligible participant remains, sets `game.status = 'finished'` and creates no new round. Otherwise picks the target by `target_selection_mode` (`'chronological'`: earliest `joined_at` among the eligible; `'random'`: otherwise), creates the next round with a fresh scores/guess-results snapshot taken from the *current* `game_scores`/`game_guess_results` rows (so the leaderboard can freeze on "how things stood when this round began" — this is what `roundStartScores`/`roundStartGuessResults` are for, `GameContext.tsx:1299-1303`), and resets `post_guessing_point_phase`, `players_who_awarded_post_guess_points`, `players_who_completed_post_comment_phase`. `admin_next_target_preference`/`admin_skipped_targets` (the admin round-tools fields) are read as always-empty in this plan — nothing populates them, since the routes that would (`setNextRoundTarget`, `skipNextRoundTarget`) are out of scope per this plan's Global Constraints; a future admin-round-tools plan wires them up without needing schema changes. `POST /games/{game}/next-round` route.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\GameLifecycleService;

function makeGameWithCompletedRound(bool $adminWritesComments = false, string $targetSelectionMode = 'random'): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id,
        'status' => 'active',
        'admin_writes_comments' => $adminWritesComments,
        'target_selection_mode' => $targetSelectionMode,
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id, 'joined_at' => now()->subMinutes(5)]);
    $round1Target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $round1Target->id, 'joined_at' => now()->subMinutes(4)]);
    $eligible = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $eligible->id, 'joined_at' => now()->subMinutes(3)]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1,
        'target_user_id' => $round1Target->id, 'comments_visible' => true, 'points_given' => true, 'guesses_finalized' => true,
    ]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $round1Target->id, 'points' => 4]);

    return compact('game', 'admin', 'round1Target', 'eligible');
}

test('starting the next round excludes past targets and the admin (when admin_writes_comments is false)', function () {
    ['game' => $game, 'admin' => $admin, 'round1Target' => $round1Target, 'eligible' => $eligible] = makeGameWithCompletedRound();

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->target_user_id)->toBe($eligible->id);
    expect($game->fresh()->status)->toBe('active');
});

test('startNextRound snapshots current scores onto the new round', function () {
    ['game' => $game, 'round1Target' => $round1Target] = makeGameWithCompletedRound();

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->start_scores_snapshot)->toBe([(string) $round1Target->id => 4]);
});

test('startNextRound resets post-guessing and post-comment tracking', function () {
    ['game' => $game] = makeGameWithCompletedRound();
    $game->update([
        'post_guessing_point_phase' => true,
        'players_who_awarded_post_guess_points' => ['1'],
        'players_who_completed_post_comment_phase' => ['1'],
    ]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $fresh = $game->fresh();
    expect($fresh->post_guessing_point_phase)->toBeFalse();
    expect($fresh->players_who_awarded_post_guess_points)->toBe([]);
    expect($fresh->players_who_completed_post_comment_phase)->toBe([]);
});

test('chronological mode picks the earliest-joined eligible participant', function () {
    ['game' => $game] = makeGameWithCompletedRound(targetSelectionMode: 'chronological');
    $earlier = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $earlier->id, 'joined_at' => now()->subMinutes(10)]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->target_user_id)->toBe($earlier->id);
});

test('when every participant has been a target, the game finishes instead of starting a new round', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $onlyTarget = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $onlyTarget->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $onlyTarget->id]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    expect($game->fresh()->status)->toBe('finished');
    expect(Round::where('game_id', $game->id)->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=StartNextRoundTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the method**

Add to `GameLifecycleService`:

```php
public function startNextRound(Game $game): void
{
    DB::transaction(function () use ($game) {
        $usedTargetIds = $game->rounds()->pluck('target_user_id')->all();

        $eligible = $game->participants()
            ->whereNotIn('user_id', $usedTargetIds)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->orderBy('joined_at')
            ->get();

        if ($eligible->isEmpty()) {
            $game->update(['status' => 'finished']);
            return;
        }

        $target = $game->target_selection_mode === 'chronological'
            ? $eligible->first()
            : $eligible->random();

        $scoresSnapshot = $game->scores()->get()->mapWithKeys(fn ($s) => [(string) $s->user_id => $s->points])->all();
        $guessResultsSnapshot = $game->guessResults()->get()->mapWithKeys(fn ($r) => [(string) $r->user_id => $r->correct_guesses])->all();

        Round::create([
            'game_id' => $game->id,
            'round_number' => $game->rounds()->count() + 1,
            'target_user_id' => $target->user_id,
            'started_at' => now(),
            'start_scores_snapshot' => $scoresSnapshot,
            'start_guess_results_snapshot' => $guessResultsSnapshot,
        ]);

        $game->update([
            'post_guessing_point_phase' => false,
            'players_who_awarded_post_guess_points' => [],
            'players_who_completed_post_comment_phase' => [],
        ]);
    });
}
```

- [ ] **Step 4: Add the controller action and route**

Add to `RoundController`:

```php
public function next(Game $game): RedirectResponse
{
    $this->authorize('manage', $game);

    app(\App\Services\GameLifecycleService::class)->startNextRound($game);
    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect("/games/{$game->id}");
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/next-round', [RoundController::class, 'next'])->name('games.next-round');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=StartNextRoundTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GameLifecycleService.php app/Http/Controllers/Mirror/RoundController.php routes/web.php tests/Feature/StartNextRoundTest.php
git commit -m "Add GameLifecycleService::startNextRound"
```

---

### Task 22: `GameLifecycleService::leaveGame` and the admin-left flow

**Files:**
- Modify: `laravel/app/Services/GameLifecycleService.php`
- Modify: `laravel/app/Http/Controllers/GameController.php`
- Modify: `laravel/routes/web.php`
- Modify: `laravel/resources/js/Pages/Game/Mirror/Waiting.vue` (or wherever `adminLeft` needs surfacing — this task only needs the prop to already exist, which `GameResource` provided back in Task 10)
- Test: `laravel/tests/Feature/LeaveGameTest.php`

**Interfaces:**
- Consumes: `GameLifecycleService` (Tasks 8–9, 11, 21).
- Produces: `GameLifecycleService::leaveGame(Game $game, User $user): void` — ported from `GameContext.tsx:601-654` and documented in `docs/game-mechanics.md`'s "Admin-Less Flow". Removes the user's `GameParticipant` row. If the leaving user is the admin: `game.status = 'finished'`, `game.admin_left = true`, `game.admin_next_target_preference = null`, `game.players_who_completed_post_comment_phase = []`. There is no relational equivalent of the source's `currentRound: null` write (that field doesn't exist here — "current round" is derived from the latest `rounds` row, and old round rows are kept as history regardless of how the game ended), so it's intentionally not ported. `POST /games/{game}/leave` route — any participant, not just the admin.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use App\Services\GameLifecycleService;

test('a non-admin participant leaving just removes their participant row', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    app(GameLifecycleService::class)->leaveGame($game, $player);

    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $player->id)->exists())->toBeFalse();
    expect($game->fresh()->status)->toBe('active');
    expect($game->fresh()->admin_left)->toBeFalse();
});

test('the admin leaving finishes the game and flags admin_left', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'active',
        'admin_next_target_preference' => null,
        'players_who_completed_post_comment_phase' => ['1'],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    app(GameLifecycleService::class)->leaveGame($game, $admin);

    $fresh = $game->fresh();
    expect($fresh->status)->toBe('finished');
    expect($fresh->admin_left)->toBeTrue();
    expect($fresh->players_who_completed_post_comment_phase)->toBe([]);
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $admin->id)->exists())->toBeFalse();
});

test('POST leave removes the caller and redirects home', function () {
    $game = Game::factory()->create();
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    $response = $this->actingAs($player)->post("/games/{$game->id}/leave");

    $response->assertRedirect('/dashboard');
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $player->id)->exists())->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=LeaveGameTest`
Expected: FAIL — method doesn't exist

- [ ] **Step 3: Implement the method**

Add to `GameLifecycleService`:

```php
public function leaveGame(Game $game, User $user): void
{
    DB::transaction(function () use ($game, $user) {
        $game->participants()->where('user_id', $user->id)->delete();

        if ($game->admin_id === $user->id) {
            $game->update([
                'status' => 'finished',
                'admin_left' => true,
                'admin_next_target_preference' => null,
                'players_who_completed_post_comment_phase' => [],
            ]);
        }
    });
}
```

- [ ] **Step 4: Add the controller action and route**

Add to `GameController`:

```php
public function leave(Request $request, \App\Models\Game $game): RedirectResponse
{
    $this->authorize('view', $game);

    $this->lifecycle->leaveGame($game, $request->user());
    broadcast(new \App\Events\GameUpdated($game->id));

    return redirect('/dashboard');
}
```

Add to `routes/web.php`:

```php
Route::post('games/{game}/leave', [GameController::class, 'leave'])->name('games.leave');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=LeaveGameTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GameLifecycleService.php app/Http/Controllers/GameController.php routes/web.php tests/Feature/LeaveGameTest.php
git commit -m "Add GameLifecycleService::leaveGame and the admin-left flow"
```

---

### Task 23: Settings update endpoints

**Files:**
- Create: `laravel/app/Services/GameSettingsService.php`
- Create: `laravel/app/Http/Controllers/Mirror/SettingsController.php`
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/UpdateSettingsTest.php`

**Interfaces:**
- Consumes: `Game` (Task 4).
- Produces: `App\Services\GameSettingsService` with one method per setting — `updateAdminWritesComments`, `updateShowSurnames`, `updateTargetSelectionMode`, `updateShowGuessResults` — each `(Game $game, User $caller, $value): void`, admin-only, and only while `status === 'waiting'` (`"This setting can only be updated before the game starts"`, ported from `GameContext.tsx:1714-1740`'s pattern, which the other three setters in the same file follow identically). Routes: `POST /games/{game}/settings/admin-writes-comments`, `.../show-surnames`, `.../target-selection-mode`, `.../show-guess-results`.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

use App\Models\Game;
use App\Models\User;
use App\Services\GameSettingsService;

test('the admin can update settings while the game is waiting', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);

    $service = app(GameSettingsService::class);
    $service->updateAdminWritesComments($game, $admin, true);
    $service->updateShowSurnames($game->fresh(), $admin, true);
    $service->updateTargetSelectionMode($game->fresh(), $admin, 'chronological');
    $service->updateShowGuessResults($game->fresh(), $admin, true);

    $fresh = $game->fresh();
    expect($fresh->admin_writes_comments)->toBeTrue();
    expect($fresh->show_surnames)->toBeTrue();
    expect($fresh->target_selection_mode)->toBe('chronological');
    expect($fresh->show_guess_results)->toBeTrue();
});

test('settings cannot be changed once the game has started', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);

    expect(fn () => app(GameSettingsService::class)->updateAdminWritesComments($game, $admin, true))
        ->toThrow(RuntimeException::class, 'This setting can only be updated before the game starts');
});

test('only the admin can update settings', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    $other = User::factory()->create();

    expect(fn () => app(GameSettingsService::class)->updateAdminWritesComments($game, $other, true))
        ->toThrow(RuntimeException::class, 'Only the admin can update this setting');
});

test('POST settings route updates target selection mode', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    \App\Models\GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/settings/target-selection-mode", ['value' => 'chronological']);

    $response->assertRedirect("/games/{$game->id}");
    expect($game->fresh()->target_selection_mode)->toBe('chronological');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=UpdateSettingsTest`
Expected: FAIL — class doesn't exist

- [ ] **Step 3: Implement the service**

```php
<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use RuntimeException;

class GameSettingsService
{
    public function updateAdminWritesComments(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['admin_writes_comments' => $value]);
    }

    public function updateShowSurnames(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['show_surnames' => $value]);
    }

    public function updateTargetSelectionMode(Game $game, User $caller, string $value): void
    {
        $this->update($game, $caller, ['target_selection_mode' => $value]);
    }

    public function updateShowGuessResults(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['show_guess_results' => $value]);
    }

    private function update(Game $game, User $caller, array $attributes): void
    {
        if ($caller->id !== $game->admin_id) {
            throw new RuntimeException('Only the admin can update this setting');
        }

        if ($game->status !== 'waiting') {
            throw new RuntimeException('This setting can only be updated before the game starts');
        }

        $game->update($attributes);
    }
}
```

- [ ] **Step 4: Implement the controller and routes**

```php
<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GameSettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function __construct(private GameSettingsService $settings)
    {
    }

    public function adminWritesComments(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateAdminWritesComments($game, $request->user(), (bool) $v));
    }

    public function showSurnames(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateShowSurnames($game, $request->user(), (bool) $v));
    }

    public function targetSelectionMode(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateTargetSelectionMode($game, $request->user(), $v));
    }

    public function showGuessResults(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateShowGuessResults($game, $request->user(), (bool) $v));
    }

    private function apply(Request $request, Game $game, string $field, callable $fn): RedirectResponse
    {
        $validated = $request->validate([$field => ['required']]);

        try {
            $fn($validated[$field]);
        } catch (\RuntimeException $e) {
            abort(403, $e->getMessage());
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
```

Add to `routes/web.php`:

```php
use App\Http\Controllers\Mirror\SettingsController;

Route::post('games/{game}/settings/admin-writes-comments', [SettingsController::class, 'adminWritesComments'])->name('games.settings.admin-writes-comments');
Route::post('games/{game}/settings/show-surnames', [SettingsController::class, 'showSurnames'])->name('games.settings.show-surnames');
Route::post('games/{game}/settings/target-selection-mode', [SettingsController::class, 'targetSelectionMode'])->name('games.settings.target-selection-mode');
Route::post('games/{game}/settings/show-guess-results', [SettingsController::class, 'showGuessResults'])->name('games.settings.show-guess-results');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=UpdateSettingsTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Services/GameSettingsService.php app/Http/Controllers/Mirror/SettingsController.php routes/web.php tests/Feature/UpdateSettingsTest.php
git commit -m "Add Mirror settings update endpoints"
```

---

### Task 24: Leaderboard shaping in `GameResource`

**Files:**
- Modify: `laravel/app/Http/Resources/GameResource.php`
- Create: `laravel/resources/js/Pages/Game/Mirror/Results.vue`
- Test: `laravel/tests/Feature/LeaderboardTest.php`

**Interfaces:**
- Consumes: `GameResource` (Task 10), `GameScore`/`GameGuessResult` (Task 6), `Round::start_scores_snapshot`/`start_guess_results_snapshot` (Task 5/21).
- Produces: `GameResource` gains a `leaderboard` array — ported from `ResultsPage.tsx:1-31`. While the game is not `finished`, the leaderboard is computed from the *current round's* `start_scores_snapshot`/`start_guess_results_snapshot` if one exists (falling back to live `scores`/`guessResults` when there's no round yet), so in-progress-round scoring stays hidden until the round ends — exactly the freeze behavior `roundStartScores` exists for. Once `finished`, it uses live scores. Each entry: `userId`, `name`, `gamePoints`, `guessPoints`, `totalPoints`, sorted by `totalPoints` descending.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('leaderboard freezes on the current round\'s start snapshot while a round is in progress', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create(['name' => 'Player One']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    // Round begins with a frozen snapshot of 5 points for the player...
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $player->id,
        'start_scores_snapshot' => [(string) $player->id => 5],
        'start_guess_results_snapshot' => [],
    ]);
    // ...but live scores have since moved to 9 (mid-round awards not yet reflected in the leaderboard).
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 9]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard.0.userId', $player->id)
        ->where('game.leaderboard.0.gamePoints', 5)
    );
});

test('leaderboard shows live scores once the game is finished', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'finished']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 9]);
    GameGuessResult::create(['game_id' => $game->id, 'user_id' => $player->id, 'correct_guesses' => 2]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard.0.userId', $player->id)
        ->where('game.leaderboard.0.gamePoints', 9)
        ->where('game.leaderboard.0.guessPoints', 2)
        ->where('game.leaderboard.0.totalPoints', 11)
    );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=LeaderboardTest`
Expected: FAIL — `game.leaderboard` prop missing

- [ ] **Step 3: Implement the leaderboard computation**

Add to `GameResource::toArray`, right before the closing `return`'s array (needs the already-loaded `$currentRound` variable from Task 11's edit, and `$this->scores`/`$this->guessResults` collections already loaded in `GameController::show`):

```php
$liveScores = $this->scores->mapWithKeys(fn ($s) => [(string) $s->user_id => $s->points]);
$liveGuessResults = $this->guessResults->mapWithKeys(fn ($r) => [(string) $r->user_id => $r->correct_guesses]);

$displayedScores = $this->status === 'finished'
    ? $liveScores
    : collect($currentRound?->start_scores_snapshot ?? $liveScores->all());
$displayedGuessResults = $this->status === 'finished'
    ? $liveGuessResults
    : collect($currentRound?->start_guess_results_snapshot ?? $liveGuessResults->all());

$leaderboard = $this->participants->map(function ($p) use ($displayedScores, $displayedGuessResults) {
    $gamePoints = (int) ($displayedScores[(string) $p->user_id] ?? 0);
    $guessPoints = (int) ($displayedGuessResults[(string) $p->user_id] ?? 0);
    return [
        'userId' => $p->user_id,
        'name' => $p->user->name,
        'gamePoints' => $gamePoints,
        'guessPoints' => $guessPoints,
        'totalPoints' => $gamePoints + $guessPoints,
    ];
})->sortByDesc('totalPoints')->values();
```

Add `'leaderboard' => $leaderboard,` to the returned array.

- [ ] **Step 4: Add the Results.vue phase page and wire it into `Show.vue`**

`laravel/resources/js/Pages/Game/Mirror/Results.vue`:

```vue
<script setup>
defineProps({ game: Object });
</script>

<template>
    <div class="p-6">
        <h1 class="text-xl font-bold">Leaderboard</h1>
        <p v-if="game.adminLeft" class="text-red-600">The admin has left — this game has ended.</p>
        <ol>
            <li v-for="(entry, i) in game.leaderboard" :key="entry.userId">
                {{ i + 1 }}. {{ entry.name }} — {{ entry.totalPoints }} pts
                ({{ entry.gamePoints }} game + {{ entry.guessPoints }} guess)
            </li>
        </ol>
    </div>
</template>
```

Update `Show.vue`'s `phaseComponent` computed to route on status:

```vue
<script setup>
import { computed } from 'vue';
import Waiting from './Mirror/Waiting.vue';
import Results from './Mirror/Results.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    if (props.game.status === 'finished') return Results;
    return Waiting;
    // 'active' and 'guessing_phase' route to Active.vue / Guessing.vue, added in later tasks
    // of this same phase (not shown here to keep this task's diff focused on the leaderboard).
});
</script>

<template>
    <component :is="phaseComponent" :game="game" />
</template>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=LeaderboardTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Http/Resources/GameResource.php resources/js/Pages/Game tests/Feature/LeaderboardTest.php
git commit -m "Add leaderboard shaping with round-start score freezing"
```

---

### Task 25: End-to-end real-time regression test and the Echo partial-reload listener

**Files:**
- Create: `laravel/tests/Feature/RealtimeBroadcastTest.php`
- Modify: `laravel/resources/js/Pages/Game/Show.vue`
- Verify: `laravel/resources/js/echo.js` (created by Task 2's `install:broadcasting --reverb`)

**Interfaces:**
- Consumes: `GameUpdated` (Task 2), the mutating actions from Tasks 11–23 (each already calls `broadcast(new GameUpdated($game->id))` inline — this task adds regression coverage that the wiring isn't accidentally dropped, plus the actual client-side subscription).
- Produces: a Pest test asserting `GameUpdated` is dispatched by every action route added so far. `Show.vue` subscribes to `private-game.{id}` and calls `router.reload({ only: ['game'] })` on receipt — the one client-side listener every phase page relies on for real-time updates, per the spec's Real-Time Strategy.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Events\GameUpdated;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Illuminate\Support\Facades\Event;

test('starting a game broadcasts GameUpdated', function () {
    Event::fake([GameUpdated::class]);
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $this->actingAs($admin)->post("/games/{$game->id}/start");

    Event::assertDispatched(GameUpdated::class, fn ($e) => $e->gameId === $game->id);
});

test('joining a game broadcasts GameUpdated', function () {
    Event::fake([GameUpdated::class]);
    $game = Game::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    Event::assertDispatched(GameUpdated::class, fn ($e) => $e->gameId === $game->id);
});
```

Note: `GameController::store` (create) does **not** broadcast — there's nobody else in the game yet to notify, so it's correctly excluded from this test.

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `php artisan test --filter=RealtimeBroadcastTest`
Expected: PASS already, since every action task added its own `broadcast(...)` call inline — this step exists to catch a regression, not introduce new behavior. If it fails, it means a broadcast call was missed in an earlier task; go back and add it to that controller action before continuing.

- [ ] **Step 3: Add the Echo subscription to `Show.vue`**

```vue
<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { router } from '@inertiajs/vue3';
import Waiting from './Mirror/Waiting.vue';
import Results from './Mirror/Results.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    if (props.game.status === 'finished') return Results;
    return Waiting;
});

let channel;
onMounted(() => {
    channel = window.Echo.private(`game.${props.game.id}`).listen('GameUpdated', () => {
        router.reload({ only: ['game'] });
    });
});
onUnmounted(() => {
    window.Echo.leave(`game.${props.game.id}`);
});
</script>

<template>
    <component :is="phaseComponent" :game="game" />
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=RealtimeBroadcastTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/RealtimeBroadcastTest.php resources/js/Pages/Game/Show.vue
git commit -m "Add real-time broadcast regression coverage and the Echo partial-reload listener"
```

---

### Task 26: Rules page and a full-flow end-to-end test

**Files:**
- Create: `laravel/resources/js/Pages/Rules.vue`
- Modify: `laravel/app/Http/Controllers/GameController.php` (or a new `RulesController` — a single static page doesn't need a service, so a plain closure route is simplest)
- Modify: `laravel/routes/web.php`
- Test: `laravel/tests/Feature/MirrorFullRoundTripTest.php`

**Interfaces:**
- Consumes: every service from Tasks 8–23.
- Produces: `GET /rules` rendering a static Inertia page with the ported copy from `apps/web/src/pages/RulesPage.tsx` (Variation A only — Variations B/C are documented in the source as describing unimplemented modes, so the port carries the same "Telescope" description without the unimplemented Basket/Basket-Exchange copy). One Pest feature test walking the entire Mirror round trip through real HTTP requests, exercising every task in this plan together.

- [ ] **Step 1: Write the failing end-to-end test**

```php
<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\User;

test('a full Mirror round trip: create, join, start, comment, award, guess, and finish the round', function () {
    config(['game.admin_password' => 'secret-123']);

    $admin = User::factory()->create();
    $target = User::factory()->create();
    $author = User::factory()->create();

    // Create
    $this->actingAs($admin)->post('/games', ['password' => 'secret-123'])->assertRedirect();
    $game = Game::first();

    // Join
    $this->actingAs($target)->post('/games/join', ['code' => $game->code])->assertRedirect();
    $this->actingAs($author)->post('/games/join', ['code' => $game->code])->assertRedirect();

    // Start — target selection is random among non-admin participants, so force determinism
    // by asserting on whichever of $target/$author was NOT picked as commenter vs target is
    // irrelevant to the test: submit the comment as whichever participant isn't the round's target.
    $this->actingAs($admin)->post("/games/{$game->id}/start")->assertRedirect();
    $round = $game->fresh()->rounds()->sole();
    $commenter = $round->target_user_id === $target->id ? $author : $target;

    // Comment phase
    $this->actingAs($commenter)->post("/games/{$game->id}/comments", ['text' => 'Always shows up early.'])->assertRedirect();
    $this->actingAs($admin)->post("/games/{$game->id}/show-comments")->assertRedirect();

    $comment = $round->fresh()->comments()->sole();
    $roundTarget = User::find($round->target_user_id);
    $this->actingAs($roundTarget)->post("/games/{$game->id}/comment-points/{$comment->id}", ['points' => 3])->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/finish-awarding-points")->assertRedirect();
    $this->actingAs($commenter)->post("/games/{$game->id}/target-points", ['points' => 1])->assertRedirect();

    // Guessing phase
    $this->actingAs($admin)->post("/games/{$game->id}/start-guessing")->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/guesses", [
        'comment_id' => $comment->id,
        'guessed_author_id' => $commenter->id,
    ])->assertRedirect();
    $this->actingAs($roundTarget)->post("/games/{$game->id}/mark-guesses-submitted")->assertRedirect();

    expect($game->fresh()->post_guessing_point_phase)->toBeTrue();

    $this->actingAs($admin)->post("/games/{$game->id}/finalize-guessing")->assertRedirect();

    expect($round->fresh()->guesses_finalized)->toBeTrue();
    expect($game->fresh()->status)->toBe('active');
    expect(GameScore::where('game_id', $game->id)->where('user_id', $commenter->id)->value('points'))->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $roundTarget->id)->value('points'))->toBe(1);

    // Next round finishes the game (only one eligible target existed)
    $this->actingAs($admin)->post("/games/{$game->id}/next-round")->assertRedirect();
    expect($game->fresh()->status)->toBe('finished');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=MirrorFullRoundTripTest`
Expected: Likely PASS already (every route it exercises was built and unit/feature-tested in its own task) — this test's job is to catch integration gaps between tasks, e.g. a route name mismatch or a resource field the Vue layer expects but the backend never sends. If it fails, fix the integration bug it surfaces before moving on; do not weaken the test to make it pass.

- [ ] **Step 3: Add the Rules page**

```vue
<script setup></script>

<template>
    <div class="prose mx-auto p-6">
        <h1>How In The Mirror Works</h1>
        <p>
            Everyone writes one anonymous comment about the round's target, then the target
            tries to guess who wrote each one. Points come from four places: the target
            rewarding good comments, players rewarding the target for a good reaction,
            correct guesses, and bonus points players give each other after guessing wraps up.
        </p>
        <h2>Roles</h2>
        <ul>
            <li><strong>Admin</strong> — creates the game and controls phase transitions.</li>
            <li><strong>Participant</strong> — joins by game code, writes comments, and (when they're the target) guesses.</li>
            <li><strong>Target</strong> — the player everyone is writing about this round; rotates every round.</li>
        </ul>
    </div>
</template>
```

Add to `routes/web.php`:

```php
Route::get('rules', fn () => inertia('Rules'))->name('rules');
```

- [ ] **Step 4: Run the full test suite**

Run: `php artisan test`
Expected: PASS — every test written across this plan passes together

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Rules.vue routes/web.php tests/Feature/MirrorFullRoundTripTest.php
git commit -m "Add the rules page and a full Mirror round-trip integration test"
```

---

## Self-Review

**Spec coverage:**
- Stack (Task 1–2), Auth incl. Google (Task 3) — covered.
- Data model, every table in the spec — covered (Tasks 4–6).
- Admin password gate (Task 8), real-time ping+reload strategy (Tasks 2, 25) — covered.
- Every route in the spec's "Routes & Pages" list — covered: `/games` (8), `/games/join` (9), `/games/{game}` (10), `start` (11), `comments` (12), `show-comments` (13), `comment-points`/`finish-awarding-points` (14), `target-points`/`skip-post-comment-phase` (15), `start-guessing` (16), `guesses` (17), `mark-guesses-submitted` (18), `post-guessing-awards` (19), `finalize-guessing` (20), `next-round` (21), settings routes (23), `/rules` (26). `leave` (Task 22) was added beyond the spec's literal route list because the spec's own "MirrorGameService" paragraph and its Goals (citing `docs/game-mechanics.md`'s "Admin-Less Flow" as in-scope) require it — this is spec-completion, not scope creep.
- Leaderboard/results (Task 24) — covered, folded into the game page per the spec's explicit direction not to add a separate `/results` route.
- Non-goals (Basket/Clash/Ideas, AdminCleanupPage, sound, QR join, functional showSurnames/showGuessResults gating) — none implemented, confirmed by absence across all 26 tasks.

**Placeholder scan:** no "TBD"/"TODO" in any task's code steps. The two spots that could look like placeholders are addressed inline: `GameCodeGenerator`'s word arrays instruct a verbatim copy (a real, mechanical action, not deferred logic) and `GameResource::currentRound`'s initial `null` in Task 10 is explicitly labeled as a real, correct value for that task's scope, replaced by real logic in Task 11's own step.

**Type consistency:** `Round::target_user_id`/`Comment::author_id`/`Guess::guesser_id`/`guessed_author_id` are `bigint` foreign keys throughout; JSON array columns storing user IDs (`target_points_given_by`, `players_who_completed_post_comment_phase`, `players_who_awarded_post_guess_points`, `guessing_players_submitted`) consistently store them as **strings** (cast via `(string) $id`) and are compared with `in_array($id, $arr, true)` using the same cast everywhere — Tasks 15, 17–19, 21–22 all follow this convention. `GameResource`'s `scores`/`guessResults`/leaderboard maps also key by string user ID for the same reason (`GameContext.tsx`'s own `[userId]: value` maps were always string-keyed, since Firestore field paths are strings).

---

**PLAN COMPLETE**
