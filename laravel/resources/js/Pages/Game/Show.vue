<script setup>
import { computed } from 'vue';
import Waiting from './Mirror/Waiting.vue';

const props = defineProps({ game: Object });

const phaseComponent = computed(() => {
    // Only 'waiting' is wired up so far — later tasks add Active/Guessing/Results.
    return Waiting;
});
</script>

<template>
    <component :is="phaseComponent" :game="game" />
</template>
