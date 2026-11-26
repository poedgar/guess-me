<?php

use App\Http\Controllers\GameController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\Mirror\CommentController;
use App\Http\Controllers\Mirror\GuessingController;
use App\Http\Controllers\Mirror\RoundController;
use App\Http\Controllers\Mirror\SettingsController;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::get('rules', fn () => Inertia::render('Rules'))->name('rules');

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('games', [GameController::class, 'store'])->middleware('throttle:6,1')->name('games.store');
    Route::post('games/join', [GameController::class, 'join'])->name('games.join');
    Route::get('games/{game}', [GameController::class, 'show'])->name('games.show');
    Route::post('games/{game}/start', [GameController::class, 'start'])->name('games.start');
    Route::post('games/{game}/leave', [GameController::class, 'leave'])->name('games.leave');
    Route::post('games/{game}/update-name', [GameController::class, 'updateName'])->name('games.update-name');
    Route::post('games/{game}/comments', [CommentController::class, 'store'])->name('games.comments.store');
    Route::post('games/{game}/show-comments', [RoundController::class, 'showComments'])->name('games.show-comments');
    Route::post('games/{game}/comments/{comment}/activate', [CommentController::class, 'activate'])->name('games.comments.activate');
    Route::post('games/{game}/next-round', [RoundController::class, 'next'])->name('games.next-round');
    Route::post('games/{game}/comment-points/{comment}', [CommentController::class, 'awardPoints'])->name('games.comment-points');
    Route::post('games/{game}/comments/{comment}/rate-reaction', [CommentController::class, 'rateTargetReaction'])->name('games.comments.rate-reaction');
    Route::post('games/{game}/comments/{comment}/send-back', [CommentController::class, 'sendBack'])->name('games.comments.send-back');
    Route::post('games/{game}/start-guessing', [GuessingController::class, 'start'])->name('games.start-guessing');
    Route::post('games/{game}/guesses', [GuessingController::class, 'submitGuess'])->name('games.guesses.store');
    Route::post('games/{game}/mark-guesses-submitted', [GuessingController::class, 'markSubmitted'])->name('games.mark-guesses-submitted');
    Route::post('games/{game}/post-guessing-awards', [GuessingController::class, 'awardPoints'])->name('games.post-guessing-awards');
    Route::post('games/{game}/finalize-guessing', [GuessingController::class, 'finalize'])->name('games.finalize-guessing');
    Route::post('games/{game}/settings/admin-writes-comments', [SettingsController::class, 'adminWritesComments'])->name('games.settings.admin-writes-comments');
    Route::post('games/{game}/settings/show-surnames', [SettingsController::class, 'showSurnames'])->name('games.settings.show-surnames');
    Route::post('games/{game}/settings/target-selection-mode', [SettingsController::class, 'targetSelectionMode'])->name('games.settings.target-selection-mode');
    Route::post('games/{game}/settings/show-guess-results', [SettingsController::class, 'showGuessResults'])->name('games.settings.show-guess-results');
    Route::post('games/{game}/settings/active-topic', [SettingsController::class, 'activeTopic'])->name('games.settings.active-topic');
});

require __DIR__.'/auth.php';
