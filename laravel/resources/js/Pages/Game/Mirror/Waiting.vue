<script setup>
import { useForm } from '@inertiajs/vue3';

const props = defineProps({ game: Object });

const settingsForm = useForm({});

const toggle = (routeName, field) => {
    settingsForm.transform(() => ({ value: !props.game.settings[field] })).post(route(routeName, props.game.id));
};

const startForm = useForm({});
const start = () => startForm.post(route('games.start', props.game.id));

const leaveForm = useForm({});
const leave = () => leaveForm.post(route('games.leave', props.game.id));
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">{{ $t('game.waiting') }} — {{ game.code }}</h1>
            <button type="button" class="text-sm text-red-600" @click="leave">
                {{ $t('game.leaveGame') }}
            </button>
        </div>

        <p v-if="game.isAdmin" class="text-sm text-gray-500">{{ $t('game.youAreAdmin') }}</p>

        <div>
            <h2 class="font-semibold">{{ $t('game.participants') }} ({{ game.participants.length }})</h2>
            <ul class="mt-2 space-y-1">
                <li v-for="p in game.participants" :key="p.userId" class="text-sm">{{ p.name }}</li>
            </ul>
        </div>

        <template v-if="game.isAdmin">
            <div class="rounded-lg border p-4">
                <h2 class="font-semibold">{{ $t('game.adminSettings') }}</h2>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.adminWritesComments"
                        @change="toggle('games.settings.admin-writes-comments', 'adminWritesComments')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.adminWritesCommentsTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.adminWritesCommentsDescription') }}</span>
                    </span>
                </label>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.showSurnames"
                        @change="toggle('games.settings.show-surnames', 'showSurnames')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.showSurnamesTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.showSurnamesDescription') }}</span>
                    </span>
                </label>

                <label class="mt-3 flex items-start gap-2">
                    <input
                        type="checkbox"
                        :checked="game.settings.showGuessResults"
                        @change="toggle('games.settings.show-guess-results', 'showGuessResults')"
                    />
                    <span class="text-sm">
                        <span class="font-medium">{{ $t('game.showGuessResultsTitle') }}</span>
                        <span class="block text-gray-500">{{ $t('game.showGuessResultsDescription') }}</span>
                    </span>
                </label>

                <div class="mt-3">
                    <span class="text-sm font-medium">{{ $t('game.targetSelectionModeTitle') }}</span>
                    <span class="block text-xs text-gray-500">{{ $t('game.targetSelectionModeDescription') }}</span>
                    <select
                        class="mt-1 rounded border-gray-300 text-sm"
                        :value="game.settings.targetSelectionMode"
                        @change="settingsForm.transform(() => ({ value: $event.target.value })).post(route('games.settings.target-selection-mode', game.id))"
                    >
                        <option value="random">{{ $t('game.targetSelectionRandom') }}</option>
                        <option value="chronological">{{ $t('game.targetSelectionChronological') }}</option>
                    </select>
                </div>
            </div>

            <button
                type="button"
                class="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-25"
                :disabled="game.participants.length < 2"
                @click="start"
            >
                {{ $t('game.startGame') }}
            </button>
        </template>
        <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForAdminStart') }}</p>
    </div>
</template>
