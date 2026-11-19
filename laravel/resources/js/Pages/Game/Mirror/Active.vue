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
const activeComment = computed(() => round.value?.comments.find((c) => c.id === round.value.activeCommentId));

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);

const awardPointsForm = useForm({ points: 0 });
const awardPoints = (points) => {
    awardPointsForm.points = points;
    awardPointsForm.post(route('games.comment-points', [props.game.id, activeComment.value.id]));
};

const rateReactionForm = useForm({ rating: 0 });
const rateReaction = (rating) => {
    rateReactionForm.rating = rating;
    rateReactionForm.post(route('games.comments.rate-reaction', [props.game.id, activeComment.value.id]));
};

const activateNextCommentForm = useForm({});
const activateNextComment = () => activateNextCommentForm.post(route('games.activate-next-comment', props.game.id));

const startGuessingForm = useForm({});
const startGuessing = () => startGuessingForm.post(route('games.start-guessing', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>

            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>

            <template v-else-if="!round.pointsGiven && activeComment">
                <h2 class="font-semibold">{{ $t('game.awardPointsToComments') }}</h2>
                <div class="rounded border p-3">
                    <p class="text-sm">{{ activeComment.text }}</p>
                    <div v-if="activeComment.points === null" class="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            class="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                            @click="awardPoints(1)"
                        >
                            {{ $t('game.giveOnePoint') }}
                        </button>
                        <button
                            type="button"
                            class="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800"
                            @click="awardPoints(0)"
                        >
                            {{ $t('game.noPoint') }}
                        </button>
                    </div>
                    <p v-else class="mt-2 text-sm text-gray-500">
                        {{ $t('game.waitingForReactionRatings') }}
                    </p>
                    <p v-if="awardPointsForm.errors.points" class="text-sm text-red-600">{{ awardPointsForm.errors.points }}</p>
                </div>
            </template>

            <p v-else class="text-sm text-gray-500">
                {{ $t('game.finishedAwardingPointsWaitAdmin') }}
            </p>
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="!myComment && !round.pointsGiven">
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

        <template v-else-if="myComment && !round.commentsVisible">
            <p class="text-sm text-green-700">{{ $t('game.commentSentWaitingShow') }}</p>
        </template>

        <template v-else-if="round.commentsVisible && !round.pointsGiven && activeComment">
            <h2 class="font-semibold">{{ $t('game.rateTargetReactionPrompt') }}</h2>
            <p class="text-sm">{{ activeComment.text }}</p>

            <p v-if="activeComment.points === null" class="mt-2 text-sm text-gray-500">
                {{ $t('game.waitingForTargetPoints') }}
            </p>
            <div v-else-if="activeComment.myReactionRating === null" class="mt-2 flex items-center gap-2">
                <button type="button" class="rounded bg-indigo-600 px-3 py-1 text-sm text-white" @click="rateReaction(1)">
                    {{ $t('game.giveOnePoint') }}
                </button>
                <button type="button" class="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800" @click="rateReaction(0)">
                    {{ $t('game.noPoint') }}
                </button>
            </div>
            <p v-else class="mt-2 text-sm text-gray-500">{{ $t('game.waitingForAllPlayers') }}</p>
            <p v-if="rateReactionForm.errors.rating" class="text-sm text-red-600">{{ rateReactionForm.errors.rating }}</p>
        </template>

        <template v-else>
            <p class="text-sm text-gray-500">{{ $t('game.waitingForAllPlayers') }}</p>
        </template>

        <button
            v-if="canShowComments"
            type="button"
            class="mt-6 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="showComments"
        >
            {{ $t('game.showComments') }}
        </button>

        <button
            v-if="game.isAdmin && round.commentsVisible && !round.pointsGiven"
            type="button"
            class="mt-2 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="activateNextComment"
        >
            {{ $t('game.activateNextComment') }}
        </button>
        <p v-if="activateNextCommentForm.errors.game" class="text-sm text-red-600">{{ activateNextCommentForm.errors.game }}</p>

        <button
            v-if="game.isAdmin && round.commentsVisible && round.pointsGiven"
            type="button"
            class="mt-2 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="startGuessing"
        >
            {{ $t('game.guessingPhase') }}
        </button>
        <p v-if="startGuessingForm.errors.game" class="text-sm text-red-600">{{ startGuessingForm.errors.game }}</p>
    </div>
</template>
