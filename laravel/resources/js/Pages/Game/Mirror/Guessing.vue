<script setup>
import { computed, reactive } from 'vue';
import { usePage, useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });
const page = usePage();

const currentUserId = computed(() => page.props.auth.user.id);
const round = computed(() => props.game.currentRound);
const isTarget = computed(() => round.value?.targetUserId === currentUserId.value);

const myGuesses = computed(() =>
    Object.fromEntries(
        round.value.guesses
            .filter((g) => g.guesserId === currentUserId.value)
            .map((g) => [g.commentId, g.guessedAuthorId]),
    ),
);

const selections = reactive({});
const guessForm = useForm({ comment_id: null, guessed_author_id: null });
const submitGuess = (commentId) => {
    guessForm.comment_id = commentId;
    guessForm.guessed_author_id = selections[commentId];
    guessForm.post(route('games.guesses.store', props.game.id));
};

const allGuessed = computed(() => round.value.comments.every((c) => c.id in myGuesses.value));

const markSubmittedForm = useForm({});
const markSubmitted = () => markSubmittedForm.post(route('games.mark-guesses-submitted', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.guessingPhase') }}</h1>

        <template v-if="isTarget">
            <p class="text-sm text-gray-500">{{ $t('game.guessingPhaseSubtitle') }}</p>
            <ul class="space-y-3">
                <li v-for="comment in round.comments" :key="comment.id" class="rounded border p-3">
                    <p class="text-sm">{{ comment.text }}</p>
                    <div class="mt-2 flex items-center gap-2">
                        <select
                            v-model="selections[comment.id]"
                            class="rounded border-gray-300 text-sm"
                            :disabled="comment.id in myGuesses"
                        >
                            <option :value="null" disabled>{{ $t('game.target') }}?</option>
                            <option
                                v-for="author in round.guessingPossibleAuthors"
                                :key="author.userId"
                                :value="Number(author.userId)"
                            >
                                {{ author.userName }}
                            </option>
                        </select>
                        <button
                            type="button"
                            class="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-25"
                            :disabled="comment.id in myGuesses || !selections[comment.id]"
                            @click="submitGuess(comment.id)"
                        >
                            {{ comment.id in myGuesses ? '✓' : $t('game.submitComment') }}
                        </button>
                    </div>
                </li>
            </ul>
            <button
                v-if="allGuessed"
                type="button"
                class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                @click="markSubmitted"
            >
                {{ $t('game.finishGuesses') }}
            </button>
        </template>

        <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForTargetGuesses') }}</p>
    </div>
</template>
