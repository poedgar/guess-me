<script setup>
import { computed, ref } from 'vue';
import Modal from '@/Components/Modal.vue';

defineProps({ show: { type: Boolean, default: false } });
const emit = defineEmits(['close']);

const topics = [
    { titleKey: 'game.topicsHints.topic1Title', questionKey: 'game.topicsHints.topic1Question' },
    {
        titleKey: 'game.topicsHints.topic2Title',
        hintKeys: ['game.topicsHints.topic2HintA', 'game.topicsHints.topic2HintB', 'game.topicsHints.topic2HintC'],
    },
    {
        titleKey: 'game.topicsHints.topic3Title',
        hintKeys: ['game.topicsHints.topic3HintA', 'game.topicsHints.topic3HintB', 'game.topicsHints.topic3HintC'],
    },
    {
        titleKey: 'game.topicsHints.topic4Title',
        hintKeys: ['game.topicsHints.topic4HintA', 'game.topicsHints.topic4HintB', 'game.topicsHints.topic4HintC'],
    },
    {
        titleKey: 'game.topicsHints.topic5Title',
        hintKeys: ['game.topicsHints.topic5HintA', 'game.topicsHints.topic5HintB', 'game.topicsHints.topic5HintC'],
    },
];
const hintLabels = ['а', 'б', 'в'];

const activeIndex = ref(0);
const showHints = ref(false);
const activeTopic = computed(() => topics[activeIndex.value]);

const selectTopic = (idx) => {
    activeIndex.value = idx;
    showHints.value = false;
};

const close = () => {
    showHints.value = false;
    emit('close');
};
</script>

<template>
    <Modal :show="show" max-width="sm" @close="close">
        <div class="p-6">
            <h2 class="text-center text-lg font-semibold">{{ $t('game.topicsHints.modalTitle') }}</h2>

            <div class="mt-4 flex flex-wrap justify-center gap-2">
                <button
                    v-for="(_, idx) in topics"
                    :key="idx"
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                    :class="activeIndex === idx ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'"
                    @click="selectTopic(idx)"
                >
                    {{ idx + 1 }}
                </button>
            </div>

            <div class="mt-6">
                <div class="flex items-center justify-between gap-2">
                    <p class="font-semibold">{{ $t(activeTopic.titleKey) }}</p>
                    <button
                        v-if="activeTopic.hintKeys"
                        type="button"
                        class="px-2 text-lg text-amber-600"
                        :aria-label="$t('game.topicsHints.hintsButtonLabel')"
                        @click="showHints = true"
                    >
                        ▶
                    </button>
                </div>
                <p v-if="activeTopic.questionKey" class="mt-2">{{ $t(activeTopic.questionKey) }}</p>
            </div>

            <button
                type="button"
                class="mt-6 w-full rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                @click="close"
            >
                {{ $t('common.done') }}
            </button>
        </div>
    </Modal>

    <Modal :show="show && showHints && !!activeTopic.hintKeys" max-width="sm" @close="showHints = false">
        <div class="p-6">
            <h3 class="text-center text-lg font-semibold">{{ $t('game.topicsHints.hintsModalTitle') }}</h3>
            <div class="mt-4 space-y-2">
                <p v-for="(key, idx) in activeTopic.hintKeys ?? []" :key="key">
                    {{ hintLabels[idx] }}) {{ $t(key) }}
                </p>
            </div>
            <button
                type="button"
                class="mt-6 w-full rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                @click="showHints = false"
            >
                {{ $t('common.done') }}
            </button>
        </div>
    </Modal>
</template>
