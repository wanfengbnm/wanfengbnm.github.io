import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: "wanfengbnm生活日志",
  description: "wanfengbnm生活日志",
  sitemap: {
    hostname: 'https://wanfengbnm.cn/'
  },
  themeConfig: {
    nav: [
      { text: '主页', link: '/' },
      { text: '任务日志', link: '/TaskLog/' },
      { text: '日常问题', link: '/DailyProblem/' },
      { text: '文档研究', link: '/DocumentResearch/' },
      { text: '更新日志', link: '/CHANGELOG/' }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wanfengbnm' }
    ]
  }
})
