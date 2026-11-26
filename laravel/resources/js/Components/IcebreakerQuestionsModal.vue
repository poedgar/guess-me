<script setup>
import { ref } from 'vue';
import Modal from '@/Components/Modal.vue';

defineProps({ show: { type: Boolean, default: false } });
defineEmits(['close']);

const questions = [
    { a: 'game.icebreaker.question1a', b: 'game.icebreaker.question1b' },
    { a: 'game.icebreaker.question2a', b: 'game.icebreaker.question2b' },
    { a: 'game.icebreaker.question3a', b: 'game.icebreaker.question3b' },
];

const activeIndex = ref(0);
</script>

<template>
    <Modal :show="show" max-width="sm" @close="$emit('close')">
        <div class="p-6">
            <h2 class="text-center text-lg font-semibold">{{ $t('game.icebreaker.modalTitle') }}</h2>
            <p class="mt-2 text-center text-sm text-gray-500">{{ $t('game.icebreaker.instructions') }}</p>

            <div class="mt-4 flex justify-center gap-3">
                <button
                    v-for="(_, idx) in questions"
                    :key="idx"
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                    :class="activeIndex === idx ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'"
                    @click="activeIndex = idx"
                >
                    {{ idx + 1 }}
                </button>
            </div>

            <div class="mt-6 space-y-2">
                <p>а) {{ $t(questions[activeIndex].a) }}</p>
                <p>б) {{ $t(questions[activeIndex].b) }}</p>
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
