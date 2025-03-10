// import './assets/main.css'

// Import Bootstrap and BootstrapVue CSS files (order is important)
// import 'bootstrap/dist/css/bootstrap.css'
// import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

import { createApp } from 'vue'
import {createBootstrap} from 'bootstrap-vue-next'

import App from './components/App.vue'

import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

const app = createApp(App)
app.use(createBootstrap());

// Vue.use(BootstrapVue);

app.mount('#app')
