<script setup>
import { router, usePage } from '@inertiajs/vue3';

const page = usePage();

const switchTo = (locale) => {
    router.post(route('locale.update'), { locale }, { preserveScroll: true });
};
</script>

<template>
    <div class="flex gap-1 text-sm">
        <button
            type="button"
            :class="page.props.locale === 'uk' ? 'font-bold underline' : 'text-gray-500'"
            @click="switchTo('uk')"
        >
            {{ $t('locale.uk') }}
        </button>
        <span class="text-gray-300">/</span>
        <button
            type="button"
            :class="page.props.locale === 'en' ? 'font-bold underline' : 'text-gray-500'"
            @click="switchTo('en')"
        >
            {{ $t('locale.en') }}
        </button>
    </div>
</template>
