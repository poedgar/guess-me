<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
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

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rounds');
    }
};
