import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "生活记录",
  description: "生活记录",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: '任务日志', link: '/TaskLog/' },
      { text: '日常问题', link: '/DailyProblem/' },
      { text: '更新日志', link: '/CHANGELOG/' }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wanfengbnm' }
    ]
  }
})
