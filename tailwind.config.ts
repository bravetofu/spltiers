import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // All colours come from CSS variables — defined in globals.css
        'bg-primary':   'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary':  'var(--bg-tertiary)',
        'border-default': 'var(--border-default)',
        'border-subtle':  'var(--border-subtle)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
        'text-faint':     'var(--text-faint)',
        'accent-red':     'var(--accent-red)',
        'accent-gold':    'var(--accent-gold)',
        'accent-green':   'var(--accent-green)',
        'accent-blue':    'var(--accent-blue)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'content-tier': '1100px',
        'content-pricing': '1000px',
      },
      height: {
        nav: '52px',
      },
      borderRadius: {
        card: '10px',
        badge: '6px',
        btn: '8px',
        'btn-sm': '6px',
      },
    },
  },
  plugins: [typography],
}

export default config
