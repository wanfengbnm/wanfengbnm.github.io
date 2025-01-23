import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: "Wanfengbnm生活日志",
  description: "Wanfengbnm生活日志",
  markdown: {
    lineNumbers: true,
    container: {
      tipLabel: '提示',
      warningLabel: '警告',
      dangerLabel: '危险',
      infoLabel: '信息',
      detailsLabel: '详细信息'
    }
  },
  sitemap: {
    hostname: 'https://wanfengbnm.cn/'
  },
  themeConfig: {
    i18nRouting: false,
    darkModeSwitchLabel: '切换深色或浅色模式',
    lightModeSwitchTitle: '切换至浅色模式',
    darkModeSwitchTitle: '切换至深色模式',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    externalLinkIcon: false,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wanfengbnm' }
    ],
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                displayDetails: '显示文章的详细内容',
                resetButtonTitle: '清除内容',
                backButtonTitle: '返回',
                noResultsText: '没有找到',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '选择',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '向上',
                  navigateDownKeyAriaLabel: '向下',
                  closeText: '关闭',
                  closeKeyAriaLabel: '关闭',
                }
              }
            }
          }
        }
      }
    },
    notFound: {
      title: '页面未找到',
      quote: '抱歉，没有找到您需要的页面',
      linkLabel: '回到主页',
      linkText: '回到主页',
      code: '404',
    },
    nav: [
      { text: '主页', link: '/' },
      {
        text: '任务日志',
        activeMatch: '/TaskLog/',
        link: '/TaskLog/'
      },
      {
        text: '日常问题',
        activeMatch: '/DailyProblem/',
        link: '/DailyProblem/'
      },
      {
        text: '文档研究',
        activeMatch: '/DocumentResearch/',
        link: '/DocumentResearch/'
      },
      {
        text: '更新日志',
        activeMatch: '/CHANGELOG/',
        link: '/CHANGELOG/'
      }
    ],
    sidebar: {
      '/DailyProblem/': [
        {
          text: '日常问题',
          items: [
            { text: '前言', link: '/DailyProblem/' },
            { text: '数学知识', link: '/DailyProblem/Math' },
            { text: '英语知识', link: '/DailyProblem/English' }]
        }
      ],
    },
    footer: {
      message: '本网站以 <a href="/Apache-License-2.0.txt" target="_blank">Apache License 2.0</a> 的条款发布。',
      copyright: 'Copyright © 2024-2025 <a href="https://github.com/wanfengbnm" target="_blank">wanfengbnm</a>. 保留所有权利。'
    },
  }
})
