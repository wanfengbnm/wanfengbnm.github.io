import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "生活记录",
  description: "生活记录",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '任务日志', link: '/new1' },
      { text: '更新日志', link: '/changelog' }
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
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
