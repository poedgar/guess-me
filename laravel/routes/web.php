<?php

use App\Http\Controllers\GameController;
use App\Http\Controllers\Mirror\CommentController;
use App\Http\Controllers\Mirror\RoundController;
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

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('games', [GameController::class, 'store'])->name('games.store');
    Route::post('games/join', [GameController::class, 'join'])->name('games.join');
    Route::get('games/{game}', [GameController::class, 'show'])->name('games.show');
    Route::post('games/{game}/start', [GameController::class, 'start'])->name('games.start');
    Route::post('games/{game}/comments', [CommentController::class, 'store'])->name('games.comments.store');
    Route::post('games/{game}/show-comments', [RoundController::class, 'showComments'])->name('games.show-comments');
    Route::post('games/{game}/comment-points/{comment}', [CommentController::class, 'awardPoints'])->name('games.comment-points');
    Route::post('games/{game}/finish-awarding-points', [CommentController::class, 'finishAwarding'])->name('games.finish-awarding-points');
    Route::post('games/{game}/target-points', [CommentController::class, 'giveTargetPoints'])->name('games.target-points');
    Route::post('games/{game}/skip-post-comment-phase', [CommentController::class, 'skipPostCommentPhase'])->name('games.skip-post-comment-phase');
});

require __DIR__.'/auth.php';
