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
