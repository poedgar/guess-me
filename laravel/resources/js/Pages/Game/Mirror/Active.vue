<script setup>
import { computed } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);
const myComment = computed(() => round.value?.comments.find((c) => c.authorId === currentUserId.value));
const isAdminNotWriting = computed(() => props.game.isAdmin && !props.game.settings.adminWritesComments);

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>
            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>
            <!-- The revealed-comments view for the target is added in Task 9. -->
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="myComment">
            <p class="text-sm text-green-700">{{ $t('game.commentSentWaitingShow') }}</p>
        </template>

        <template v-else>
            <form @submit.prevent="submitComment" class="space-y-2">
                <textarea
                    v-model="commentForm.text"
                    :placeholder="$t('game.commentPlaceholder')"
                    maxlength="500"
                    rows="4"
                    class="w-full rounded border-gray-300"
                />
                <p class="text-xs text-gray-400">{{ commentForm.text.length }}/500</p>
                <p v-if="commentForm.errors.text" class="text-sm text-red-600">{{ commentForm.errors.text }}</p>
                <button
                    type="submit"
                    class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="commentForm.processing || !commentForm.text.trim()"
                >
                    {{ $t('game.submitComment') }}
                </button>
            </form>
        </template>

        <button
            v-if="canShowComments"
            type="button"
            class="mt-6 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="showComments"
        >
            {{ $t('game.showComments') }}
        </button>
    </div>
</template>
