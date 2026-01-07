/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary accent (10% of UI) — Complete teal scale
        primary: {
          50: '#F0FDFA',   // Lightest tint (backgrounds, hover states)
          100: '#CCFBF1',  // Highlights, selected states
          200: '#99F6E4',  // Light accent backgrounds
          300: '#5EEAD4',  // Soft highlights, badges
          400: '#2DD4BF',  // Mid-tone accent
          500: '#0D9488',  // Primary actions, links (anchor)
          600: '#0F766E',  // Hover states
          700: '#115E59',  // Active/pressed states
          800: '#134E4A',  // Dark accent text on light backgrounds
          900: '#042F2E',  // Darkest tint (rare, high contrast)
        },
        // Warm neutrals (90% of UI)
        stone: {
          50: '#FAFAF9',   // Background (warm off-white)
          100: '#F5F5F4',  // Surface (cards, panels)
          200: '#E7E5E4',  // Borders
          400: '#A8A29E',  // Muted text (timestamps)
          500: '#78716C',  // Secondary text
          700: '#44403C',  // Primary text
          900: '#1C1917',  // Headings, emphasis
        },
        // Semantic colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
      // Letter-spacing tokens for typographic control
      letterSpacing: {
        tight: '-0.025em',   // Headlines, display text
        wide: '0.025em',     // Buttons, labels
        wider: '0.05em',     // All-caps text, badges
      },
      // Custom easing curves for refined motion
      transitionTimingFunction: {
        'smooth-out': 'cubic-bezier(0.0, 0.0, 0.2, 1)',    // Quick start, gentle stop (entrances)
        'smooth-in': 'cubic-bezier(0.4, 0.0, 1, 1)',       // Gentle start, quick end (exits)
        'smooth-in-out': 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Balanced (state changes)
      },
      width: {
        'sidebar': '240px',
        'context-panel': '280px',
      },
      spacing: {
        // Design spec uses 4px base
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
