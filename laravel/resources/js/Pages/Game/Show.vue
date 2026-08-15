<script setup>
import { computed } from 'vue';
import Waiting from './Mirror/Waiting.vue';
import Results from './Mirror/Results.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    if (props.game.status === 'finished') return Results;
    // 'active' and 'guessing_phase' route to Active.vue / Guessing.vue, added in later tasks
    // of this same phase (not shown here to keep this task's diff focused on the leaderboard).
    return Waiting;
});
</script>

<template>
    <component :is="phaseComponent" :game="game" />
</template>
