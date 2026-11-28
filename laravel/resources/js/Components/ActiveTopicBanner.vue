<script setup>
import TopicHintsModal from '@/Components/TopicHintsModal.vue';
import { topics } from '@/data/topicsData';
import { computed, ref } from 'vue';

const props = defineProps({
    activeTopicIndex: { type: Number, default: null },
});

const showHints = ref(false);
const topic = computed(() => (props.activeTopicIndex != null ? topics[props.activeTopicIndex] : null));
</script>

<template>
    <div v-if="topic" class="rounded-lg border border-amber-600 bg-amber-50 p-4">
        <div class="flex items-center justify-between gap-2">
            <p class="font-semibold">{{ $t(topic.titleKey) }}</p>
            <button
                v-if="topic.hintKeys"
                type="button"
                class="px-2 text-lg text-amber-600"
                :aria-label="$t('game.topicsHints.hintsButtonLabel')"
                @click="showHints = true"
            >
                ▶
            </button>
        </div>
        <p v-if="topic.questionKey" class="mt-2">{{ $t(topic.questionKey) }}</p>

        <TopicHintsModal
            :show="showHints && !!topic.hintKeys"
            :hint-keys="topic.hintKeys ?? []"
            @close="showHints = false"
        />
    </div>
</template>
