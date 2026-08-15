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
