import '../css/app.css';
import './bootstrap';
import './echo';

import { createInertiaApp, router } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createApp, h } from 'vue';
import { ZiggyVue } from '../../vendor/tightenco/ziggy';
import { createAppI18n } from './i18n';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        const i18n = createAppI18n(props.initialPage.props.locale);

        // Inertia visits (including the LocaleSwitcher's router.post) swap page
        // props client-side without a full reload, so vue-i18n's own active
        // locale never moves on its own. Keep it in sync with whatever locale
        // the backend resolved for the current page on every navigation, not
        // just the locale switch itself, since any Inertia visit could in
        // principle land on a page with a different resolved locale.
        router.on('success', (event) => {
            const locale = event.detail.page.props.locale;
            if (locale) {
                i18n.global.locale.value = locale;
            }
        });

        return createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .use(i18n)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});
