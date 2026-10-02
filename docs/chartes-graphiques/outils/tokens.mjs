import { parse, toLch, fromLch, contrast, hex } from './color.mjs';
// Ajuste la luminance d'une couleur jusqu'à atteindre le contraste demandé sur un fond.
export function ensureContrast(col, bg, min = 4.5) {
  let [L, C, H] = toLch(parse(col)); const dark = toLch(parse(bg))[0] < 0.5;
  for (let i = 0; i < 60 && contrast(fromLch([L, C, H]), parse(bg)) < min; i++) L += dark ? 0.01 : -0.01;
  return hex(fromLch([L, C, H]));
}
export function tokenBlock(ch, mode, t) {
  const txt = (k) => ensureContrast(ensureContrast(t[k], t.surface), t.bg);
  const v = {
    '--c-bg': t.bg, '--c-surface': t.surface, '--c-soft': t.soft, '--c-border': t.border, '--c-border-strong': t.borderStrong,
    '--c-text': t.text, '--c-secondary': t.secondary, '--c-muted': t.muted,
    '--c-accent': t.accent, '--c-accent-hover': t.accentHover, '--c-accent-soft': t.accentSoft, '--c-on-accent': t.onAccent, '--c-accent-text': t.accentText,
    '--c-signal': t.signal, '--c-signal-text': t.signalText, '--c-success': t.success, '--c-warning': t.warning, '--c-danger': t.danger,
    '--c-success-text': txt('success'), '--c-warning-text': txt('warning'), '--c-danger-text': txt('danger'),
    '--c-sidebar': t.sidebar, '--c-sidebar-text': t.sidebarText, '--c-sidebar-muted': t.sidebarMuted, '--c-sidebar-active': t.sidebarActive, '--c-sidebar-active-text': t.sidebarActiveText, '--c-sidebar-border': t.sidebarBorder,
    '--c-tooltip': t.tooltip, '--c-shadow': t.shadow, '--c-menu-shadow': t.menuShadow, '--c-focus': t.focus, '--c-selection': t.selection,
    '--c-font': ch.fonts.body, '--c-display': ch.fonts.display, '--c-mono': ch.fonts.mono, '--c-label': ch.fonts.label || ch.fonts.body,
    '--c-r-control': ch.radius.control + 'px', '--c-r-card': ch.radius.card + 'px', '--c-r-chip': ch.radius.chip + 'px', '--c-r-modal': ch.radius.modal + 'px', '--c-base': ch.base + 'px',
    // Câblage des tokens existants de Nexora (couche life-* puis tokens historiques).
    '--life-font': 'var(--c-font)', '--life-mono': 'var(--c-mono)', '--life-bg': 'var(--c-bg)', '--life-surface': 'var(--c-surface)', '--life-soft': 'var(--c-soft)',
    '--life-border': 'var(--c-border)', '--life-border-strong': 'var(--c-border-strong)', '--life-text': 'var(--c-text)', '--life-secondary': 'var(--c-secondary)', '--life-muted': 'var(--c-muted)',
    '--life-blue': 'var(--c-accent)', '--life-blue-hover': 'var(--c-accent-hover)', '--life-blue-soft': 'var(--c-accent-soft)',
    '--life-card-radius': 'var(--c-r-card)', '--life-control-radius': 'var(--c-r-control)', '--life-shadow': 'var(--c-shadow)', '--life-menu-shadow': 'var(--c-menu-shadow)',
    '--bg': 'var(--c-bg)', '--surface': 'var(--c-surface)', '--surface-elevated': 'var(--c-surface)', '--border': 'var(--c-border)', '--border-strong': 'var(--c-border-strong)',
    '--text-primary': 'var(--c-text)', '--text-secondary': 'var(--c-secondary)', '--text-muted': 'var(--c-muted)', '--graphite': 'var(--c-secondary)', '--line-blue': 'var(--c-accent)',
    '--quai': 'var(--c-bg)', '--quai-clair': 'var(--c-soft)', '--quai-elevated': 'var(--c-accent-soft)', '--craie': 'var(--c-text)', '--brume': 'var(--c-muted)', '--rail': 'var(--c-secondary)',
    '--accent': 'var(--c-accent)', '--signal': 'var(--c-signal)', '--success': 'var(--c-success)', '--warning': 'var(--c-warning)', '--danger': 'var(--c-danger)',
    '--accent-text': 'var(--c-signal-text)', '--success-text': 'var(--c-success-text)', '--warning-text': 'var(--c-warning-text)', '--danger-text': 'var(--c-danger-text)',
    '--font-display': 'var(--c-display)', '--font-body': 'var(--c-font)', '--font-mono': 'var(--c-mono)',
    '--ink': 'var(--c-text)', '--ink-soft': 'var(--c-soft)', '--ink-hover': 'var(--c-accent-hover)', '--paper': 'var(--c-bg)', '--paper-soft': 'var(--c-soft)',
    '--blueprint': 'var(--c-secondary)', '--blueprint-line': 'color-mix(in srgb, var(--c-text) 10%, transparent)', '--text-900': 'var(--c-text)', '--text-600': 'var(--c-secondary)',
    '--radius': 'var(--c-r-card)', '--radius-sm': 'var(--c-r-control)', '--radius-lg': 'var(--c-r-card)',
  };
  const S = `:root[data-charte="${ch.id}"][data-mode="${mode}"]`;
  return `${S},\n${S} body,\n${S} body[data-life-app],\n${S} body[data-life-app="nexora"] :is(.lp-theme, .lp-app),\n${S} :is(.lp-theme, .lp-app) {\n` +
    Object.entries(v).map(([k, x]) => `  ${k}: ${x};`).join('\n') + `\n}\n${S} { color-scheme: ${t.dark ? 'dark' : 'light'}; }\n`;
}
