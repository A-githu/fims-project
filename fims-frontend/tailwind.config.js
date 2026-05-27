/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                eneo: {
                    lime: '#84cc16',
                    limeLight: '#bef264',
                    limeDark: '#4d7c0f',
                    sky: '#38bdf8',
                    skyLight: '#7dd3fc',
                    skyDark: '#0284c7',
                },
                primary: {
                    300: '#bef264',
                    400: '#a3e635',
                    500: '#84cc16',
                    600: '#65a30d',
                    700: '#4d7c0f',
                },
                accent: {
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                },
                surface: {
                    950: '#020b12',
                    900: '#051525',
                    800: '#07203a',
                    700: '#0a2d4f',
                    600: '#0d3a64',
                    500: '#114778',
                    400: '#1a5a8f',
                    300: '#2470a8',
                    200: '#3a88c0',
                    100: '#b0cfe8',
                },
            },
            fontFamily: {
                display: ['Barlow Condensed', 'sans-serif'],
                body: ['IBM Plex Sans', 'sans-serif'],
                mono: ['IBM Plex Mono', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'glow': 'glow 3s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
                slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
                glow: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
            },
            boxShadow: {
                lime: '0 0 20px rgba(132, 204, 22, 0.25)',
                sky: '0 0 20px rgba(56, 189, 248, 0.25)',
                card: '0 4px 24px rgba(0,0,0,0.4)',
            },
        },
    },
    plugins: [],
}