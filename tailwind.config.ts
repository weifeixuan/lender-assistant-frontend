import type { Config } from 'tailwindcss';

// 颜色只引用 index.css 里的 CSS 变量，避免两处维护同一份色值。
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--kb-bg)',
        panel: 'var(--kb-panel)',
        panel2: 'var(--kb-panel-2)',
        ink: 'var(--kb-ink)',
        ink2: 'var(--kb-ink-2)',
        muted: 'var(--kb-muted)',
        line: 'var(--kb-line)',
        line2: 'var(--kb-line-2)',
        brand: 'var(--kb-brand)',
        brand2: 'var(--kb-brand-2)',
        brandSoft: 'var(--kb-brand-soft)',
        brandLine: 'var(--kb-brand-line)',
        ok: 'var(--kb-ok)',
        okSoft: 'var(--kb-ok-soft)',
        okLine: 'var(--kb-ok-line)',
        warn: 'var(--kb-warn)',
        warnSoft: 'var(--kb-warn-soft)',
        warnLine: 'var(--kb-warn-line)',
        ink3: 'var(--kb-ink-3)',
        line3: 'var(--kb-line-3)',
        panel3: 'var(--kb-panel-3)',
        placeholder: 'var(--kb-placeholder)',
        brandSoft2: 'var(--kb-brand-soft-2)',
        brandGradA: 'var(--kb-brand-grad-a)',
        brandGradB: 'var(--kb-brand-grad-b)',
        danger: 'var(--kb-danger)',
        dangerSoft: 'var(--kb-danger-soft)',
        dangerSoft2: 'var(--kb-danger-soft-2)',
        dangerLine: 'var(--kb-danger-line)',
        fileDocxBg: 'var(--kb-file-docx-bg)',
        fileDocxFg: 'var(--kb-file-docx-fg)',
        fileMd: 'var(--kb-file-md-bg)',
        fileMdFg: 'var(--kb-file-md-fg)',
        fileTxtBg: 'var(--kb-file-txt-bg)',
        fileTxtFg: 'var(--kb-file-txt-fg)',
      },
      fontFamily: {
        sans: 'var(--kb-font)',
        mono: 'var(--kb-mono)',
      },
      fontSize: {
        title: ['19px', '1.4'],
        body: ['12.5px', '1.6'],
        meta: ['11px', '1.5'],
        small: ['11.5px', '1.5'],
      },
      borderRadius: {
        card: '10px',
        input: '8px',
        dialog: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,21,28,.04), 0 2px 10px rgba(17,21,28,.04)',
        float: '0 10px 40px rgba(17,21,28,.12)',
        drawer: '-8px 0 30px rgba(17,21,28,.07)',
      },
      screens: {
        // PRD 基线：1280×800 起
        kb: '1280px',
      },
    },
  },
  plugins: [],
} satisfies Config;
