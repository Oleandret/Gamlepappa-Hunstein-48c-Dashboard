/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nx: {
          bg: '#05070d',
          panel: '#0b1322',
          panel2: '#0f1a2e',
          line: '#1c2a44',
          cyan: '#22e6ff',
          cyan2: '#5cf2ff',
          teal: '#19d4b5',
          purple: '#7d5cff',
          pink: '#ff5cd1',
          amber: '#ffb84a',
          green: '#3ddc84',
          red: '#ff5c7a',
          mute: '#7c8aa8',
          text: '#e6f0ff'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular']
      },
      boxShadow: {
        'glow-cyan': '0 0 22px rgba(34,230,255,0.35), inset 0 0 1px rgba(34,230,255,0.5)',
        'glow-soft': '0 0 32px rgba(34,230,255,0.18)',
        'panel': '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(34,230,255,0.06)'
      },
      backgroundImage: {
        'grid': 'linear-gradient(rgba(34,230,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,230,255,0.05) 1px, transparent 1px)',
        'panel-grad': 'linear-gradient(180deg, rgba(28,42,68,0.55) 0%, rgba(11,19,34,0.55) 100%)',
        'cyan-glow': 'radial-gradient(circle at 50% 0%, rgba(34,230,255,0.18), transparent 60%)'
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(34,230,255,0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(34,230,255,0)' }
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' }
        },
        equalizer: {
          '0%,100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' }
        },
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        pulseGlow: 'pulseGlow 2.4s ease-out infinite',
        scan: 'scan 6s linear infinite',
        float: 'float 4s ease-in-out infinite',
        equalizer: 'equalizer 0.9s ease-in-out infinite',
        sweep: 'sweep 3s linear infinite'
      }
    }
  },
  plugins: []
};
