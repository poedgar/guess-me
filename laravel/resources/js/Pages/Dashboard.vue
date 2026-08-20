<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { Head, useForm } from '@inertiajs/vue3';

const createForm = useForm({ password: '', admin_writes_comments: false });
const joinForm = useForm({ code: '' });

const submitCreate = () => createForm.post(route('games.store'));
const submitJoin = () => joinForm.post(route('games.join'));
</script>

<template>
    <Head title="Dashboard" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="text-xl font-semibold leading-tight text-gray-800">
                {{ $t('game.waiting') }}
            </h2>
        </template>

        <div class="py-12">
            <div class="mx-auto max-w-2xl space-y-6 sm:px-6 lg:px-8">
                <p class="text-sm text-gray-600">{{ $t('game.createOrJoinDescription') }}</p>

                <div class="overflow-hidden bg-white p-6 shadow-sm sm:rounded-lg">
                    <form @submit.prevent="submitJoin" class="flex gap-2">
                        <div class="flex-1">
                            <InputLabel for="code" :value="$t('game.gameIdPlaceholder')" />
                            <TextInput
                                id="code"
                                type="text"
                                class="mt-1 block w-full"
                                v-model="joinForm.code"
                                :placeholder="$t('game.gameIdPlaceholder')"
                            />
                            <InputError class="mt-2" :message="joinForm.errors.code" />
                        </div>
                        <PrimaryButton
                            class="mt-6 self-start"
                            :class="{ 'opacity-25': joinForm.processing }"
                            :disabled="joinForm.processing"
                        >
                            {{ $t('game.join') }}
                        </PrimaryButton>
                    </form>
                </div>

                <div class="overflow-hidden bg-white p-6 shadow-sm sm:rounded-lg">
                    <form @submit.prevent="submitCreate">
                        <InputLabel for="password" :value="$t('auth.password')" />
                        <TextInput
                            id="password"
                            type="password"
                            class="mt-1 block w-full"
                            v-model="createForm.password"
                        />
                        <InputError class="mt-2" :message="createForm.errors.password" />

                        <label class="mt-4 flex items-center">
                            <input type="checkbox" v-model="createForm.admin_writes_comments" />
                            <span class="ms-2 text-sm text-gray-600">
                                {{ $t('game.adminWritesCommentsTitle') }}
                            </span>
                        </label>

                        <PrimaryButton
                            class="mt-4"
                            :class="{ 'opacity-25': createForm.processing }"
                            :disabled="createForm.processing"
                        >
                            {{ $t('game.startGame') }}
                        </PrimaryButton>
                    </form>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
