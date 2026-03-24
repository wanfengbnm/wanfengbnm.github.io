import DefaultTheme from 'vitepress/theme'
import AuthWrapper from '../components/AuthWrapper.vue'
import './color.css'
import './style.css'


export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('AuthWrapper', AuthWrapper)
  }
}