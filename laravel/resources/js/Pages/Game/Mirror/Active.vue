<script setup>
import { computed, reactive } from 'vue';
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

// One local point value per comment, keyed by comment id — the award form for each
// comment is independent (a comment can be awarded once its own points input is set).
const pointsByComment = reactive({});
const awardForms = {};
const awardPoints = (commentId) => {
    if (!awardForms[commentId]) {
        awardForms[commentId] = useForm({ points: 0 });
    }
    awardForms[commentId].points = pointsByComment[commentId] ?? 0;
    awardForms[commentId].post(route('games.comment-points', [props.game.id, commentId]));
};

const finishAwardingForm = useForm({});
const finishAwarding = () => finishAwardingForm.post(route('games.finish-awarding-points', props.game.id));

const allCommentsAwarded = computed(
    () => round.value?.comments.length > 0 && round.value.comments.every((c) => c.points !== null),
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

            <template v-else-if="!round.pointsGiven">
                <h2 class="font-semibold">{{ $t('game.awardPointsToComments') }}</h2>
                <ul class="space-y-3">
                    <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                        <p class="text-sm">{{ comment.text }}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                v-model.number="pointsByComment[comment.id]"
                                class="w-20 rounded border-gray-300 text-sm"
                                :disabled="comment.points !== null"
                            />
                            <button
                                type="button"
                                class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                                :disabled="comment.points !== null"
                                @click="awardPoints(comment.id)"
                            >
                                {{ comment.points !== null ? comment.points : $t('game.givePoints') }}
                            </button>
                        </div>
                    </li>
                </ul>
                <button
                    type="button"
                    class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-25"
                    :disabled="!allCommentsAwarded"
                    @click="finishAwarding"
                >
                    {{ $t('game.finishAwarding') }}
                </button>
            </template>

            <p v-else class="text-sm text-gray-500">
                {{ $t('game.finishedAwardingPointsWaitAdmin') }}
            </p>
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
