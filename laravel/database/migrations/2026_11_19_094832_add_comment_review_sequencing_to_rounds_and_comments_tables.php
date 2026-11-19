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
        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedInteger('display_order')->nullable()->after('points');
        });

        Schema::table('rounds', function (Blueprint $table) {
            $table->foreignId('active_comment_id')->nullable()->after('points_given')
                ->constrained('comments')->nullOnDelete();
        });

        Schema::create('comment_reaction_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rater_id')->constrained('users');
            $table->boolean('rating');
            $table->timestamps();
            $table->unique(['comment_id', 'rater_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comment_reaction_ratings');

        Schema::table('rounds', function (Blueprint $table) {
            $table->dropConstrainedForeignId('active_comment_id');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('display_order');
        });
    }
};
