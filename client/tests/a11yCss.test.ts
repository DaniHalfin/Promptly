/**
 * A1/A2: CSS contract tests for accessibility tokens and touch targets.
 *
 * These assert the static CSS/HTML source so accessibility regressions
 * (contrast tokens, skip link, 44px touch targets) fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
const analysisPath = resolve(__dirname, '../src/pages/Analysis.tsx');
const resultsPath = resolve(__dirname, '../src/pages/Results.tsx');
const analysisSrc = readFileSync(analysisPath, 'utf-8');
const resultsSrc = readFileSync(resultsPath, 'utf-8');
const convLengthBarPath = resolve(__dirname, '../src/components/Results/charts/ConversationLengthBar.tsx');
const tokenRatioBarPath = resolve(__dirname, '../src/components/Results/charts/TokenRatioBar.tsx');
const convLengthBarSrc = readFileSync(convLengthBarPath, 'utf-8');
const tokenRatioBarSrc = readFileSync(tokenRatioBarPath, 'utf-8');
const appPath = resolve(__dirname, '../src/App.tsx');
const appSrc = readFileSync(appPath, 'utf-8');

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

  it('W2: .skip-link:focus has min-height: 44px', () => {
    const focusBlock = ruleBody(css, '.skip-link:focus {');
    expect(focusBlock).toMatch(/min-height:\s*44px/);
  });

  it('W2: .skip-link:focus has min-width: 44px', () => {
    const focusBlock = ruleBody(css, '.skip-link:focus {');
    expect(focusBlock).toMatch(/min-width:\s*44px/);
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

describe('W-FOCUS-01: global focus-visible rule', () => {
  it('button:focus-visible rule exists in index.css', () => {
    expect(css).toContain('button:focus-visible');
    expect(ruleBody(css, 'button:focus-visible,')).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('[role="button"]:focus-visible rule is included in the same ruleset', () => {
    expect(css).toContain('[role="button"]:focus-visible');
  });

  it('[role="switch"]:focus-visible rule is included in the same ruleset', () => {
    expect(css).toContain('[role="switch"]:focus-visible');
  });
});

describe('W-A11Y-02: --color-accent contrast in light mode', () => {
  it('light mode overrides --color-accent to oklch(45% 0.18 275) for WCAG AA ≥4.5:1', () => {
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    expect(light).toMatch(/--color-accent:\s*oklch\(45% 0\.18 275\)/);
  });
});

describe('W-FOCUS-02: .focus-target class', () => {
  it('.focus-target rule exists in index.css with outline: none', () => {
    expect(css).toContain('.focus-target {');
    const body = ruleBody(css, '.focus-target {');
    expect(body).toMatch(/outline:\s*none/);
  });

  it('.focus-target:focus-visible restores outline', () => {
    expect(css).toContain('.focus-target:focus-visible');
    const body = ruleBody(css, '.focus-target:focus-visible {');
    expect(body).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });
});

describe('W-FOCUS-02: no inline outline:none on focus-managed headings', () => {
  it('Landing.tsx h1[data-focus-on-mount] uses className="focus-target"', () => {
    // Must have the class
    expect(landingSrc).toContain('className="focus-target"');
    // The h1 near data-focus-on-mount must NOT have inline outline:none
    const h1Block = landingSrc.slice(
      landingSrc.indexOf('data-focus-on-mount'),
      landingSrc.indexOf('>', landingSrc.indexOf('data-focus-on-mount') + 200),
    );
    expect(h1Block).not.toContain("outline: 'none'");
  });

  it('Results.tsx h1[data-focus-on-mount] uses className="focus-target"', () => {
    expect(resultsSrc).toContain('className="focus-target"');
    const h1Block = resultsSrc.slice(
      resultsSrc.indexOf('data-focus-on-mount'),
      resultsSrc.indexOf('>', resultsSrc.indexOf('data-focus-on-mount') + 200),
    );
    expect(h1Block).not.toContain("outline: 'none'");
  });

  it('Analysis.tsx h1[data-focus-on-mount] uses className="focus-target"', () => {
    expect(analysisSrc).toContain('className="focus-target"');
    const h1Block = analysisSrc.slice(
      analysisSrc.indexOf('data-focus-on-mount'),
      analysisSrc.indexOf('>', analysisSrc.indexOf('data-focus-on-mount') + 200),
    );
    expect(h1Block).not.toContain("outline: 'none'");
  });
});

describe('W-TOKEN-01: chart tooltip tokens', () => {
  it('ConversationLengthBar.tsx uses var(--chart-tooltip-bg), not #f1f5f9', () => {
    expect(convLengthBarSrc).toContain("backgroundColor: 'var(--chart-tooltip-bg)'");
    expect(convLengthBarSrc).not.toContain('#f1f5f9');
    expect(convLengthBarSrc).not.toContain('#cbd5e1');
  });

  it('ConversationLengthBar.tsx has labelStyle and itemStyle with chart-tooltip-text', () => {
    expect(convLengthBarSrc).toContain("labelStyle={{ color: 'var(--chart-tooltip-text)' }}");
    expect(convLengthBarSrc).toContain("itemStyle={{ color: 'var(--chart-tooltip-text)' }}");
  });

  it('TokenRatioBar.tsx uses var(--chart-tooltip-bg), not #f1f5f9', () => {
    expect(tokenRatioBarSrc).toContain("backgroundColor: 'var(--chart-tooltip-bg)'");
    expect(tokenRatioBarSrc).not.toContain('#f1f5f9');
    expect(tokenRatioBarSrc).not.toContain('#cbd5e1');
  });

  it('TokenRatioBar.tsx has labelStyle and itemStyle with chart-tooltip-text', () => {
    expect(tokenRatioBarSrc).toContain("labelStyle={{ color: 'var(--chart-tooltip-text)' }}");
    expect(tokenRatioBarSrc).toContain("itemStyle={{ color: 'var(--chart-tooltip-text)' }}");
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

describe('B1: skip-link target focusability', () => {
  it('App.tsx <main id="main-content"> has tabIndex={-1}', () => {
    // The main element must carry tabIndex={-1} so .focus() from the skip link works.
    // A future dev removing it breaks keyboard skip-link navigation.
    expect(appSrc).toMatch(/<main\s[^>]*id="main-content"[^>]*tabIndex=\{-1\}/s);
  });

  it('index.html skip link target #main-content exists', () => {
    expect(html).toContain('href="#main-content"');
  });
});

describe('B3: programmatic focus ring via plain :focus rules', () => {
  // CORRECT — trailing comma only exists in the combined selector after the fix
  it('B3: .focus-target has a plain :focus rule (not just :focus-visible)', () => {
    const idx = css.indexOf('.focus-target:focus,');
    expect(idx).toBeGreaterThan(-1);
    const block = css.slice(idx, css.indexOf('}', idx));
    expect(block).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('B3: .rec-focus-target has a plain :focus rule (not just :focus-visible)', () => {
    const idx = css.indexOf('.rec-focus-target:focus,');
    expect(idx).toBeGreaterThan(-1);
    const block = css.slice(idx, css.indexOf('}', idx));
    expect(block).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });
});

describe('B4: zero tabIndex={-1} elements with inline outline:none', () => {
  // Recursively collect all TSX files in src/
  function collectTsxFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...collectTsxFiles(full));
      else if (entry.name.endsWith('.tsx')) files.push(full);
    }
    return files;
  }

  const srcDir = resolve(__dirname, '../src');
  const tsxFiles = collectTsxFiles(srcDir);

  it('no TSX file has tabIndex={-1} AND outline:none in the same element', () => {
    const violations: string[] = [];

    for (const filePath of tsxFiles) {
      const src = readFileSync(filePath, 'utf-8');
      // Detect elements with tabIndex={-1} that ALSO have an inline outline:none
      // This regex finds a JSX opening tag containing both patterns within ~300 chars.
      const tagPattern = /<(?:h[1-6]|div|section|main)[^>]{0,300}tabIndex=\{-1\}[^>]{0,300}outline:\s*['"]none['"]/gs;
      const reversePattern = /<(?:h[1-6]|div|section|main)[^>]{0,300}outline:\s*['"]none['"][^>]{0,300}tabIndex=\{-1\}/gs;
      if (tagPattern.test(src) || reversePattern.test(src)) {
        violations.push(filePath.replace(srcDir, 'src'));
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('B5: no hardcoded hex colors on Recharts chart primitive props', () => {
  // Note: src/components/export/PrintLayout.tsx intentionally excluded —
  // html2canvas PDF export requires literal hex values, not CSS variables.
  // See B5 decision log and PrintLayout.test.ts.
  const chartDir = resolve(__dirname, '../src/components/Results/charts');
  const chartFiles = readdirSync(chartDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => ({ name: f, src: readFileSync(join(chartDir, f), 'utf-8') }));

  it('no chart file uses fill="#..." on Recharts primitives (Bar, Pie, Line, Area)', () => {
    const violations: string[] = [];
    // Match fill="<hex>" or stroke="<hex>" where hex is #RGB or #RRGGBB or #RRGGBBAA
    const hexPropPattern = /(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/g;
    for (const { name, src } of chartFiles) {
      const matches = src.match(hexPropPattern);
      if (matches) violations.push(`${name}: ${matches.join(', ')}`);
    }
    expect(violations).toEqual([]);
  });
});

describe('W1: disclosure-btn light-mode contrast', () => {
  it('[data-theme="light"] .disclosure-btn overrides color to var(--text-secondary)', () => {
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    // The light-mode block for .disclosure-btn must set color: var(--text-secondary)
    // --text-secondary in light mode is oklch(45% 0.04 245) which achieves ≥4.5:1
    // against the light inset background. --text-muted (oklch 54%) does not.
    const btnBlock = light.slice(
      light.indexOf('[data-theme="light"] .disclosure-btn {'),
      light.indexOf('}', light.indexOf('[data-theme="light"] .disclosure-btn {')) + 1,
    );
    expect(btnBlock).toContain('color: var(--text-secondary)');
  });
});

describe('W7: no spatial directional language in run-disabled copy', () => {
  it('runDisabledReason strings do not contain bare "above" or "below" referencing UI position', () => {
    // Extract all string literals in runDisabledReason ternary chain.
    // Match quoted string literals that would appear as run-disabled-reason text.
    const disabledReasonBlock = landingSrc.slice(
      landingSrc.indexOf('runDisabledReason ='),
      landingSrc.indexOf('runDisabled ='),
    );
    // Fail if any of the user-facing strings contain "above" or "below" as a spatial reference.
    expect(disabledReasonBlock).not.toMatch(/['"][^'"]*\babove\b[^'"]*['"]/i);
    expect(disabledReasonBlock).not.toMatch(/['"][^'"]*\bbelow\b[^'"]*['"]/i);
  });
});
