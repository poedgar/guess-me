<script setup>
import { useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({ game: Object });

const page = usePage();
const currentUserId = page.props.auth.user.id;

// The admin only counts as a real participant (shown in the roster, counted
// toward the minimum needed to start) once they've opted in to writing
// comments — otherwise they're just running the game, not playing it.
const visibleParticipants = computed(() => props.game.participants.filter(
    (p) => props.game.settings.adminWritesComments || p.userId !== props.game.adminId,
));

const settingsForm = useForm({});

const toggle = (routeName, field) => {
    settingsForm.transform(() => ({ value: !props.game.settings[field] })).post(route(routeName, props.game.id));
};

const startForm = useForm({});
const start = () => startForm.post(route('games.start', props.game.id));

const leaveForm = useForm({});
const leave = () => leaveForm.post(route('games.leave', props.game.id));

const isEditingName = ref(false);
const nameForm = useForm({ name: '' });

const startEditingName = (currentName) => {
    nameForm.clearErrors();
    nameForm.name = currentName;
    isEditingName.value = true;
};

const cancelEditingName = () => {
    isEditingName.value = false;
};

const saveName = () => {
    nameForm.post(route('games.update-name', props.game.id), {
        preserveScroll: true,
        onSuccess: () => { isEditingName.value = false; },
    });
};
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6 p-6">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">{{ $t('game.waiting') }} — {{ game.code }}</h1>
            <button type="button" class="text-sm text-red-600 border border-red-300 px-3 py-1.5 rounded-full hover:bg-red-50" @click="leave">
                {{ $t('game.leaveGame') }}
            </button>
        </div>

        <p v-if="game.isAdmin" class="text-sm text-gray-500">{{ $t('game.youAreAdmin') }}</p>

        <div>
            <h2 class="font-semibold">{{ $t('game.participants') }} ({{ visibleParticipants.length }})</h2>
            <ul class="mt-2 space-y-1">
                <li v-for="p in visibleParticipants" :key="p.userId" class="flex items-center gap-2 text-sm">
                    <template v-if="p.userId === currentUserId && isEditingName">
                        <input
                            v-model="nameForm.name"
                            type="text"
                            maxlength="255"
                            class="rounded border-gray-300 text-sm"
                            @keyup.enter="saveName"
                        />
                        <button type="button" class="text-xs font-medium text-indigo-600" :disabled="nameForm.processing" @click="saveName">
                            {{ $t('common.save') }}
                        </button>
                        <button type="button" class="text-xs text-gray-500" @click="cancelEditingName">
                            {{ $t('common.cancel') }}
                        </button>
                        <p v-if="nameForm.errors.name" class="text-xs text-red-600">{{ nameForm.errors.name }}</p>
                    </template>
                    <template v-else>
                        <span>{{ p.name }}</span>
                        <button
                            v-if="p.userId === currentUserId"
                            type="button"
                            class="text-xs text-gray-400 hover:text-indigo-600"
                            :title="$t('game.editName')"
                            @click="startEditingName(p.name)"
                        >
                            ✏️
                        </button>
                    </template>
                </li>
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
                <p v-if="settingsForm.errors.value" class="text-sm text-red-600">{{ settingsForm.errors.value }}</p>

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
                <p v-if="settingsForm.errors.value" class="text-sm text-red-600">{{ settingsForm.errors.value }}</p>

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
                <p v-if="settingsForm.errors.value" class="text-sm text-red-600">{{ settingsForm.errors.value }}</p>

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
                    <p v-if="settingsForm.errors.value" class="text-sm text-red-600">{{ settingsForm.errors.value }}</p>
                </div>
            </div>

            <button
                type="button"
                class="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-25"
                :disabled="visibleParticipants.length < 2"
                @click="start"
            >
                {{ $t('game.startGame') }}
            </button>
            <p v-if="startForm.errors.participants" class="text-sm text-red-600">{{ startForm.errors.participants }}</p>
        </template>
        <p v-else class="text-sm text-gray-500">{{ $t('game.waitingForAdminStart') }}</p>
    </div>
</template>
