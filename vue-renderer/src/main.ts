// import './assets/main.css'

// Import Bootstrap and BootstrapVue CSS files (order is important)
// import 'bootstrap/dist/css/bootstrap.css'
// import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import {createBootstrap} from 'bootstrap-vue-next'

import App from './components/App.vue'

import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

const app = createApp(App)

const i18n = createI18n({
    locale: "en",
    fallbackLocale: "en",
});

i18n.global.setLocaleMessage("en", {
    "btn": {
        "welcome": "the welcome button?"
    }
});

app.use(i18n);

app.use(createBootstrap());

// Vue.use(BootstrapVue);

app.mount('#app')
