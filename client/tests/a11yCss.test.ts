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
const css = readFileSync(cssPath, 'utf-8');
const html = readFileSync(htmlPath, 'utf-8');

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
