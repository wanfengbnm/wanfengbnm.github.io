import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "生活记录",
  description: "生活记录",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: '任务日志', link: '/new1' },
      { text: '更新日志', link: '/CHANGELOG/' }
    ],
    sidebar: [
      {
        items: [
          { text: '任务日志', link: '/new1' },
          { text: '问题更改', link: '/new2' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wanfengbnm' }
    ]
  }
})
