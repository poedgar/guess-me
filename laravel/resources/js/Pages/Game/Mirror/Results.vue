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
