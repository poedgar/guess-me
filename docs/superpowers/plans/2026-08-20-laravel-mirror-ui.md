# Laravel Mirror-Mode UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing, bilingual (Ukrainian/English) browser UI over the already-complete, already-tested Laravel Mirror-mode backend from phase 1 — every backend action becomes reachable from a real screen.

**Architecture:** A locale-resolution layer (session + per-user persistence) shares the active locale to every Inertia request; backend validation messages are translated via Laravel's `__()` at the point they're thrown, so they arrive at the client pre-translated; the Vue frontend uses `vue-i18n` seeded from the same shared locale for its own static copy. Six pages are built or completed: Login/Register (Google button), Dashboard (create/join form), and four Mirror-mode phase pages (Waiting, Active, Guessing, Results) that together cover every state in the backend's `waiting → active → guessing_phase → active → ... → finished` state machine.

**Tech Stack:** Laravel 13 (existing Breeze/Inertia/Vue 3 scaffold from phase 1), `vue-i18n`, Tailwind CSS (already present), Pest.

**Spec:** [docs/superpowers/specs/2026-08-20-laravel-mirror-ui-design.md](../specs/2026-08-20-laravel-mirror-ui-design.md)

## Global Constraints

- Translated copy (both languages) is **ported from `packages/shared/src/locales/{en,uk}.json`** wherever a matching concept exists — copy values verbatim, do not rewrite or "improve" them. Only write new Ukrainian text for concepts with no existing counterpart (mainly the specific backend validation-rule messages), and when doing so, use the vocabulary already established in that file (ціль = target, коментар = comment, нарахувати бали = award points, раунд = round, тощо) for consistency.
- No new backend endpoints beyond `POST /locale`. Every game page consumes the existing `GameResource` shape (extended in Task 6 of this plan) and existing routes from phase 1 — do not add new controller actions to the Mirror game flow itself.
- Visual design is idiomatic Tailwind for this app, not a pixel-copy of `apps/web`. Behavior and copy are ported; layout/styling is this app's own.
- No new Cypress/browser E2E — Pest feature/Inertia-prop tests only, consistent with phase 1's established testing boundary.
- Backend validation messages are translated via Laravel's `lang/en.json`/`lang/uk.json` + `__()`, keyed by the literal English string (Laravel's JSON translation convention) — not a custom key scheme.
- Every existing phase-1 route, service method name, and `GameResource` field name is unchanged by this plan except the additive `GameResource` fields Task 6 introduces. Don't rename anything from phase 1.

---

## Reference Material

- Full current `RuntimeException` message inventory (phase 1, all four services) — the exact strings Task 2 wraps in `__()`:
  `CommentPhaseService`: "You cannot comment about yourself", "Comments are already visible for this round", "Comment cannot be empty", "Comment must be 500 characters or fewer", "You have already submitted a comment for this round", "Only the target person can give points", "Points have already been awarded to this comment", "Only the target can finish giving points", "Target has not finished giving points yet" (used in two places), "You already gave points to this target this round", "You have already completed this phase", "Target cannot skip this phase".
  `GuessingPhaseService`: "Cannot start the guessing phase until comments have been shown and points have been awarded.", "Cannot start guessing phase. Waiting for {N} player(s) to complete the post-comment phase." (dynamic — becomes a `:count` placeholder), "Only the target can make guesses", "You already guessed for this comment", "Only the admin can mark another player as submitted", "Post-guessing point phase is not active", "You have already awarded points in this phase", "No awards specified", "You cannot award points to yourself".
  `GameLifecycleService`: "The game has already started", "Need at least 2 participants to start the game".
  `GameSettingsService`: "Only the admin can update this setting", "This setting can only be updated before the game starts".
  Controller-level literals (`GameController.php`): "Incorrect admin password.", "No game found with that code."

- Ported translation strings this plan's Vue/PHP tasks use verbatim, extracted from `packages/shared/src/locales/{en,uk}.json`:

  | Key (this app) | EN | UK |
  |---|---|---|
  | `auth.email` | Email | Електронна пошта |
  | `auth.password` | Password | Пароль |
  | `auth.confirmPassword` | Confirm password | Підтвердіть пароль |
  | `auth.signIn` | Sign In | Увійти |
  | `auth.register` | Register | Реєстрація |
  | `auth.signInWithGoogle` | Sign in with Google | Увійти через Google |
  | `auth.forgotPassword` | Forgot password? | Забули пароль? |
  | `auth.needAccount` | Need an account? Register | Немає акаунту? Зареєструватися |
  | `auth.alreadyHaveAccount` | Already have an account? Sign in | Вже є акаунт? Увійти |
  | `auth.displayName` | Your name | Ваше ім'я |
  | `auth.registerWithEmail` | Create Account | Створити акаунт |
  | `common.save` | Save | Зберегти |
  | `common.cancel` | Cancel | Скасувати |
  | `game.waiting` | Waiting for Players | Очікування гравців |
  | `game.youAreAdmin` | You are admin | Ви адміністратор |
  | `game.adminSettings` | Admin Settings | Налаштування адміна |
  | `game.startGame` | Start Game | Почати гру |
  | `game.leaveGame` | Leave Game | Покинути гру |
  | `game.ui.adminWritesCommentsTitle` | Admin also writes comments | Адміністратор також пише коментарі |
  | `game.ui.adminWritesCommentsDescription` | If enabled, admin will participate by writing comments about other players. | Якщо увімкнено, адміністратор буде брати участь у написанні коментарів про інших гравців |
  | `game.ui.targetSelectionModeTitle` | Target selection mode | Режим вибору цілі |
  | `game.ui.targetSelectionModeDescription` | Choose how targets are selected: random or by join order | Оберіть, як обираються цілі: випадково або за порядком приєднання |
  | `game.targetSelectionRandom` | Random targets | Випадкові цілі |
  | `game.targetSelectionChronological` | Chronological targets | Послідовні цілі |
  | `game.ui.showSurnamesTitle` | Show surnames | Показувати прізвища |
  | `game.ui.showSurnamesDescription` | If disabled, only participant names will be shown without surnames | Якщо вимкнено, будуть показані лише імена учасників без прізвищ |
  | `game.ui.showGuessResultsTitle` | Show guess results | Показувати результати вгадування |
  | `game.ui.showGuessResultsDescription` | Show whether targets correctly identified commentators | Показувати, чи правильно цілі впізнали коментаторів |
  | `game.ui.createOrJoin.description` | Enter admin password to create a new game, or an existing game ID to join. | Введіть пароль адміністратора, щоб створити нову гру, або існуючий ID гри, щоб приєднатися. |
  | `game.gameIdPlaceholder` | Game ID or Admin Password | ID гри або пароль адміна |
  | `game.join` | Join Game | Приєднатися |
  | `game.activePhase` | Writing Comments | Написання коментарів |
  | `game.commentPlaceholder` | Write your anonymous comment here... | Напишіть ваш анонімний коментар тут... |
  | `game.submitComment` | Submit | Відправити |
  | `game.commentSubmitted` | Your comment has been submitted! | Ваш коментар відправлено! |
  | `game.ui.commentSentWaitingShow` | Comment sent! Waiting for the admin to show all comments... | Коментар відправлено! Чекаємо, коли адміністратор покаже всі коментарі... |
  | `game.youAreTarget` | You are the target this round! Others are writing comments about you. You will guess who wrote them next. | Ви ціль цього раунду! Інші пишуть коментарі про вас. Далі ви будете вгадувати, хто їх написав. |
  | `game.ui.waitingForCommentsAboutYou` | Waiting for others to write comments about you... | Чекаємо, поки інші напишуть коментарі про вас... |
  | `game.ui.adminNotParticipating` | You are the admin and do not participate in writing comments in this game. | Ви адміністратор і не берете участь у написанні коментарів у цій грі. |
  | `game.showComments` | Show Comments | Показати коментарі |
  | `game.awardPointsToComments` | Award points to each comment | Нарахуйте бали кожному коментарю |
  | `game.finishAwarding` | Finish Awarding Points | Завершити нарахування балів |
  | `game.ui.finishedAwardingPointsWaitAdmin` | You finished awarding points. Waiting for the admin's decision... | Ви завершили нарахування балів. Чекаємо рішення адміністратора... |
  | `game.givePoints` | Give Points | Нарахувати бали |
  | `game.awardPointsToTarget` | Award points to the target | Нарахуйте бали цільовому гравцю |
  | `game.skip` | Skip | Пропустити |
  | `game.ui.adminControls` | Admin controls | Елементи керування адміна |
  | `game.guessingPhase` | Guessing Phase | Фаза вгадування |
  | `game.ui.guessingPhaseSubtitle` | Guess who wrote each comment about the target player. | Вгадайте, хто написав кожен коментар про цільового гравця. |
  | `game.finishGuesses` | Submit Guesses | Відправити вгадування |
  | `game.guessSubmitted` | Your guesses have been submitted! | Ваші вгадування відправлено! |
  | `game.ui.waitingForAllPlayers` | Waiting for all players to submit their responses... | Чекаємо, поки всі гравці надішлють відповіді... |
  | `game.ui.waitingForAdminToStartGuessing` | Waiting for the admin to start the guessing phase for your round. | Очікування, поки адміністратор розпочне фазу вгадування для вашого раунду. |
  | `game.ui.postGuessing.startPhaseDesc` | Target has submitted guesses. Start the point awarding phase to award points. | Ціль надіслала відповіді. Розпочніть фазу нарахування балів. |
  | `game.ui.postGuessing.alreadyAwardedText` | You have already awarded points in this phase. | Ви вже нарахували бали в цій фазі. |
  | `game.finializeGuessing` | Finalize & Show Results | Завершити і показати результати |
  | `game.leaderboard` | Leaderboard | Таблиця лідерів |
  | `game.gameOver` | Game over | Гра закінчена |
  | `game.nextRound` | Next Round | Наступний раунд |
  | `game.ui.adminLeftTitle` | Admin has left the game | Адміністратор покинув гру |
  | `game.ui.adminLeftMessage` | The admin has left and the game has ended. | Адміністратор покинув гру і вона завершена. |
  | `game.correctGuesses` | Correct Guesses | Правильні вгадування |
  | `game.points` | points | балів |
  | `game.ui.target` | Target | Ціль |

  (`game.ui.adminLeftMessage`'s trailing "You will be returned to the lobby" sentence is dropped — `docs/game-mechanics.md` already documents that promise as unimplemented on both sibling apps; this port doesn't repeat the same broken promise.)

---

## Phase A: Localization Infrastructure

### Task 1: Locale resolution — column, middleware, switch endpoint, shared prop

**Files:**
- Create: `laravel/database/migrations/xxxx_add_locale_to_users_table.php`
- Create: `laravel/app/Http/Middleware/SetLocale.php`
- Create: `laravel/app/Http/Controllers/LocaleController.php`
- Modify: `laravel/bootstrap/app.php` (register the middleware globally)
- Modify: `laravel/app/Http/Middleware/HandleInertiaRequests.php` (share `locale`)
- Modify: `laravel/routes/web.php` (add `POST /locale`)
- Test: `laravel/tests/Feature/SetLocaleTest.php`

**Interfaces:**
- Produces: `users.locale` (nullable string, `'uk'`/`'en'`). `SetLocale` middleware — runs on every web request, resolves locale via session → authenticated user's stored preference → `'uk'` default, calls `app()->setLocale(...)`, writes to session if not already set. `POST /locale` (route name `locale.update`, any auth state) — body `{ locale: 'uk'|'en' }`, updates session immediately, persists to `users.locale` when authenticated, redirects back. `HandleInertiaRequests::share()` gains `'locale' => app()->getLocale()` — every later Vue task reads `$page.props.locale`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Models\User;

test('SetLocale defaults to uk for a guest with no session locale', function () {
    $response = $this->get('/');
    expect(session('locale'))->toBe('uk');
});

test('SetLocale resolves from an authenticated user\'s stored preference', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $this->actingAs($user)->get('/dashboard');

    expect(session('locale'))->toBe('en');
});

test('POST /locale updates the session and, for an authenticated user, persists to their record', function () {
    $user = User::factory()->create(['locale' => 'uk']);

    $this->actingAs($user)->post('/locale', ['locale' => 'en'])->assertRedirect();

    expect(session('locale'))->toBe('en');
    expect($user->fresh()->locale)->toBe('en');
});

test('POST /locale works for a guest without persisting anywhere but the session', function () {
    $this->post('/locale', ['locale' => 'en'])->assertRedirect();

    expect(session('locale'))->toBe('en');
});

test('the shared locale Inertia prop reflects the resolved locale', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn ($page) => $page->where('locale', 'en'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --filter=SetLocaleTest`
Expected: FAIL — `locale` column/middleware/route don't exist yet

- [ ] **Step 3: Add the migration**

```bash
php artisan make:migration add_locale_to_users_table --table=users
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
            $table->string('locale')->nullable()->after('photo_url');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('locale');
        });
    }
};
```

Run: `php artisan migrate`. Add `'locale'` to `User::$fillable` (or the `#[Fillable([...])]` attribute array — check which form this Laravel version's `User.php` currently uses, per phase 1's Task 3 finding, and extend whichever is present).

- [ ] **Step 4: Implement `SetLocale` middleware**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = session('locale')
            ?? $request->user()?->locale
            ?? 'uk';

        app()->setLocale($locale);
        session(['locale' => $locale]);

        return $next($request);
    }
}
```

Register it globally in `bootstrap/app.php`, inside the `->withMiddleware(function (Middleware $middleware) { ... })` callback (already present from Breeze's install):

```php
$middleware->web(append: [
    \App\Http\Middleware\SetLocale::class,
]);
```

- [ ] **Step 5: Implement the switch endpoint**

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LocaleController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(['locale' => ['required', 'in:uk,en']]);

        session(['locale' => $validated['locale']]);
        app()->setLocale($validated['locale']);

        if ($request->user()) {
            $request->user()->update(['locale' => $validated['locale']]);
        }

        return back();
    }
}
```

Add to `routes/web.php` (outside the `auth` group, since guests can switch locale too — place it near the top, alongside the `/` and `/rules` routes):

```php
use App\Http\Controllers\LocaleController;

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');
```

- [ ] **Step 6: Share the locale prop**

In `HandleInertiaRequests::share()`, add `'locale' => app()->getLocale(),` to the returned array (alongside the existing `'auth' => [...]`).

- [ ] **Step 7: Run tests to verify they pass**

Run: `php artisan test --filter=SetLocaleTest`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/Http/Middleware/SetLocale.php app/Http/Controllers/LocaleController.php app/Http/Middleware/HandleInertiaRequests.php app/Models/User.php bootstrap/app.php routes/web.php database/migrations tests/Feature/SetLocaleTest.php
git commit -m "Add locale resolution middleware, switch endpoint, and shared Inertia prop"
```

---

### Task 2: Backend translation — `lang/en.json`/`lang/uk.json` and `__()` retrofit across all four services

**Files:**
- Create: `laravel/lang/en.json`
- Create: `laravel/lang/uk.json`
- Modify: `laravel/app/Services/CommentPhaseService.php` (every `RuntimeException` message)
- Modify: `laravel/app/Services/GuessingPhaseService.php` (every `RuntimeException` message)
- Modify: `laravel/app/Services/GameLifecycleService.php` (every `RuntimeException` message)
- Modify: `laravel/app/Services/GameSettingsService.php` (every `RuntimeException` message)
- Modify: `laravel/app/Http/Controllers/GameController.php` (the two controller-level literal messages)
- Test: `laravel/tests/Feature/BackendTranslationTest.php`

**Interfaces:**
- Consumes: `SetLocale` (Task 1) — `app()->getLocale()` is already correctly resolved by the time any service method throws, since the middleware runs before route handling.
- Produces: every message listed in this plan's "Reference Material" section now resolves through `__('...')` against `lang/en.json`/`lang/uk.json`. No method signature, exception type, or field-key mapping in any controller's `ValidationException::withMessages([...])` changes — only the string literal passed to `RuntimeException`/`withMessages` changes from a hardcoded string to `__('same string')`. Later Vue tasks never need to translate error text themselves — it arrives pre-translated in `form.errors`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;

test('a RuntimeException message is translated according to the current locale', function () {
    app()->setLocale('uk');

    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    expect(fn () => app(\App\Services\CommentPhaseService::class)->submitComment($round, $target, 'hi'))
        ->toThrow(RuntimeException::class, 'Ви не можете коментувати самого себе');
});

test('the same RuntimeException is in English when the locale is en', function () {
    app()->setLocale('en');

    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    expect(fn () => app(\App\Services\CommentPhaseService::class)->submitComment($round, $target, 'hi'))
        ->toThrow(RuntimeException::class, 'You cannot comment about yourself');
});

test('an interpolated message translates its placeholder correctly', function () {
    app()->setLocale('uk');

    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'points_given' => true,
    ]);

    expect(fn () => app(\App\Services\GuessingPhaseService::class)->startGuessingPhase($game))
        ->toThrow(RuntimeException::class, 'Зачекайте, поки 1 гравець(ів) завершать фазу після коментарів.');
});

test('a controller-level literal message is translated too', function () {
    app()->setLocale('uk');
    config(['game.admin_password' => 'secret-123']);
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', ['password' => 'wrong']);

    $response->assertSessionHasErrors(['password' => 'Невірний пароль адміністратора.']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=BackendTranslationTest`
Expected: FAIL — every assertion currently gets the raw (English, untranslated) message regardless of locale

- [ ] **Step 3: Create `lang/en.json`**

```json
{
    "You cannot comment about yourself": "You cannot comment about yourself",
    "Comments are already visible for this round": "Comments are already visible for this round",
    "Comment cannot be empty": "Comment cannot be empty",
    "Comment must be 500 characters or fewer": "Comment must be 500 characters or fewer",
    "You have already submitted a comment for this round": "You have already submitted a comment for this round",
    "Only the target person can give points": "Only the target person can give points",
    "Points have already been awarded to this comment": "Points have already been awarded to this comment",
    "Only the target can finish giving points": "Only the target can finish giving points",
    "Target has not finished giving points yet": "Target has not finished giving points yet",
    "You already gave points to this target this round": "You already gave points to this target this round",
    "You have already completed this phase": "You have already completed this phase",
    "Target cannot skip this phase": "Target cannot skip this phase",
    "Cannot start the guessing phase until comments have been shown and points have been awarded.": "Cannot start the guessing phase until comments have been shown and points have been awarded.",
    "Cannot start guessing phase. Waiting for :count player(s) to complete the post-comment phase.": "Cannot start guessing phase. Waiting for :count player(s) to complete the post-comment phase.",
    "Only the target can make guesses": "Only the target can make guesses",
    "You already guessed for this comment": "You already guessed for this comment",
    "Only the admin can mark another player as submitted": "Only the admin can mark another player as submitted",
    "Post-guessing point phase is not active": "Post-guessing point phase is not active",
    "You have already awarded points in this phase": "You have already awarded points in this phase",
    "No awards specified": "No awards specified",
    "You cannot award points to yourself": "You cannot award points to yourself",
    "The game has already started": "The game has already started",
    "Need at least 2 participants to start the game": "Need at least 2 participants to start the game",
    "Only the admin can update this setting": "Only the admin can update this setting",
    "This setting can only be updated before the game starts": "This setting can only be updated before the game starts",
    "Incorrect admin password.": "Incorrect admin password.",
    "No game found with that code.": "No game found with that code."
}
```

- [ ] **Step 4: Create `lang/uk.json`**

```json
{
    "You cannot comment about yourself": "Ви не можете коментувати самого себе",
    "Comments are already visible for this round": "Коментарі вже показані для цього раунду",
    "Comment cannot be empty": "Коментар не може бути порожнім",
    "Comment must be 500 characters or fewer": "Коментар має містити не більше 500 символів",
    "You have already submitted a comment for this round": "Ви вже надіслали коментар для цього раунду",
    "Only the target person can give points": "Лише цільовий гравець може нараховувати бали",
    "Points have already been awarded to this comment": "Балам для цього коментаря вже нараховано",
    "Only the target can finish giving points": "Лише цільовий гравець може завершити нарахування балів",
    "Target has not finished giving points yet": "Цільовий гравець ще не завершив нарахування балів",
    "You already gave points to this target this round": "Ви вже надали бали цій цілі цього раунду",
    "You have already completed this phase": "Ви вже завершили цю фазу",
    "Target cannot skip this phase": "Цільовий гравець не може пропустити цю фазу",
    "Cannot start the guessing phase until comments have been shown and points have been awarded.": "Неможливо почати фазу вгадування, поки не показано коментарі та не нараховано бали.",
    "Cannot start guessing phase. Waiting for :count player(s) to complete the post-comment phase.": "Зачекайте, поки :count гравець(ів) завершать фазу після коментарів.",
    "Only the target can make guesses": "Лише цільовий гравець може вгадувати",
    "You already guessed for this comment": "Ви вже вгадали для цього коментаря",
    "Only the admin can mark another player as submitted": "Лише адміністратор може позначити іншого гравця як такого, що завершив",
    "Post-guessing point phase is not active": "Фаза нарахування балів після вгадування не активна",
    "You have already awarded points in this phase": "Ви вже нарахували бали в цій фазі",
    "No awards specified": "Не вказано жодного нарахування",
    "You cannot award points to yourself": "Ви не можете нарахувати бали самому собі",
    "The game has already started": "Гра вже почалася",
    "Need at least 2 participants to start the game": "Потрібно щонайменше 2 учасники, щоб почати гру",
    "Only the admin can update this setting": "Лише адміністратор може змінювати це налаштування",
    "This setting can only be updated before the game starts": "Це налаштування можна змінити лише до початку гри",
    "Incorrect admin password.": "Невірний пароль адміністратора.",
    "No game found with that code.": "Гру з таким кодом не знайдено."
}
```

Note: `lang/en.json` maps every string to itself — this is intentional and idiomatic for Laravel's JSON-translation convention (the key IS the fallback/default-locale text), not a placeholder.

- [ ] **Step 5: Wrap every message in `__()`**

In each of the four service files, wrap every literal string argument to `RuntimeException` in `__(...)`. Example transformation (`CommentPhaseService::submitComment`):

```php
// Before
throw new RuntimeException('You cannot comment about yourself');
// After
throw new RuntimeException(__('You cannot comment about yourself'));
```

Apply this same transformation to every message listed in Step 3/4 above, in its originating file, with **one exception** — the interpolated message in `GuessingPhaseService::startGuessingPhase`:

```php
// Before
throw new RuntimeException(
    "Cannot start guessing phase. Waiting for {$incomplete->count()} player(s) to complete the post-comment phase."
);
// After
throw new RuntimeException(
    __('Cannot start guessing phase. Waiting for :count player(s) to complete the post-comment phase.', ['count' => $incomplete->count()])
);
```

In `GameController.php`, wrap the two controller-level literals the same way:

```php
// Before
throw ValidationException::withMessages(['password' => 'Incorrect admin password.']);
// After
throw ValidationException::withMessages(['password' => __('Incorrect admin password.')]);

// Before
throw ValidationException::withMessages(['code' => 'No game found with that code.']);
// After
throw ValidationException::withMessages(['code' => __('No game found with that code.')]);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=BackendTranslationTest`
Expected: PASS

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `php artisan test`
Expected: PASS — every existing test that asserts on one of these exact English message strings still passes, since `__('X')` returns `'X'` verbatim under the default `en` locale and every existing test runs without explicitly switching locale (Pest's default test locale is `en`).

- [ ] **Step 8: Commit**

```bash
git add lang/en.json lang/uk.json app/Services/CommentPhaseService.php app/Services/GuessingPhaseService.php app/Services/GameLifecycleService.php app/Services/GameSettingsService.php app/Http/Controllers/GameController.php tests/Feature/BackendTranslationTest.php
git commit -m "Translate all backend validation messages via lang/en.json and lang/uk.json"
```

---

### Task 3: Frontend `vue-i18n` setup, locale catalogs, and the locale switcher

**Files:**
- Create: `laravel/resources/js/i18n.js`
- Create: `laravel/resources/js/locales/en.json`
- Create: `laravel/resources/js/locales/uk.json`
- Create: `laravel/resources/js/Components/LocaleSwitcher.vue`
- Modify: `laravel/resources/js/app.js` (install the i18n plugin)
- Modify: `laravel/resources/js/Layouts/AuthenticatedLayout.vue` (add the switcher to the nav bar)
- Modify: `laravel/resources/js/Layouts/GuestLayout.vue` (add the switcher above the card)
- Test: `laravel/tests/Feature/LocaleSwitcherUiTest.php`

**Interfaces:**
- Consumes: the shared `locale` Inertia prop (Task 1).
- Produces: a global `$t(key)` translation function available in every `<script setup>` via `useI18n()` and every template via the `$t` global, seeded from `resources/js/locales/{en,uk}.json`. `LocaleSwitcher.vue` — a two-button UK/EN toggle that posts to `route('locale.update')`, no props required (reads `$page.props.locale` itself). Every later Vue task in this plan uses `$t('key')` for static copy — never a hardcoded English string in a template.

- [ ] **Step 1: Install `vue-i18n`**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/laravel
npm install vue-i18n@10
```

- [ ] **Step 2: Create the locale catalogs**

`resources/js/locales/en.json` — populate with every key from this plan's "Reference Material" table (EN column) plus these additional structural/UI keys this task's own switcher and layout changes need:

```json
{
    "auth": {
        "email": "Email",
        "password": "Password",
        "confirmPassword": "Confirm password",
        "signIn": "Sign In",
        "register": "Register",
        "signInWithGoogle": "Sign in with Google",
        "forgotPassword": "Forgot password?",
        "needAccount": "Need an account? Register",
        "alreadyHaveAccount": "Already have an account? Sign in",
        "displayName": "Your name",
        "registerWithEmail": "Create Account"
    },
    "common": {
        "save": "Save",
        "cancel": "Cancel"
    },
    "locale": {
        "uk": "UK",
        "en": "EN"
    },
    "game": {
        "waiting": "Waiting for Players",
        "youAreAdmin": "You are admin",
        "adminSettings": "Admin Settings",
        "startGame": "Start Game",
        "leaveGame": "Leave Game",
        "targetSelectionRandom": "Random targets",
        "targetSelectionChronological": "Chronological targets",
        "createOrJoinDescription": "Enter admin password to create a new game, or an existing game ID to join.",
        "gameIdPlaceholder": "Game ID or Admin Password",
        "join": "Join Game",
        "activePhase": "Writing Comments",
        "commentPlaceholder": "Write your anonymous comment here...",
        "submitComment": "Submit",
        "commentSubmitted": "Your comment has been submitted!",
        "commentSentWaitingShow": "Comment sent! Waiting for the admin to show all comments...",
        "youAreTarget": "You are the target this round! Others are writing comments about you. You will guess who wrote them next.",
        "waitingForCommentsAboutYou": "Waiting for others to write comments about you...",
        "adminNotParticipating": "You are the admin and do not participate in writing comments in this game.",
        "showComments": "Show Comments",
        "awardPointsToComments": "Award points to each comment",
        "finishAwarding": "Finish Awarding Points",
        "finishedAwardingPointsWaitAdmin": "You finished awarding points. Waiting for the admin's decision...",
        "givePoints": "Give Points",
        "awardPointsToTarget": "Award points to the target",
        "skip": "Skip",
        "adminControls": "Admin controls",
        "guessingPhase": "Guessing Phase",
        "guessingPhaseSubtitle": "Guess who wrote each comment about the target player.",
        "finishGuesses": "Submit Guesses",
        "guessSubmitted": "Your guesses have been submitted!",
        "waitingForAllPlayers": "Waiting for all players to submit their responses...",
        "waitingForAdminToStartGuessing": "Waiting for the admin to start the guessing phase for your round.",
        "postGuessingStartPhaseDesc": "Target has submitted guesses. Start the point awarding phase to award points.",
        "postGuessingAlreadyAwarded": "You have already awarded points in this phase.",
        "finalizeGuessing": "Finalize & Show Results",
        "leaderboard": "Leaderboard",
        "gameOver": "Game over",
        "nextRound": "Next Round",
        "adminLeftTitle": "Admin has left the game",
        "adminLeftMessage": "The admin has left and the game has ended.",
        "correctGuesses": "Correct Guesses",
        "points": "points",
        "target": "Target",
        "participants": "Participants",
        "adminWritesCommentsTitle": "Admin also writes comments",
        "adminWritesCommentsDescription": "If enabled, admin will participate by writing comments about other players.",
        "targetSelectionModeTitle": "Target selection mode",
        "targetSelectionModeDescription": "Choose how targets are selected: random or by join order",
        "showSurnamesTitle": "Show surnames",
        "showSurnamesDescription": "If disabled, only participant names will be shown without surnames",
        "showGuessResultsTitle": "Show guess results",
        "showGuessResultsDescription": "Show whether targets correctly identified commentators"
    }
}
```

`resources/js/locales/uk.json` — same structure, values from this plan's Reference Material table (UK column) plus the equivalent Ukrainian for the additional structural keys above:

```json
{
    "auth": {
        "email": "Електронна пошта",
        "password": "Пароль",
        "confirmPassword": "Підтвердіть пароль",
        "signIn": "Увійти",
        "register": "Реєстрація",
        "signInWithGoogle": "Увійти через Google",
        "forgotPassword": "Забули пароль?",
        "needAccount": "Немає акаунту? Зареєструватися",
        "alreadyHaveAccount": "Вже є акаунт? Увійти",
        "displayName": "Ваше ім'я",
        "registerWithEmail": "Створити акаунт"
    },
    "common": {
        "save": "Зберегти",
        "cancel": "Скасувати"
    },
    "locale": {
        "uk": "UK",
        "en": "EN"
    },
    "game": {
        "waiting": "Очікування гравців",
        "youAreAdmin": "Ви адміністратор",
        "adminSettings": "Налаштування адміна",
        "startGame": "Почати гру",
        "leaveGame": "Покинути гру",
        "targetSelectionRandom": "Випадкові цілі",
        "targetSelectionChronological": "Послідовні цілі",
        "createOrJoinDescription": "Введіть пароль адміністратора, щоб створити нову гру, або існуючий ID гри, щоб приєднатися.",
        "gameIdPlaceholder": "ID гри або пароль адміна",
        "join": "Приєднатися",
        "activePhase": "Написання коментарів",
        "commentPlaceholder": "Напишіть ваш анонімний коментар тут...",
        "submitComment": "Відправити",
        "commentSubmitted": "Ваш коментар відправлено!",
        "commentSentWaitingShow": "Коментар відправлено! Чекаємо, коли адміністратор покаже всі коментарі...",
        "youAreTarget": "Ви ціль цього раунду! Інші пишуть коментарі про вас. Далі ви будете вгадувати, хто їх написав.",
        "waitingForCommentsAboutYou": "Чекаємо, поки інші напишуть коментарі про вас...",
        "adminNotParticipating": "Ви адміністратор і не берете участь у написанні коментарів у цій грі.",
        "showComments": "Показати коментарі",
        "awardPointsToComments": "Нарахуйте бали кожному коментарю",
        "finishAwarding": "Завершити нарахування балів",
        "finishedAwardingPointsWaitAdmin": "Ви завершили нарахування балів. Чекаємо рішення адміністратора...",
        "givePoints": "Нарахувати бали",
        "awardPointsToTarget": "Нарахуйте бали цільовому гравцю",
        "skip": "Пропустити",
        "adminControls": "Елементи керування адміна",
        "guessingPhase": "Фаза вгадування",
        "guessingPhaseSubtitle": "Вгадайте, хто написав кожен коментар про цільового гравця.",
        "finishGuesses": "Відправити вгадування",
        "guessSubmitted": "Ваші вгадування відправлено!",
        "waitingForAllPlayers": "Чекаємо, поки всі гравці надішлють відповіді...",
        "waitingForAdminToStartGuessing": "Очікування, поки адміністратор розпочне фазу вгадування для вашого раунду.",
        "postGuessingStartPhaseDesc": "Ціль надіслала відповіді. Розпочніть фазу нарахування балів.",
        "postGuessingAlreadyAwarded": "Ви вже нарахували бали в цій фазі.",
        "finalizeGuessing": "Завершити і показати результати",
        "leaderboard": "Таблиця лідерів",
        "gameOver": "Гра закінчена",
        "nextRound": "Наступний раунд",
        "adminLeftTitle": "Адміністратор покинув гру",
        "adminLeftMessage": "Адміністратор покинув гру і вона завершена.",
        "correctGuesses": "Правильні вгадування",
        "points": "балів",
        "target": "Ціль",
        "participants": "Учасники",
        "adminWritesCommentsTitle": "Адміністратор також пише коментарі",
        "adminWritesCommentsDescription": "Якщо увімкнено, адміністратор буде брати участь у написанні коментарів про інших гравців",
        "targetSelectionModeTitle": "Режим вибору цілі",
        "targetSelectionModeDescription": "Оберіть, як обираються цілі: випадково або за порядком приєднання",
        "showSurnamesTitle": "Показувати прізвища",
        "showSurnamesDescription": "Якщо вимкнено, будуть показані лише імена учасників без прізвищ",
        "showGuessResultsTitle": "Показувати результати вгадування",
        "showGuessResultsDescription": "Показувати, чи правильно цілі впізнали коментаторів"
    }
}
```

- [ ] **Step 3: Create the i18n instance**

```js
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import uk from './locales/uk.json';

export function createAppI18n(initialLocale) {
    return createI18n({
        legacy: false,
        locale: initialLocale ?? 'uk',
        fallbackLocale: 'en',
        messages: { en, uk },
    });
}
```

Save as `resources/js/i18n.js`.

- [ ] **Step 4: Wire it into `app.js`**

The current `resources/js/app.js` is Breeze's standard Inertia bootstrap:

```js
import '../css/app.css';
import './bootstrap';
import './echo';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createApp, h } from 'vue';
import { ZiggyVue } from '../../vendor/tightenco/ziggy';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        return createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});
```

Add the `createAppI18n` import at the top (alongside the other imports), and add `.use(i18n)` to the `setup` callback's chain, seeded from the Inertia initial page props (`props.initialPage.props.locale`):

```js
import '../css/app.css';
import './bootstrap';
import './echo';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createApp, h } from 'vue';
import { ZiggyVue } from '../../vendor/tightenco/ziggy';
import { createAppI18n } from './i18n';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        const i18n = createAppI18n(props.initialPage.props.locale);
        return createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .use(i18n)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});
```

- [ ] **Step 5: Build the switcher component**

```vue
<script setup>
import { router, usePage } from '@inertiajs/vue3';

const page = usePage();

const switchTo = (locale) => {
    router.post(route('locale.update'), { locale }, { preserveScroll: true });
};
</script>

<template>
    <div class="flex gap-1 text-sm">
        <button
            type="button"
            :class="page.props.locale === 'uk' ? 'font-bold underline' : 'text-gray-500'"
            @click="switchTo('uk')"
        >
            {{ $t('locale.uk') }}
        </button>
        <span class="text-gray-300">/</span>
        <button
            type="button"
            :class="page.props.locale === 'en' ? 'font-bold underline' : 'text-gray-500'"
            @click="switchTo('en')"
        >
            {{ $t('locale.en') }}
        </button>
    </div>
</template>
```

Save as `resources/js/Components/LocaleSwitcher.vue`.

- [ ] **Step 6: Wire the switcher into both layouts**

In `AuthenticatedLayout.vue`, add `import LocaleSwitcher from '@/Components/LocaleSwitcher.vue';` and place `<LocaleSwitcher class="mr-4" />` just before the existing "Settings Dropdown" `<div class="relative ms-3">` block, inside the same `<div class="hidden sm:ms-6 sm:flex sm:items-center">` container.

In `GuestLayout.vue`, add the same import and place `<LocaleSwitcher class="mb-4" />` directly above the `<div class="mt-6 w-full ...">` card wrapper (i.e., between the logo `<Link>` and the card).

- [ ] **Step 7: Write the test**

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the dashboard page carries the resolved locale to Inertia', function () {
    $user = User::factory()->create(['locale' => 'en']);

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});
```

Save as `tests/Feature/LocaleSwitcherUiTest.php`.

- [ ] **Step 8: Build and test**

```bash
npm run build
php artisan test --filter=LocaleSwitcherUiTest
php artisan test
```
Expected: `npm run build` succeeds with no errors; both test runs PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/i18n.js resources/js/locales resources/js/Components/LocaleSwitcher.vue resources/js/app.js resources/js/Layouts/AuthenticatedLayout.vue resources/js/Layouts/GuestLayout.vue package.json package-lock.json tests/Feature/LocaleSwitcherUiTest.php
git commit -m "Add vue-i18n, ported locale catalogs, and the locale switcher"
```

---

## Phase B: Auth and Dashboard

### Task 4: Google sign-in button and translated auth pages

**Files:**
- Modify: `laravel/resources/js/Pages/Auth/Login.vue`
- Modify: `laravel/resources/js/Pages/Auth/Register.vue`
- Test: `laravel/tests/Feature/GoogleSignInButtonTest.php`

**Interfaces:**
- Consumes: `GET /auth/google/redirect` (phase 1, Task 3 — already exists, was unreachable from the UI until now), `vue-i18n`'s `$t` (Task 3).

- [ ] **Step 1: Write the failing test**

```php
<?php

test('the login page links to the Google sign-in route', function () {
    $response = $this->get('/login');

    $response->assertOk();
    // Inertia SSR-free responses embed the page's props as JSON in the initial HTML;
    // the simplest reliable check is that the named route resolves at all (a broken
    // route() call in the Vue template would fail at build time, not request time,
    // so this test's real job is documenting the contract, not catching a build error).
    expect(route('auth.google.redirect'))->toContain('/auth/google/redirect');
});
```

Save as `tests/Feature/GoogleSignInButtonTest.php`. (This is a thin test — the meaningful verification for a template change like this is the Vue build succeeding and a manual click-through, per this task's Step 4.)

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GoogleSignInButtonTest`
Expected: This specific test actually passes immediately (the route already exists from phase 1) — the real "failure" to check for in this task is a build error if the template references `route('auth.google.redirect')` incorrectly. Skip to Step 3.

- [ ] **Step 3: Add the button and translate both pages**

In `Login.vue`, replace every hardcoded label with its `$t()` call, and add the Google button. Full replacement `<template>` block:

```vue
<template>
    <GuestLayout>
        <Head title="Log in" />

        <div v-if="status" class="mb-4 text-sm font-medium text-green-600">
            {{ status }}
        </div>

        <a
            :href="route('auth.google.redirect')"
            class="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
            {{ $t('auth.signInWithGoogle') }}
        </a>

        <div class="my-4 flex items-center gap-3 text-xs text-gray-400">
            <div class="h-px flex-1 bg-gray-200" />
            {{ $t('auth.signIn') }}
            <div class="h-px flex-1 bg-gray-200" />
        </div>

        <form @submit.prevent="submit">
            <div>
                <InputLabel for="email" :value="$t('auth.email')" />

                <TextInput
                    id="email"
                    type="email"
                    class="mt-1 block w-full"
                    v-model="form.email"
                    required
                    autofocus
                    autocomplete="username"
                />

                <InputError class="mt-2" :message="form.errors.email" />
            </div>

            <div class="mt-4">
                <InputLabel for="password" :value="$t('auth.password')" />

                <TextInput
                    id="password"
                    type="password"
                    class="mt-1 block w-full"
                    v-model="form.password"
                    required
                    autocomplete="current-password"
                />

                <InputError class="mt-2" :message="form.errors.password" />
            </div>

            <div class="mt-4 block">
                <label class="flex items-center">
                    <Checkbox name="remember" v-model:checked="form.remember" />
                    <span class="ms-2 text-sm text-gray-600">Remember me</span>
                </label>
            </div>

            <div class="mt-4 flex items-center justify-end">
                <Link
                    v-if="canResetPassword"
                    :href="route('password.request')"
                    class="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    {{ $t('auth.forgotPassword') }}
                </Link>

                <PrimaryButton
                    class="ms-4"
                    :class="{ 'opacity-25': form.processing }"
                    :disabled="form.processing"
                >
                    {{ $t('auth.signIn') }}
                </PrimaryButton>
            </div>

            <div class="mt-4 text-sm">
                <Link :href="route('register')" class="text-gray-600 underline">
                    {{ $t('auth.needAccount') }}
                </Link>
            </div>
        </form>
    </GuestLayout>
</template>
```

("Remember me" has no existing ported key — leave it as the Breeze default English string; it's not in the spec's translated-copy scope and inventing a Ukrainian translation for one checkbox label isn't worth the risk described in this plan's Global Constraints. `<script setup>` is unchanged.)

In `Register.vue`, same treatment — replace `value="Name"` → `:value="$t('auth.displayName')"`, `value="Email"` → `:value="$t('auth.email')"`, `value="Password"` → `:value="$t('auth.password')"`, `value="Confirm Password"` → `:value="$t('auth.confirmPassword')"`, the `Register` button text → `{{ $t('auth.register') }}`, and the "Already registered?" link → `{{ $t('auth.alreadyHaveAccount') }}`. `<script setup>` is unchanged.

- [ ] **Step 4: Build and manually verify**

```bash
npm run build
```
Expected: succeeds with no errors. (This task has no meaningful automated coverage beyond the route-existence check in Step 1 — the actual verification is that the Vue template compiles and `$t()` calls resolve, which `npm run build` catches for syntax but not for runtime `$t()` behavior; note in the task report if you're able to render the page and confirm visually.)

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Auth/Login.vue resources/js/Pages/Auth/Register.vue tests/Feature/GoogleSignInButtonTest.php
git commit -m "Add Google sign-in button and translate the login/register pages"
```

---

### Task 5: Dashboard create/join form

**Files:**
- Modify: `laravel/resources/js/Pages/Dashboard.vue`
- Test: `laravel/tests/Feature/DashboardFormTest.php`

**Interfaces:**
- Consumes: `POST /games` (phase 1 Task 8 — validates `password`/`admin_writes_comments`), `POST /games/join` (phase 1 Task 9 — validates `code`), `vue-i18n`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the dashboard page renders create/join forms pointing at the real routes', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertInertia(fn (Assert $page) => $page->component('Dashboard'));
    // The form's target routes must exist and resolve — a stale route() call
    // in the template throws at Inertia render time in this Laravel version's
    // Ziggy integration, which would surface as a 500 here.
    $response->assertOk();
});
```

Save as `tests/Feature/DashboardFormTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=DashboardFormTest`
Expected: PASS already (the route/page both already resolve) — same situation as Task 4's Step 2; this task's real risk is a template bug, which `npm run build` plus this smoke test together cover reasonably. Proceed to Step 3.

- [ ] **Step 3: Replace the Dashboard body**

```vue
<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { Head, useForm } from '@inertiajs/vue3';

const createForm = useForm({ password: '', admin_writes_comments: false });
const joinForm = useForm({ code: '' });

const submitCreate = () => createForm.post(route('games.store'));
const submitJoin = () => joinForm.post(route('games.join'));
</script>

<template>
    <Head title="Dashboard" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="text-xl font-semibold leading-tight text-gray-800">
                {{ $t('game.waiting') }}
            </h2>
        </template>

        <div class="py-12">
            <div class="mx-auto max-w-2xl space-y-6 sm:px-6 lg:px-8">
                <p class="text-sm text-gray-600">{{ $t('game.createOrJoinDescription') }}</p>

                <div class="overflow-hidden bg-white p-6 shadow-sm sm:rounded-lg">
                    <form @submit.prevent="submitJoin" class="flex gap-2">
                        <div class="flex-1">
                            <InputLabel for="code" :value="$t('game.gameIdPlaceholder')" />
                            <TextInput
                                id="code"
                                type="text"
                                class="mt-1 block w-full"
                                v-model="joinForm.code"
                                :placeholder="$t('game.gameIdPlaceholder')"
                            />
                            <InputError class="mt-2" :message="joinForm.errors.code" />
                        </div>
                        <PrimaryButton
                            class="mt-6 self-start"
                            :class="{ 'opacity-25': joinForm.processing }"
                            :disabled="joinForm.processing"
                        >
                            {{ $t('game.join') }}
                        </PrimaryButton>
                    </form>
                </div>

                <div class="overflow-hidden bg-white p-6 shadow-sm sm:rounded-lg">
                    <form @submit.prevent="submitCreate">
                        <InputLabel for="password" :value="$t('auth.password')" />
                        <TextInput
                            id="password"
                            type="password"
                            class="mt-1 block w-full"
                            v-model="createForm.password"
                        />
                        <InputError class="mt-2" :message="createForm.errors.password" />

                        <label class="mt-4 flex items-center">
                            <input type="checkbox" v-model="createForm.admin_writes_comments" />
                            <span class="ms-2 text-sm text-gray-600">
                                {{ $t('game.adminWritesCommentsTitle') }}
                            </span>
                        </label>

                        <PrimaryButton
                            class="mt-4"
                            :class="{ 'opacity-25': createForm.processing }"
                            :disabled="createForm.processing"
                        >
                            {{ $t('game.startGame') }}
                        </PrimaryButton>
                    </form>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
```

- [ ] **Step 4: Build and test**

```bash
npm run build
php artisan test --filter=DashboardFormTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Dashboard.vue tests/Feature/DashboardFormTest.php
git commit -m "Add the create/join game form to the dashboard"
```

---

## Phase C: Data Layer for the Remaining Pages

### Task 6: Extend `GameResource` with guessing/points-given data the new pages need

**Files:**
- Modify: `laravel/app/Http/Resources/GameResource.php`
- Test: `laravel/tests/Feature/GameResourceGuessingFieldsTest.php`

**Interfaces:**
- Consumes: `Round::guessing_possible_authors`/`guesses()`/`target_points_given_by`/`guessing_all_submitted` (phase 1, Task 5/17), `Game::players_who_completed_post_comment_phase`/`players_who_awarded_post_guess_points` (phase 1, Task 4/15/19).
- Produces: `GameResource`'s `currentRound` array gains `guessingPossibleAuthors` (array of `{userId, userName}`), `guesses` (array of `{commentId, guesserId, guessedAuthorId, correct}`), `targetPointsGivenBy` (array of string user IDs), `guessingAllSubmitted` (bool). The top-level array gains `playersWhoCompletedPostCommentPhase` and `playersWhoAwardedPostGuessPoints` (both arrays of string user IDs). Every later page task (7–13) reads these exact field names — this is the last shared-data task before per-page work begins.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('GameResource exposes guessing and points-given tracking data', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id,
        'status' => 'guessing_phase',
        'players_who_completed_post_comment_phase' => ['7'],
        'players_who_awarded_post_guess_points' => ['9'],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);

    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
        'target_points_given_by' => [(string) $author->id],
        'guessing_all_submitted' => true,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    Guess::factory()->create([
        'round_id' => $round->id, 'comment_id' => $comment->id,
        'guesser_id' => $target->id, 'guessed_author_id' => $author->id, 'correct' => true,
    ]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.guessingPossibleAuthors.0.userId', (string) $author->id)
        ->where('game.currentRound.guesses.0.guessedAuthorId', $author->id)
        ->where('game.currentRound.guesses.0.correct', true)
        ->where('game.currentRound.targetPointsGivenBy', [(string) $author->id])
        ->where('game.currentRound.guessingAllSubmitted', true)
        ->where('game.playersWhoCompletedPostCommentPhase', ['7'])
        ->where('game.playersWhoAwardedPostGuessPoints', ['9'])
    );
});
```

Save as `tests/Feature/GameResourceGuessingFieldsTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GameResourceGuessingFieldsTest`
Expected: FAIL — the new fields aren't in the resource yet

- [ ] **Step 3: Extend the resource**

In `GameResource::toArray`, add to the `'currentRound' => $currentRound ? [...]` array (after `'comments' => ...`):

```php
'guessingPossibleAuthors' => $currentRound->guessing_possible_authors ?? [],
'guesses' => $currentRound->guesses->map(fn ($g) => [
    'commentId' => $g->comment_id,
    'guesserId' => $g->guesser_id,
    'guessedAuthorId' => $g->guessed_author_id,
    'correct' => $g->correct,
]),
'targetPointsGivenBy' => $currentRound->target_points_given_by ?? [],
'guessingAllSubmitted' => $currentRound->guessing_all_submitted,
```

Add to the top-level returned array (after `'postGuessingPointPhase' => ...`):

```php
'playersWhoCompletedPostCommentPhase' => $this->players_who_completed_post_comment_phase ?? [],
'playersWhoAwardedPostGuessPoints' => $this->players_who_awarded_post_guess_points ?? [],
```

Add `'rounds.guesses'` to the eager-load list in both `GameController::show` and `GameController::start` (find the existing `$game->load([...])` calls from phase 1 and add `'rounds.guesses'` to the array) so `$currentRound->guesses` doesn't N+1.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=GameResourceGuessingFieldsTest`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS — the additive fields don't change any existing assertion's shape.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Resources/GameResource.php app/Http/Controllers/GameController.php tests/Feature/GameResourceGuessingFieldsTest.php
git commit -m "Extend GameResource with guessing and points-given tracking data"
```

---

## Phase D: Game Pages

### Task 7: Rebuild `Waiting.vue` — participants, start, settings, leave

**Files:**
- Modify: `laravel/resources/js/Pages/Game/Mirror/Waiting.vue`
- Modify: `laravel/resources/js/locales/en.json`, `laravel/resources/js/locales/uk.json` (one new key each — see Step 3)
- Test: `laravel/tests/Feature/WaitingPageTest.php`

**Interfaces:**
- Consumes: `game.participants`, `game.isAdmin`, `game.settings.*`, `game.code` (all phase 1); `POST games/{id}/start`, `POST games/{id}/leave`, `POST games/{id}/settings/*` (all phase 1); `$t` (Task 3).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the waiting page shows every participant and the admin-only controls only for the admin', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $adminResponse = $this->actingAs($admin)->get("/games/{$game->id}");
    $adminResponse->assertInertia(fn (Assert $page) => $page
        ->component('Game/Show')
        ->where('game.isAdmin', true)
        ->has('game.participants', 2)
    );

    $otherResponse = $this->actingAs($other)->get("/games/{$game->id}");
    $otherResponse->assertInertia(fn (Assert $page) => $page->where('game.isAdmin', false));
});
```

Save as `tests/Feature/WaitingPageTest.php`. (This test asserts on the props the page consumes, which is what a Pest/Inertia test can meaningfully check — it doesn't render Vue. The `v-if="game.isAdmin"` branches in the template below are verified by code review during this task's task-review, not by this test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=WaitingPageTest`
Expected: PASS already (props already flow correctly since phase 1) — proceed to Step 3; this task's real work is the template.

- [ ] **Step 3: Rebuild the page**

```vue
<script setup>
import { useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });

const settingsForm = useForm({});

const toggle = (routeName, field) => {
    settingsForm.transform(() => ({ value: !props.game.settings[field] })).post(route(routeName, props.game.id));
};

const startForm = useForm({});
const start = () => startForm.post(route('games.start', props.game.id));

const leaveForm = useForm({});
const leave = () => leaveForm.post(route('games.leave', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">{{ $t('game.waiting') }} — {{ game.code }}</h1>
            <button type="button" class="text-sm text-red-600" @click="leave">
                {{ $t('game.leaveGame') }}
            </button>
        </div>

        <p v-if="game.isAdmin" class="text-sm text-gray-500">{{ $t('game.youAreAdmin') }}</p>

        <div>
            <h2 class="font-semibold">{{ $t('game.participants') }} ({{ game.participants.length }})</h2>
            <ul class="mt-2 space-y-1">
                <li v-for="p in game.participants" :key="p.userId" class="text-sm">{{ p.name }}</li>
            </ul>
        </div>

        <template v-if="game.isAdmin">
            <div class="rounded-lg border p-4">
                <h2 class="font-semibold">{{ $t('game.adminSettings') }}</h2>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.adminWritesComments"
                        @change="toggle('games.settings.admin-writes-comments', 'adminWritesComments')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.adminWritesCommentsTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.adminWritesCommentsDescription') }}</span>
                    </span>
                </label>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.showSurnames"
                        @change="toggle('games.settings.show-surnames', 'showSurnames')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.showSurnamesTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.showSurnamesDescription') }}</span>
                    </span>
                </label>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.showGuessResults"
                        @change="toggle('games.settings.show-guess-results', 'showGuessResults')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.showGuessResultsTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.showGuessResultsDescription') }}</span>
                    </span>
                </label>

                <div class="mt-3">
                    <span class="text-sm font-medium">{{ $t('game.targetSelectionModeTitle') }}</span>
                    <span class="block text-xs text-gray-500">{{ $t('game.targetSelectionModeDescription') }}</span>
                    <select
                        class="mt-1 rounded border-gray-300 text-sm"
                        :value="game.settings.targetSelectionMode"
                        @change="settingsForm.transform(() => ({ value: $event.target.value })).post(route('games.settings.target-selection-mode', game.id))"
                    >
                        <option value="random">{{ $t('game.targetSelectionRandom') }}</option>
                        <option value="chronological">{{ $t('game.targetSelectionChronological') }}</option>
                    </select>
                </div>
            </div>

            <button
                type="button"
                class="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-25"
                :disabled="game.participants.length < 2"
                @click="start"
            >
                {{ $t('game.startGame') }}
            </button>
        </template>
        <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForAdminStart') }}</p>
    </div>
</template>
```

(`game.ui.waitingForAdminStart` needs adding to both `resources/js/locales/{en,uk}.json` under `game.waitingForAdminStart` — EN "Waiting for the admin to start the game...", UK "Чекаємо, поки адміністратор почне гру..." — add this key to both files created in Task 3 as part of this task's diff.)

- [ ] **Step 4: Build and test**

```bash
npm run build
php artisan test --filter=WaitingPageTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Waiting.vue resources/js/locales tests/Feature/WaitingPageTest.php
git commit -m "Rebuild the Waiting page with participants, admin controls, and leave"
```

---

### Task 8: `Active.vue` — comment-writing flow, and completing `Show.vue`'s routing

**Files:**
- Create: `laravel/resources/js/Pages/Game/Mirror/Active.vue`
- Modify: `laravel/resources/js/Pages/Game/Show.vue`
- Test: `laravel/tests/Feature/ActivePageRoutingTest.php`

**Interfaces:**
- Consumes: `game.currentRound.{targetUserId, targetUserName, comments, commentsVisible, guessesFinalized}`, `game.isAdmin`, `game.settings.adminWritesComments` (all phase 1); `POST games/{id}/comments`, `POST games/{id}/show-comments` (both phase 1); `$t` (Task 3). The current user's own ID isn't directly in `GameResource` — get it from the existing Inertia-shared `auth.user.id` prop (already shared by `HandleInertiaRequests`, phase 1 Breeze scaffold), read via `usePage().props.auth.user.id`.
- Produces: `Active.vue` component, default-exported, taking a single `game` prop — the shape every later task in this file (9, 10) extends.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('an active game with an unfinalized round routes to the Active component', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page->component('Game/Show'));
    // Show.vue's phase routing is a client-side computed; the meaningful check here is
    // that the props it branches on (status, currentRound.guessesFinalized) are present
    // and correct — verified directly rather than via component-name assertion, since
    // Inertia's server-side test helpers see the wrapper page ('Game/Show'), not the
    // dynamically-rendered child component.
    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'active')
        ->where('game.currentRound.guessesFinalized', false)
    );
});

test('an active game with an already-finalized current round is distinguishable from a fresh one', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id, 'guesses_finalized' => true,
    ]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page->where('game.currentRound.guessesFinalized', true));
});
```

Save as `tests/Feature/ActivePageRoutingTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ActivePageRoutingTest`
Expected: PASS already (the props already exist from phase 1/Task 6) — this task's real work is the Vue template and `Show.vue`'s computed. Proceed to Step 3.

- [ ] **Step 3: Complete `Show.vue`'s routing**

```vue
<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { router } from '@inertiajs/vue3';
import Waiting from './Mirror/Waiting.vue';
import Active from './Mirror/Active.vue';
import Results from './Mirror/Results.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    if (props.game.status === 'finished') return Results;
    if (props.game.status === 'active') {
        return props.game.currentRound?.guessesFinalized ? Results : Active;
    }
    if (props.game.status === 'guessing_phase') return Results; // replaced with Guessing in Task 11
    return Waiting;
});

onMounted(() => {
    window.Echo.private(`game.${props.game.id}`).listen('GameUpdated', () => {
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

(The `guessing_phase` branch temporarily points at `Results` — Task 11 replaces it with the real `Guessing` component once that file exists. This keeps every intermediate task's app in a buildable, non-crashing state rather than importing a component that doesn't exist yet.)

- [ ] **Step 4: Build `Active.vue`**

```vue
<script setup>
import { computed } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);
const myComment = computed(() => round.value?.comments.find((c) => c.authorId === currentUserId.value));
const isAdminNotWriting = computed(() => props.game.isAdmin && !props.game.settings.adminWritesComments);

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>
            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>
            <!-- The revealed-comments view for the target is added in Task 9. -->
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="myComment">
            <p class="text-sm text-green-700">{{ $t('game.commentSentWaitingShow') }}</p>
        </template>

        <template v-else>
            <form @submit.prevent="submitComment" class="space-y-2">
                <textarea
                    v-model="commentForm.text"
                    :placeholder="$t('game.commentPlaceholder')"
                    maxlength="500"
                    rows="4"
                    class="w-full rounded border-gray-300"
                />
                <p class="text-xs text-gray-400">{{ commentForm.text.length }}/500</p>
                <p v-if="commentForm.errors.text" class="text-sm text-red-600">{{ commentForm.errors.text }}</p>
                <button
                    type="submit"
                    class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="commentForm.processing || !commentForm.text.trim()"
                >
                    {{ $t('game.submitComment') }}
                </button>
            </form>
        </template>

        <button
            v-if="canShowComments"
            type="button"
            class="mt-6 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="showComments"
        >
            {{ $t('game.showComments') }}
        </button>
    </div>
</template>
```

- [ ] **Step 5: Build and test**

```bash
npm run build
php artisan test --filter=ActivePageRoutingTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Active.vue resources/js/Pages/Game/Show.vue tests/Feature/ActivePageRoutingTest.php
git commit -m "Add the Active page's comment-writing flow and complete Show.vue's phase routing"
```

---

### Task 9: `Active.vue` — target's revealed-comments view, per-comment point awarding, finish-awarding

**Files:**
- Modify: `laravel/resources/js/Pages/Game/Mirror/Active.vue` (full file replacement — this task's version below supersedes Task 8's)
- Test: `laravel/tests/Feature/ActivePageAwardingTest.php`

**Interfaces:**
- Consumes: `game.currentRound.comments[].{id, text, points}` (only populated with real `text` once `commentsVisible`, per phase 1's `GameResource`), `POST games/{id}/comment-points/{comment}`, `POST games/{id}/finish-awarding-points` (both phase 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once comments are visible, the target sees the comment text and existing points', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id, 'comments_visible' => true,
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate', 'points' => 2]);

    $response = $this->actingAs($target)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.comments.0.text', 'Great teammate')
        ->where('game.currentRound.comments.0.points', 2)
    );
});
```

Save as `tests/Feature/ActivePageAwardingTest.php`. (As with the routing test, the meaningful server-side check is prop shape — the award-button click flow itself is verified by code review during task review.)

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ActivePageAwardingTest`
Expected: PASS already (props unchanged since phase 1) — proceed to Step 3 for the template work.

- [ ] **Step 3: Replace `Active.vue` in full**

```vue
<script setup>
import { computed, reactive } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);
const myComment = computed(() => round.value?.comments.find((c) => c.authorId === currentUserId.value));
const isAdminNotWriting = computed(() => props.game.isAdmin && !props.game.settings.adminWritesComments);

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);

// One local point value per comment, keyed by comment id — the award form for each
// comment is independent (a comment can be awarded once its own points input is set).
const pointsByComment = reactive({});
const awardForms = {};
const awardPoints = (commentId) => {
    if (!awardForms[commentId]) {
        awardForms[commentId] = useForm({ points: 0 });
    }
    awardForms[commentId].points = pointsByComment[commentId] ?? 0;
    awardForms[commentId].post(route('games.comment-points', [props.game.id, commentId]));
};

const finishAwardingForm = useForm({});
const finishAwarding = () => finishAwardingForm.post(route('games.finish-awarding-points', props.game.id));

const allCommentsAwarded = computed(
    () => round.value?.comments.length > 0 && round.value.comments.every((c) => c.points !== null),
);
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>

            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>

            <template v-else-if="!round.pointsGiven">
                <h2 class="font-semibold">{{ $t('game.awardPointsToComments') }}</h2>
                <ul class="space-y-3">
                    <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                        <p class="text-sm">{{ comment.text }}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                v-model.number="pointsByComment[comment.id]"
                                class="w-20 rounded border-gray-300 text-sm"
                                :disabled="comment.points !== null"
                            />
                            <button
                                type="button"
                                class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                                :disabled="comment.points !== null"
                                @click="awardPoints(comment.id)"
                            >
                                {{ comment.points !== null ? comment.points : $t('game.givePoints') }}
                            </button>
                        </div>
                    </li>
                </ul>
                <button
                    type="button"
                    class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="!allCommentsAwarded"
                    @click="finishAwarding"
                >
                    {{ $t('game.finishAwarding') }}
                </button>
            </template>

            <p v-else class="text-sm text-gray-500">
                {{ $t('game.finishedAwardingPointsWaitAdmin') }}
            </p>
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="myComment">
            <p class="text-sm text-green-700">{{ $t('game.commentSentWaitingShow') }}</p>
        </template>

        <template v-else>
            <form @submit.prevent="submitComment" class="space-y-2">
                <textarea
                    v-model="commentForm.text"
                    :placeholder="$t('game.commentPlaceholder')"
                    maxlength="500"
                    rows="4"
                    class="w-full rounded border-gray-300"
                />
                <p class="text-xs text-gray-400">{{ commentForm.text.length }}/500</p>
                <p v-if="commentForm.errors.text" class="text-sm text-red-600">{{ commentForm.errors.text }}</p>
                <button
                    type="submit"
                    class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="commentForm.processing || !commentForm.text.trim()"
                >
                    {{ $t('game.submitComment') }}
                </button>
            </form>
        </template>

        <button
            v-if="canShowComments"
            type="button"
            class="mt-6 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="showComments"
        >
            {{ $t('game.showComments') }}
        </button>
    </div>
</template>
```

- [ ] **Step 4: Build and test**

```bash
npm run build
php artisan test --filter=ActivePageAwardingTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Active.vue tests/Feature/ActivePageAwardingTest.php
git commit -m "Add the target's comment-reveal, point-awarding, and finish-awarding views"
```

---

### Task 10: `Active.vue` — give-target-points/skip actions and the admin's start-guessing control

**Files:**
- Modify: `laravel/resources/js/Pages/Game/Mirror/Active.vue` (full file replacement — this task's version supersedes Task 9's)
- Test: `laravel/tests/Feature/ActivePagePostCommentTest.php`

**Interfaces:**
- Consumes: `game.currentRound.{pointsGiven, targetPointsGivenBy}`, `game.playersWhoCompletedPostCommentPhase` (Task 6), `POST games/{id}/target-points`, `POST games/{id}/skip-post-comment-phase`, `POST games/{id}/start-guessing` (all phase 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once points are given, the resource exposes who has already completed the post-comment phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'active',
        'players_who_completed_post_comment_phase' => [],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'points_given' => true, 'target_points_given_by' => [],
    ]);

    $response = $this->actingAs($author)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.pointsGiven', true)
        ->where('game.currentRound.targetPointsGivenBy', [])
        ->where('game.playersWhoCompletedPostCommentPhase', [])
    );
});
```

Save as `tests/Feature/ActivePagePostCommentTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ActivePagePostCommentTest`
Expected: PASS already (all props already exist from Task 6) — proceed to Step 3.

- [ ] **Step 3: Replace `Active.vue` in full**

```vue
<script setup>
import { computed, reactive } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);
const myComment = computed(() => round.value?.comments.find((c) => c.authorId === currentUserId.value));
const isAdminNotWriting = computed(() => props.game.isAdmin && !props.game.settings.adminWritesComments);

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);

const pointsByComment = reactive({});
const awardForms = {};
const awardPoints = (commentId) => {
    if (!awardForms[commentId]) {
        awardForms[commentId] = useForm({ points: 0 });
    }
    awardForms[commentId].points = pointsByComment[commentId] ?? 0;
    awardForms[commentId].post(route('games.comment-points', [props.game.id, commentId]));
};

const finishAwardingForm = useForm({});
const finishAwarding = () => finishAwardingForm.post(route('games.finish-awarding-points', props.game.id));

const allCommentsAwarded = computed(
    () => round.value?.comments.length > 0 && round.value.comments.every((c) => c.points !== null),
);

// "Post-comment phase": once the target has finished awarding, everyone else either
// gives the target bonus points or explicitly skips — tracked per-user so a reload
// shows a waiting message instead of the action buttons again.
const iAlreadyCompletedPostComment = computed(
    () => props.game.playersWhoCompletedPostCommentPhase.includes(String(currentUserId.value)),
);
const targetPointsForm = useForm({ points: 1 });
const giveTargetPoints = () => targetPointsForm.post(route('games.target-points', props.game.id));

const skipForm = useForm({});
const skipPostComment = () => skipForm.post(route('games.skip-post-comment-phase', props.game.id));

const startGuessingForm = useForm({});
const startGuessing = () => startGuessingForm.post(route('games.start-guessing', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>

            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>

            <template v-else-if="!round.pointsGiven">
                <h2 class="font-semibold">{{ $t('game.awardPointsToComments') }}</h2>
                <ul class="space-y-3">
                    <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                        <p class="text-sm">{{ comment.text }}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                v-model.number="pointsByComment[comment.id]"
                                class="w-20 rounded border-gray-300 text-sm"
                                :disabled="comment.points !== null"
                            />
                            <button
                                type="button"
                                class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                                :disabled="comment.points !== null"
                                @click="awardPoints(comment.id)"
                            >
                                {{ comment.points !== null ? comment.points : $t('game.givePoints') }}
                            </button>
                        </div>
                    </li>
                </ul>
                <button
                    type="button"
                    class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="!allCommentsAwarded"
                    @click="finishAwarding"
                >
                    {{ $t('game.finishAwarding') }}
                </button>
            </template>

            <p v-else class="text-sm text-gray-500">
                {{ $t('game.finishedAwardingPointsWaitAdmin') }}
            </p>
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="!myComment && !round.pointsGiven">
            <form @submit.prevent="submitComment" class="space-y-2">
                <textarea
                    v-model="commentForm.text"
                    :placeholder="$t('game.commentPlaceholder')"
                    maxlength="500"
                    rows="4"
                    class="w-full rounded border-gray-300"
                />
                <p class="text-xs text-gray-400">{{ commentForm.text.length }}/500</p>
                <p v-if="commentForm.errors.text" class="text-sm text-red-600">{{ commentForm.errors.text }}</p>
                <button
                    type="submit"
                    class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="commentForm.processing || !commentForm.text.trim()"
                >
                    {{ $t('game.submitComment') }}
                </button>
            </form>
        </template>

        <template v-else-if="round.pointsGiven && !iAlreadyCompletedPostComment">
            <h2 class="font-semibold">{{ $t('game.awardPointsToTarget') }}</h2>
            <div class="flex items-center gap-2">
                <input type="number" min="1" v-model.number="targetPointsForm.points" class="w-20 rounded border-gray-300 text-sm" />
                <button type="button" class="rounded bg-indigo-600 px-3 py-1 text-sm text-white" @click="giveTargetPoints">
                    {{ $t('game.givePoints') }}
                </button>
                <button type="button" class="text-sm text-gray-500 underline" @click="skipPostComment">
                    {{ $t('game.skip') }}
                </button>
            </div>
        </template>

        <template v-else-if="round.pointsGiven && iAlreadyCompletedPostComment && !myComment">
            <p class="text-sm text-green-700">{{ $t('game.commentSentWaitingShow') }}</p>
        </template>

        <template v-else-if="myComment && round.pointsGiven">
            <p class="text-sm text-gray-500">{{ $t('game.waitingForAllPlayers') }}</p>
        </template>

        <button
            v-if="canShowComments"
            type="button"
            class="mt-6 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="showComments"
        >
            {{ $t('game.showComments') }}
        </button>

        <button
            v-if="game.isAdmin && round.commentsVisible && round.pointsGiven"
            type="button"
            class="mt-2 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="startGuessing"
        >
            {{ $t('game.guessingPhase') }}
        </button>
        <p v-if="startGuessingForm.errors.game" class="text-sm text-red-600">{{ startGuessingForm.errors.game }}</p>
    </div>
</template>
```

(The admin's start-guessing button appears once `commentsVisible && pointsGiven` — the same two flags the backend itself checks first. It does NOT independently re-derive the "everyone completed the post-comment phase" count; clicking it while players are still mid-phase surfaces the backend's own translated `"Cannot start guessing phase. Waiting for :count player(s)..."` message via `startGuessingForm.errors.game`, per this plan's design choice to let the backend stay the single source of truth for that gate rather than duplicating it client-side.)

- [ ] **Step 4: Build and test**

```bash
npm run build
php artisan test --filter=ActivePagePostCommentTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Active.vue tests/Feature/ActivePagePostCommentTest.php
git commit -m "Add give-target-points/skip actions and the admin's start-guessing control"
```

---

### Task 11: `Guessing.vue` — target's guess submission, mark-submitted, and wiring into `Show.vue`

**Files:**
- Create: `laravel/resources/js/Pages/Game/Mirror/Guessing.vue`
- Modify: `laravel/resources/js/Pages/Game/Show.vue`
- Modify: `laravel/resources/js/locales/en.json`, `laravel/resources/js/locales/uk.json` (two new keys)
- Test: `laravel/tests/Feature/GuessingPageTest.php`

**Interfaces:**
- Consumes: `game.currentRound.{comments, guessingPossibleAuthors, guesses, targetUserId}` (Task 6), `POST games/{id}/guesses`, `POST games/{id}/mark-guesses-submitted` (both phase 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('during guessing_phase, the resource exposes possible authors and comments to guess about', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate']);

    $response = $this->actingAs($target)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'guessing_phase')
        ->where('game.currentRound.guessingPossibleAuthors.0.userName', $author->name)
        ->where('game.currentRound.comments.0.text', 'Great teammate')
    );
});
```

Save as `tests/Feature/GuessingPageTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GuessingPageTest`
Expected: PASS already (all props exist since Task 6) — proceed to Step 3.

- [ ] **Step 3: Add the two new locale keys**

To `resources/js/locales/en.json`'s `game` object: `"waitingForTargetGuesses": "Waiting for target to guess the authors..."`.
To `resources/js/locales/uk.json`'s `game` object: `"waitingForTargetGuesses": "Очікування на вгадування цільового гравця..."`.

- [ ] **Step 4: Build `Guessing.vue`**

```vue
<script setup>
import { computed, reactive } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);

const myGuesses = computed(() =>
    Object.fromEntries(
        round.value.guesses
            .filter((g) => g.guesserId === currentUserId.value)
            .map((g) => [g.commentId, g.guessedAuthorId]),
    ),
);

const selections = reactive({});
const guessForm = useForm({ comment_id: null, guessed_author_id: null });
const submitGuess = (commentId) => {
    guessForm.comment_id = commentId;
    guessForm.guessed_author_id = selections[commentId];
    guessForm.post(route('games.guesses.store', props.game.id));
};

const allGuessed = computed(() => round.value.comments.every((c) => c.id in myGuesses.value));

const markSubmittedForm = useForm({});
const markSubmitted = () => markSubmittedForm.post(route('games.mark-guesses-submitted', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.guessingPhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-500">{{ $t('game.guessingPhaseSubtitle') }}</p>
            <ul class="space-y-3">
                <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                    <p class="text-sm">{{ comment.text }}</p>
                    <div class="mt-2 flex items-center gap-2">
                        <select
                            v-model="selections[comment.id]"
                            class="rounded border-gray-300 text-sm"
                            :disabled="comment.id in myGuesses"
                        >
                            <option :value="null" disabled>{{ $t('game.target') }}?</option>
                            <option
                                v-for="author in round.guessingPossibleAuthors"
                                :key="author.userId"
                                :value="Number(author.userId)"
                            >
                                {{ author.userName }}
                            </option>
                        </select>
                        <button
                            type="button"
                            class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                            :disabled="comment.id in myGuesses || !selections[comment.id]"
                            @click="submitGuess(comment.id)"
                        >
                            {{ comment.id in myGuesses ? '✓' : $t('game.submitComment') }}
                        </button>
                    </div>
                </li>
            </ul>
            <button
                v-if="allGuessed"
                type="button"
                class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                @click="markSubmitted"
            >
                {{ $t('game.finishGuesses') }}
            </button>
        </template>

        <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForTargetGuesses') }}</p>
    </div>
</template>
```

- [ ] **Step 5: Wire `Guessing.vue` into `Show.vue`**

```vue
<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { router } from '@inertiajs/vue3';
import Waiting from './Mirror/Waiting.vue';
import Active from './Mirror/Active.vue';
import Guessing from './Mirror/Guessing.vue';
import Results from './Mirror/Results.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    if (props.game.status === 'finished') return Results;
    if (props.game.status === 'active') {
        return props.game.currentRound?.guessesFinalized ? Results : Active;
    }
    if (props.game.status === 'guessing_phase') return Guessing;
    return Waiting;
});

onMounted(() => {
    window.Echo.private(`game.${props.game.id}`).listen('GameUpdated', () => {
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

- [ ] **Step 6: Build and test**

```bash
npm run build
php artisan test --filter=GuessingPageTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Guessing.vue resources/js/Pages/Game/Show.vue resources/js/locales tests/Feature/GuessingPageTest.php
git commit -m "Add the Guessing page's guess-submission flow and wire it into Show.vue"
```

---

### Task 12: `Guessing.vue` — the post-guessing bonus-points phase

**Files:**
- Modify: `laravel/resources/js/Pages/Game/Mirror/Guessing.vue` (full file replacement — this task's version supersedes Task 11's)
- Modify: `laravel/resources/js/locales/en.json`, `laravel/resources/js/locales/uk.json` (one new key)
- Test: `laravel/tests/Feature/GuessingPagePostAwardsTest.php`

**Interfaces:**
- Consumes: `game.postGuessingPointPhase`, `game.playersWhoAwardedPostGuessPoints` (Task 6), `game.participants`, `POST games/{id}/post-guessing-awards` (phase 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once the post-guessing point phase is active, the resource exposes who has already awarded', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'guessing_phase',
        'post_guessing_point_phase' => true,
        'players_who_awarded_post_guess_points' => [],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.postGuessingPointPhase', true)
        ->where('game.playersWhoAwardedPostGuessPoints', [])
    );
});
```

Save as `tests/Feature/GuessingPagePostAwardsTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=GuessingPagePostAwardsTest`
Expected: PASS already (props exist since phase 1/Task 6) — proceed to Step 3.

- [ ] **Step 3: Add one new locale key**

To `resources/js/locales/en.json`'s `game` object: `"postGuessingStartPhaseTitle": "Award Bonus Points"`.
To `resources/js/locales/uk.json`'s `game` object: `"postGuessingStartPhaseTitle": "Нарахування бонусних балів"`.

- [ ] **Step 4: Replace `Guessing.vue` in full**

```vue
<script setup>
import { computed, reactive } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);

const myGuesses = computed(() =>
    Object.fromEntries(
        round.value.guesses
            .filter((g) => g.guesserId === currentUserId.value)
            .map((g) => [g.commentId, g.guessedAuthorId]),
    ),
);

const selections = reactive({});
const guessForm = useForm({ comment_id: null, guessed_author_id: null });
const submitGuess = (commentId) => {
    guessForm.comment_id = commentId;
    guessForm.guessed_author_id = selections[commentId];
    guessForm.post(route('games.guesses.store', props.game.id));
};

const allGuessed = computed(() => round.value.comments.every((c) => c.id in myGuesses.value));

const markSubmittedForm = useForm({});
const markSubmitted = () => markSubmittedForm.post(route('games.mark-guesses-submitted', props.game.id));

// Post-guessing bonus points: any participant except yourself, once per phase.
const iAlreadyAwarded = computed(
    () => props.game.playersWhoAwardedPostGuessPoints.includes(String(currentUserId.value)),
);
const otherParticipants = computed(() => props.game.participants.filter((p) => p.userId !== currentUserId.value));
const bonusPoints = reactive({});
const awardsForm = useForm({ awards: [] });
const submitAwards = () => {
    awardsForm.awards = otherParticipants.value
        .filter((p) => (bonusPoints[p.userId] ?? 0) > 0)
        .map((p) => ({ recipientId: p.userId, points: bonusPoints[p.userId] }));
    awardsForm.post(route('games.post-guessing-awards', props.game.id));
};
const hasAnyBonusPoints = computed(() => otherParticipants.value.some((p) => (bonusPoints[p.userId] ?? 0) > 0));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.guessingPhase') }}</h1>

        <template v-if="!game.postGuessingPointPhase">
            <template v-if="isTarget">
                <p class="text-sm text-gray-500">{{ $t('game.guessingPhaseSubtitle') }}</p>
                <ul class="space-y-3">
                    <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                        <p class="text-sm">{{ comment.text }}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <select
                                v-model="selections[comment.id]"
                                class="rounded border-gray-300 text-sm"
                                :disabled="comment.id in myGuesses"
                            >
                                <option :value="null" disabled>{{ $t('game.target') }}?</option>
                                <option
                                    v-for="author in round.guessingPossibleAuthors"
                                    :key="author.userId"
                                    :value="Number(author.userId)"
                                >
                                    {{ author.userName }}
                                </option>
                            </select>
                            <button
                                type="button"
                                class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                                :disabled="comment.id in myGuesses || !selections[comment.id]"
                                @click="submitGuess(comment.id)"
                            >
                                {{ comment.id in myGuesses ? '✓' : $t('game.submitComment') }}
                            </button>
                        </div>
                    </li>
                </ul>
                <button
                    v-if="allGuessed"
                    type="button"
                    class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    @click="markSubmitted"
                >
                    {{ $t('game.finishGuesses') }}
                </button>
            </template>

            <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForTargetGuesses') }}</p>
        </template>

        <template v-else>
            <h2 class="font-semibold">{{ $t('game.postGuessingStartPhaseTitle') }}</h2>
            <p class="text-sm text-gray-500">{{ $t('game.postGuessingStartPhaseDesc') }}</p>

            <template v-if="!iAlreadyAwarded">
                <ul class="space-y-2">
                    <li v-for="p in otherParticipants" :key="p.userId" class="flex items-center justify-between gap-2">
                        <span class="text-sm">{{ p.name }}</span>
                        <input
                            type="number"
                            min="0"
                            v-model.number="bonusPoints[p.userId]"
                            class="w-20 rounded border-gray-300 text-sm"
                        />
                    </li>
                </ul>
                <button
                    type="button"
                    class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="!hasAnyBonusPoints"
                    @click="submitAwards"
                >
                    {{ $t('game.givePoints') }}
                </button>
            </template>
            <p v-else class="text-sm text-gray-500">{{ $t('game.postGuessingAlreadyAwarded') }}</p>
        </template>
    </div>
</template>
```

- [ ] **Step 5: Build and test**

```bash
npm run build
php artisan test --filter=GuessingPagePostAwardsTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Guessing.vue resources/js/locales tests/Feature/GuessingPagePostAwardsTest.php
git commit -m "Add the post-guessing bonus-points phase to the Guessing page"
```

---

### Task 13: Admin's finalize-guessing control, `Results.vue` polish, and next-round

**Files:**
- Modify: `laravel/resources/js/Pages/Game/Mirror/Guessing.vue` (full file replacement — this task's version supersedes Task 12's; adds one admin-only button)
- Modify: `laravel/resources/js/Pages/Game/Mirror/Results.vue` (full rewrite)
- Test: `laravel/tests/Feature/FinalizeAndResultsPageTest.php`

**Interfaces:**
- Consumes: `game.leaderboard`, `game.adminLeft`, `game.isAdmin`, `game.status` (all phase 1), `POST games/{id}/finalize-guessing`, `POST games/{id}/next-round` (both phase 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the leaderboard and admin-left flag are available for the Results page', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'finished', 'admin_left' => false]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create(['name' => 'Player One']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 5]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'finished')
        ->where('game.leaderboard.0.name', 'Player One')
        ->where('game.leaderboard.0.totalPoints', 5)
        ->where('game.isAdmin', true)
    );
});
```

Save as `tests/Feature/FinalizeAndResultsPageTest.php`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=FinalizeAndResultsPageTest`
Expected: PASS already (leaderboard/adminLeft/isAdmin all exist since phase 1) — proceed to Step 3.

- [ ] **Step 3: Add the finalize button to `Guessing.vue`**

Add, just before `guessForm`'s declaration in `<script setup>` (or anywhere alongside the other form declarations):

```js
const finalizeForm = useForm({});
const finalize = () => finalizeForm.post(route('games.finalize-guessing', props.game.id));
```

Add, at the end of the `<template>`'s root `<div>`, after the closing `</template>` of the `v-else` (post-guessing) block:

```vue
<button
    v-if="game.isAdmin && game.postGuessingPointPhase"
    type="button"
    class="mt-4 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
    @click="finalize"
>
    {{ $t('game.finalizeGuessing') }}
</button>
```

- [ ] **Step 4: Rewrite `Results.vue`**

```vue
<script setup>
import { useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });

const nextRoundForm = useForm({});
const nextRound = () => nextRoundForm.post(route('games.next-round', props.game.id));

const medal = (index) => ['🥇', '🥈', '🥉'][index] ?? '';
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.leaderboard') }}</h1>

        <p v-if="game.adminLeft" class="rounded bg-red-50 p-3 text-sm text-red-700">
            {{ $t('game.adminLeftTitle') }} — {{ $t('game.adminLeftMessage') }}
        </p>

        <ol class="space-y-2">
            <li
                v-for="(entry, i) in game.leaderboard"
                :key="entry.userId"
                class="flex items-center justify-between rounded border p-3"
            >
                <span>{{ medal(i) }} {{ entry.name }}</span>
                <span class="text-sm text-gray-500">
                    {{ entry.totalPoints }} {{ $t('game.points') }}
                    ({{ entry.gamePoints }} + {{ entry.guessPoints }} {{ $t('game.correctGuesses') }})
                </span>
            </li>
        </ol>

        <p v-if="game.status === 'finished'" class="text-center font-semibold">{{ $t('game.gameOver') }}</p>

        <button
            v-if="game.isAdmin && game.status !== 'finished' && !game.adminLeft"
            type="button"
            class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="nextRound"
        >
            {{ $t('game.nextRound') }}
        </button>
    </div>
</template>
```

(This page renders both the mid-game "round just finalized, waiting for the admin to start the next one" state — `status === 'active'` with a finalized current round, per `Show.vue`'s routing from Task 8 — and the true end-of-game state — `status === 'finished'`. The `game.gameOver` text and the absence of a next-round button are the only visual differences between them, matching the backend's own "no more eligible targets" vs. "there's another round" branch in `startNextRound`.)

- [ ] **Step 5: Build and test**

```bash
npm run build
php artisan test --filter=FinalizeAndResultsPageTest
php artisan test
```
Expected: build succeeds, both PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Game/Mirror/Guessing.vue resources/js/Pages/Game/Mirror/Results.vue tests/Feature/FinalizeAndResultsPageTest.php
git commit -m "Add the admin's finalize-guessing control and polish the Results page"
```

---

## Self-Review

**Spec coverage:**
- Localization architecture (locale column/middleware/switch endpoint, backend `lang/*.json` + `__()`, frontend `vue-i18n` + ported catalogs, switcher component) — Tasks 1–3.
- Auth pages (Google button, translated Login/Register) — Task 4.
- Dashboard create/join form — Task 5.
- `GameResource` data needed by the remaining pages — Task 6.
- Waiting.vue (participants, admin start/settings, leave) — Task 7.
- Active.vue (comment writing, reveal/award/finish-awarding, give-target-points/skip, admin show-comments/start-guessing) — Tasks 8–10.
- Guessing.vue (guess submission/mark-submitted, post-guessing bonus points, admin finalize) — Tasks 11–13.
- Results.vue polish + next-round, and the "between rounds" state — Task 13.
- `Show.vue`'s complete phase routing — Tasks 8 (active) and 11 (guessing_phase).
- Non-Goals (no Basket/Clash/Ideas, no admin round-tools, no browser E2E, no pixel-parity with `apps/web`, no additional languages) — none introduced across all 13 tasks.

**Placeholder scan:** every task's code steps contain complete, runnable code — no "add appropriate handling," no truncated Vue templates. The two spots that could look like placeholders are addressed inline: Task 8's `guessing_phase` branch temporarily pointing at `Results` is explicitly labeled as intentional (kept the app buildable before `Guessing.vue` exists), corrected in Task 11's own diff; Task 4's thin `GoogleSignInButtonTest` is explicitly explained as covering what a Pest test can meaningfully check for a template-only change, not a placeholder for missing verification.

**Type consistency:** every `route()` name used across all 13 tasks (`games.store`, `games.join`, `games.start`, `games.leave`, `games.comments.store`, `games.show-comments`, `games.comment-points`, `games.finish-awarding-points`, `games.target-points`, `games.skip-post-comment-phase`, `games.start-guessing`, `games.guesses.store`, `games.mark-guesses-submitted`, `games.post-guessing-awards`, `games.finalize-guessing`, `games.next-round`, `games.settings.*`, `locale.update`) matches the exact names registered in phase 1's `routes/web.php` (reproduced in full in this plan's "Reference Material" gathering, cross-checked against the live file) plus Task 1's new `locale.update`. Every `GameResource` field referenced in a Vue template (`game.currentRound.guessingPossibleAuthors`, `.guesses`, `.targetPointsGivenBy`, `.guessingAllSubmitted`, `game.playersWhoCompletedPostCommentPhase`, `game.playersWhoAwardedPostGuessPoints`) is defined in Task 6 before any later task consumes it.

---

**PLAN COMPLETE**
