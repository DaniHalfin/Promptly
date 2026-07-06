/**
 * A1/A2: CSS contract tests for accessibility tokens and touch targets.
 *
 * These assert the static CSS/HTML source so accessibility regressions
 * (contrast tokens, skip link, 44px touch targets) fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../src/index.css');
const htmlPath = resolve(__dirname, '../index.html');
const dailySpendLinePath = resolve(__dirname, '../src/components/Results/charts/DailySpendLine.tsx');
const css = readFileSync(cssPath, 'utf-8');
const html = readFileSync(htmlPath, 'utf-8');
const dailySpendLine = readFileSync(dailySpendLinePath, 'utf-8');
const landingPath = resolve(__dirname, '../src/pages/Landing.tsx');
const themeTogglePath = resolve(__dirname, '../src/components/ThemeToggle.tsx');
const landingSrc = readFileSync(landingPath, 'utf-8');
const themeToggleSrc = readFileSync(themeTogglePath, 'utf-8');

/** Extract the body of the first CSS rule matching the given selector. */
function ruleBody(source: string, selector: string): string {
  const idx = source.indexOf(selector);
  if (idx === -1) return '';
  const open = source.indexOf('{', idx);
  const close = source.indexOf('}', open);
  if (open === -1 || close === -1) return '';
  return source.slice(open + 1, close);
}

describe('A1: contrast tokens', () => {
  it('dark --text-muted is raised to oklch(67% 0.04 240) for AA on dark surfaces', () => {
    const root = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
    expect(root).toMatch(/--text-muted:\s*oklch\(67% 0\.04 240\)/);
  });

  it('light --text-muted is lowered to oklch(54% 0.03 245) for AA on white', () => {
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    expect(light).toMatch(/--text-muted:\s*oklch\(54% 0\.03 245\)/);
  });
});

describe('Batch 4: light-mode semantic *-text overrides', () => {
  // The default (dark) --color-critical-text / --color-positive-text are pale
  // colors tuned for dark surfaces (~75–78% L). Without a light-mode override
  // they drop to ~1.5–1.9:1 on the 15%-tint muted badge background → invisible.
  const light = css.slice(css.indexOf('[data-theme="light"]'));

  it('light mode darkens --color-critical-text for AA on pale badge backgrounds', () => {
    expect(light).toMatch(/--color-critical-text:\s*oklch\(48% 0\.18 25\)/);
  });

  it('light mode darkens --color-positive-text for AA on pale badge backgrounds', () => {
    expect(light).toMatch(/--color-positive-text:\s*oklch\(45% 0\.14 155\)/);
  });

  it('light mode retains the darkened --color-warning-text override', () => {
    expect(light).toMatch(/--color-warning-text:\s*oklch\(42% 0\.15 65\)/);
  });
});

describe('DailySpendLine tooltip tokens', () => {
  it('defines dark chart tooltip background, text, and border tokens', () => {
    const root = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
    expect(root).toMatch(/--chart-tooltip-bg:\s*var\(--color-bg-elevated\)/);
    expect(root).toMatch(/--chart-tooltip-text:\s*var\(--text-primary\)/);
    expect(root).toMatch(/--chart-tooltip-border:\s*var\(--color-border-subtle\)/);
  });

  it('defines light chart tooltip background, text, and border tokens', () => {
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    expect(light).toMatch(/--chart-tooltip-bg:\s*var\(--color-bg-surface\)/);
    expect(light).toMatch(/--chart-tooltip-text:\s*var\(--text-primary\)/);
    expect(light).toMatch(/--chart-tooltip-border:\s*var\(--color-border-subtle\)/);
  });

  it('DailySpendLine uses chart tooltip CSS vars for content, label, and item styles', () => {
    expect(dailySpendLine).toContain("backgroundColor: 'var(--chart-tooltip-bg)'");
    expect(dailySpendLine).toContain("border: '1px solid var(--chart-tooltip-border)'");
    expect(dailySpendLine).toContain("color: 'var(--chart-tooltip-text)'");
    expect(dailySpendLine).toContain("labelStyle={{ color: 'var(--chart-tooltip-text)' }}");
    expect(dailySpendLine).toContain("itemStyle={{ color: 'var(--chart-tooltip-text)' }}");
  });
});

describe('A1: skip link', () => {
  it('.skip-link uses themed primary text color', () => {
    expect(ruleBody(css, '.skip-link {')).toMatch(/color:\s*var\(--text-primary\)/);
  });

  it('.skip-link:focus rule exists', () => {
    expect(css).toContain('.skip-link:focus');
  });

  it('index.html uses class="skip-link" and no inline onfocus', () => {
    expect(html).toMatch(/class="skip-link"/);
    expect(html).not.toMatch(/onfocus=/);
  });
});

describe('A2: touch targets', () => {
  it('.secondary has min-height: 44px', () => {
    expect(ruleBody(css, '.secondary {')).toMatch(/min-height:\s*44px/);
  });

  it('.danger has min-height: 44px', () => {
    expect(ruleBody(css, '.danger {')).toMatch(/min-height:\s*44px/);
  });

  it('.upload-file-clear has min-width and min-height 44px', () => {
    const body = ruleBody(css, '.upload-file-clear {');
    expect(body).toMatch(/min-width:\s*44px/);
    expect(body).toMatch(/min-height:\s*44px/);
  });
});

describe('W10: accent-light contrast in light mode', () => {
  it('light mode overrides --color-accent-light to oklch(48% 0.18 275) for WCAG AA', () => {
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    expect(light).toMatch(/--color-accent-light:\s*oklch\(48% 0\.18 275\)/);
  });
});

describe('W11: no hardcoded rgba in .secondary light-mode overrides', () => {
  it('[data-theme="light"] .secondary uses var(--color-border-subtle), not rgba', () => {
    const body = ruleBody(css, '[data-theme="light"] .secondary {');
    expect(body).not.toMatch(/rgba/);
    expect(body).toContain('var(--color-border-subtle)');
  });

  it('[data-theme="light"] .secondary:hover uses var(--color-input-border), not rgba', () => {
    const body = ruleBody(css, '[data-theme="light"] .secondary:hover {');
    expect(body).not.toMatch(/rgba/);
    expect(body).toContain('var(--color-input-border)');
  });
});

describe('W12: DayPicker selected-day uses color token', () => {
  it('.rdp-day_selected does not use hardcoded #fff', () => {
    const block = css.slice(css.indexOf('.promptly-day-picker .rdp-day_selected'));
    const closingBrace = block.indexOf('}');
    const ruleText = block.slice(0, closingBrace);
    expect(ruleText).not.toContain('#fff');
  });

  it('.rdp-day_selected uses var(--text-on-accent)', () => {
    const body = ruleBody(css, '.promptly-day-picker .rdp-day_selected,');
    expect(body).toContain('var(--text-on-accent)');
  });
});

describe('W1–W3: :focus-visible outlines', () => {
  it('W1: .disclosure-btn:focus-visible rule exists in index.css', () => {
    expect(css).toContain('.disclosure-btn:focus-visible');
    const body = ruleBody(css, '.disclosure-btn:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
    expect(body).toMatch(/outline-offset:\s*2px/);
  });

  it('W2: .upload-area:focus-visible rule exists in index.css', () => {
    expect(css).toContain('.upload-area:focus-visible');
    const body = ruleBody(css, '.upload-area:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
    expect(body).toMatch(/outline-offset:\s*2px/);
  });

  it('W3: .primary:focus-visible rule exists', () => {
    expect(css).toContain('.primary:focus-visible');
    const body = ruleBody(css, '.primary:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('W3: .secondary:focus-visible rule exists', () => {
    expect(css).toContain('.secondary:focus-visible');
    const body = ruleBody(css, '.secondary:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('W3: .danger:focus-visible rule exists', () => {
    expect(css).toContain('.danger:focus-visible');
    const body = ruleBody(css, '.danger:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });
});

describe('W4: rec-focus-target class', () => {
  it('.rec-focus-target rule exists in index.css with outline:none', () => {
    expect(css).toContain('.rec-focus-target');
    const body = ruleBody(css, '.rec-focus-target {');
    expect(body).toMatch(/outline:\s*none/);
  });

  it('.rec-focus-target:focus-visible restores outline', () => {
    expect(css).toContain('.rec-focus-target:focus-visible');
    const body = ruleBody(css, '.rec-focus-target:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });
});

describe('W9: decorative SVGs have aria-hidden="true"', () => {
  it('Landing.tsx logo SVG (viewBox="0 0 32 32") has aria-hidden="true"', () => {
    expect(landingSrc).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">'
    );
  });

  it('ThemeToggle.tsx contains aria-hidden="true" on both sun and moon SVGs', () => {
    const matches = themeToggleSrc.match(/aria-hidden="true"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('ThemeToggle.tsx sun SVG has aria-hidden="true"', () => {
    const sunIdx = themeToggleSrc.indexOf("/* Sun icon */");
    const sunSvgTag = themeToggleSrc.slice(sunIdx, themeToggleSrc.indexOf('>', sunIdx) + 1);
    expect(sunSvgTag).toContain('aria-hidden="true"');
  });

  it('ThemeToggle.tsx moon SVG has aria-hidden="true"', () => {
    const moonIdx = themeToggleSrc.indexOf("/* Moon icon */");
    const moonSvgTag = themeToggleSrc.slice(moonIdx, themeToggleSrc.indexOf('>', moonIdx) + 1);
    expect(moonSvgTag).toContain('aria-hidden="true"');
  });
});
