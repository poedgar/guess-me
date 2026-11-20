<script setup>
import { computed, watch } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);
const myComment = computed(() => round.value?.comments.find((c) => c.authorId === currentUserId.value));
const isAdminNotWriting = computed(() => props.game.isAdmin && !props.game.settings.adminWritesComments);
const activeComment = computed(() => round.value?.comments.find((c) => c.id === round.value.activeCommentId));
const allReactionsRated = computed(() => round.value?.comments.every((c) => c.reactionsComplete) ?? false);

const commentForm = useForm({ text: '' });
const submitComment = () => commentForm.post(route('games.comments.store', props.game.id), {
    onSuccess: () => commentForm.reset(),
});

// Pre-fills the form with the original text the moment the admin sends
// this author's comment back for editing, so they revise rather than
// retype from scratch.
watch(() => myComment.value?.needsRevision, (needsRevision) => {
    if (needsRevision) commentForm.text = myComment.value.text;
});

const sendBackForm = useForm({});
const sendBack = (commentId) => sendBackForm.post(route('games.comments.send-back', [props.game.id, commentId]));

const showCommentsForm = useForm({});
const showComments = () => showCommentsForm.post(route('games.show-comments', props.game.id));

const canShowComments = computed(
    () => props.game.isAdmin && round.value?.comments.length > 0 && !round.value?.commentsVisible,
);

const awardPointsForm = useForm({ points: 0 });
const awardPoints = (commentId, points) => {
    awardPointsForm.points = points;
    awardPointsForm.post(route('games.comment-points', [props.game.id, commentId]));
};

const rateReactionForm = useForm({ rating: 0 });
const rateReaction = (commentId, rating) => {
    rateReactionForm.rating = rating;
    rateReactionForm.post(route('games.comments.rate-reaction', [props.game.id, commentId]));
};

const activateCommentForm = useForm({});
const activateComment = (commentId) => activateCommentForm.post(route('games.comments.activate', [props.game.id, commentId]));

const startGuessingForm = useForm({});
const startGuessing = () => startGuessingForm.post(route('games.start-guessing', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.activePhase') }}</h1>

        <div v-if="game.isAdmin && !round.commentsVisible && round.comments.length > 0" class="space-y-2">
            <h2 class="font-semibold">{{ $t('game.reviewComments') }}</h2>
            <div v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                <p class="text-sm">{{ comment.text }}</p>
                <p v-if="comment.needsRevision" class="mt-1 text-xs text-amber-600">
                    {{ $t('game.sentBackForRevision') }}
                </p>
                <button v-else type="button" class="mt-1 text-xs text-red-600" @click="sendBack(comment.id)">
                    {{ $t('game.sendBackForEdit') }}
                </button>
            </div>
            <p v-if="sendBackForm.errors.comment" class="text-sm text-red-600">{{ sendBackForm.errors.comment }}</p>
        </div>

        <template v-if="isTarget">
            <p class="text-sm text-gray-700">{{ $t('game.youAreTarget') }}</p>

            <p v-if="!round.commentsVisible" class="text-sm text-gray-500">
                {{ $t('game.waitingForCommentsAboutYou') }}
            </p>

            <template v-else-if="!round.pointsGiven">
                <h2 class="font-semibold">{{ $t('game.awardPointsToComments') }}</h2>
                <div v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                    <p class="text-sm">{{ comment.text }}</p>
                    <div v-if="comment.points !== null" class="mt-2 text-sm text-gray-500">
                        {{ $t('game.points') }} {{ comment.points }}
                    </div>
                    <div v-else-if="allReactionsRated" class="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            class="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                            @click="awardPoints(comment.id, 1)"
                        >
                            {{ $t('game.giveOnePoint') }}
                        </button>
                        <button
                            type="button"
                            class="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800"
                            @click="awardPoints(comment.id, 0)"
                        >
                            {{ $t('game.noPoint') }}
                        </button>
                    </div>
                    <p v-else-if="comment.id === activeComment?.id" class="mt-2 text-sm text-gray-500">
                        {{ $t('game.waitingForReactionRatings') }}
                    </p>
                    <p v-else-if="comment.reactionsComplete" class="mt-2 text-sm text-gray-500">
                        {{ $t('game.reactionsCompleteWaitingTurn') }}
                    </p>
                    <button
                        v-else
                        type="button"
                        class="mt-2 rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                        @click="activateComment(comment.id)"
                    >
                        {{ $t('game.activateComment') }}
                    </button>
                    <p v-if="awardPointsForm.errors.points" class="text-sm text-red-600">{{ awardPointsForm.errors.points }}</p>
                    <p v-if="activateCommentForm.errors.comment" class="text-sm text-red-600">{{ activateCommentForm.errors.comment }}</p>
                </div>
            </template>

            <p v-else class="text-sm text-gray-500">
                {{ $t('game.finishedAwardingPointsWaitAdmin') }}
            </p>
        </template>

        <template v-else-if="isAdminNotWriting">
            <p class="text-sm text-gray-500">{{ $t('game.adminNotParticipating') }}</p>
        </template>

        <template v-else-if="(!myComment || myComment.needsRevision) && !round.pointsGiven">
            <form @submit.prevent="submitComment" class="space-y-2">
                <p v-if="myComment?.needsRevision" class="text-sm text-amber-600">
                    {{ $t('game.commentSentBackBanner') }}
                </p>
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

        <template v-else-if="round.commentsVisible && !round.pointsGiven">
            <h2 class="font-semibold">{{ $t('game.rateTargetReactionPrompt') }}</h2>
            <div v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                <p class="text-sm">{{ comment.text }}</p>
                <p v-if="comment.points !== null" class="mt-2 text-sm text-gray-500">
                    {{ $t('game.points') }} {{ comment.points }}
                </p>
                <template v-else-if="comment.id === activeComment?.id">
                    <div v-if="comment.myReactionRating === null" class="mt-2 flex items-center gap-2">
                        <button type="button" class="rounded bg-indigo-600 px-3 py-1 text-sm text-white" @click="rateReaction(comment.id, 1)">
                            {{ $t('game.giveOnePoint') }}
                        </button>
                        <button type="button" class="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800" @click="rateReaction(comment.id, 0)">
                            {{ $t('game.noPoint') }}
                        </button>
                    </div>
                    <p v-else class="mt-2 text-sm text-gray-500">{{ $t('game.waitingForAllPlayers') }}</p>
                </template>
                <p v-else-if="comment.reactionsComplete" class="mt-2 text-sm text-gray-500">
                    {{ $t('game.reactionsCompleteWaitingTurn') }}
                </p>
                <p v-else class="mt-2 text-sm text-gray-500">{{ $t('game.notYetActivated') }}</p>
                <p v-if="rateReactionForm.errors.rating" class="text-sm text-red-600">{{ rateReactionForm.errors.rating }}</p>
            </div>
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
