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
