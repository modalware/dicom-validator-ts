import { defineConfig } from 'vitepress'
import pkg from '../../package.json'

export default defineConfig({
  base: '/dicom-validator-ts/',
  title: 'dicom-validator-ts',
  description: 'Documentation for the DICOM validation library',

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/functions' },
      { text: 'Error Reference', link: '/errors/validation-rules' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'CLI Usage', link: '/guide/cli-usage' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Functions', link: '/api/functions' },
            { text: 'Classes', link: '/api/classes' },
            { text: 'Types & Interfaces', link: '/api/types' },
          ],
        },
      ],
      '/errors/': [
        {
          text: 'Error Reference',
          items: [
            { text: 'Validation Rules', link: '/errors/validation-rules' },
            { text: 'Error Classes', link: '/errors/error-classes' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tatsu/dicom-validator-ts' },
    ],

    footer: {
      message: `v${pkg.version}`,
    },
  },
})
