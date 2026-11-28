<script setup>
import Modal from '@/Components/Modal.vue';
import TopicHintsModal from '@/Components/TopicHintsModal.vue';
import { topics } from '@/data/topicsData';
import { computed, ref } from 'vue';

const props = defineProps({
    show: { type: Boolean, default: false },
    activeIndex: { type: Number, default: null },
});
const emit = defineEmits(['select', 'clear', 'close']);

const showHints = ref(false);
const activeTopic = computed(() => (props.activeIndex != null ? topics[props.activeIndex] : null));

const selectTopic = (idx) => {
    showHints.value = false;
    emit('select', idx);
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

            <div v-if="activeTopic" class="mt-6">
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
                <p class="mt-3 text-xs text-gray-500">{{ $t('game.topicsHints.visibleToEveryone') }}</p>
                <button type="button" class="mt-2 text-xs text-red-600" @click="$emit('clear')">
                    {{ $t('game.topicsHints.hideButton') }}
                </button>
            </div>
            <p v-else class="mt-6 text-center text-sm text-gray-500">
                {{ $t('game.topicsHints.pickPrompt') }}
            </p>

            <button
                type="button"
                class="mt-6 w-full rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                @click="close"
            >
                {{ $t('common.done') }}
            </button>
        </div>
    </Modal>

    <TopicHintsModal
        :show="showHints && !!activeTopic?.hintKeys"
        :hint-keys="activeTopic?.hintKeys ?? []"
        @close="showHints = false"
    />
</template>
