import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "生活记录",
  description: "生活记录",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '记录设置', link: '/new1' }
    ],

    sidebar: [
      {
        text: '个人设置',
        items: [
          { text: '信息设置', link: '/new1' },
          { text: '问题', link: '/new2' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
