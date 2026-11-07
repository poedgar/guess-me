<script setup>
import { useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });

const nextRoundForm = useForm({});
const nextRound = () => nextRoundForm.post(route('games.next-round', props.game.id));

const medal = (index) => ['🥇', '🥈', '🥉'][index] ?? '';
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <h1 class="text-xl font-bold">{{ $t('game.leaderboard') }}</h1>

        <p v-if="game.adminLeft" class="rounded bg-red-50 p-3 text-sm text-red-700">
            {{ $t('game.adminLeftTitle') }} — {{ $t('game.adminLeftMessage') }}
        </p>

        <ol class="space-y-2">
            <li
                v-for="(entry, i) in game.leaderboard"
                :key="entry.userId"
                class="flex items-center justify-between rounded border p-3"
            >
                <span>{{ medal(i) }} {{ entry.name }}</span>
                <span class="text-sm text-gray-500">
                    {{ entry.totalPoints }} {{ $t('game.points') }}
                    ({{ entry.gamePoints }} + {{ entry.guessPoints }} {{ $t('game.correctGuesses') }})
                </span>
            </li>
        </ol>

        <p v-if="game.status === 'finished'" class="text-center font-semibold">{{ $t('game.gameOver') }}</p>

        <button
            v-if="game.isAdmin && game.status !== 'finished' && !game.adminLeft"
            type="button"
            class="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            @click="nextRound"
        >
            {{ $t('game.nextRound') }}
        </button>
    </div>
</template>
