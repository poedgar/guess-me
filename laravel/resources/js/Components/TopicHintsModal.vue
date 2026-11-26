<script setup>
import Modal from '@/Components/Modal.vue';
import { hintLabels } from '@/data/topicsData';

defineProps({
    show: { type: Boolean, default: false },
    hintKeys: { type: Array, default: () => [] },
});
defineEmits(['close']);
</script>

<template>
    <Modal :show="show" max-width="sm" @close="$emit('close')">
        <div class="p-6">
            <h3 class="text-center text-lg font-semibold">{{ $t('game.topicsHints.hintsModalTitle') }}</h3>
            <div class="mt-4 space-y-2">
                <p v-for="(key, idx) in hintKeys" :key="key">
                    {{ hintLabels[idx] }}) {{ $t(key) }}
                </p>
            </div>
            <button
                type="button"
                class="mt-6 w-full rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                @click="$emit('close')"
            >
                {{ $t('common.done') }}
            </button>
        </div>
    </Modal>
</template>
