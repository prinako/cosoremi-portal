const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'css', 'theme-gradients.css'),
  'utf8'
);

test('all public gradient groups are driven by theme colors', () => {
  for (const variable of [
    '--gradient-brand',
    '--gradient-hero-overlay',
    '--gradient-section-soft',
    '--gradient-section-deep',
    '--gradient-placeholder',
    '--gradient-cta',
    '--gradient-page-hero',
  ]) {
    assert.match(css, new RegExp(`${variable}:`));
  }

  assert.match(css, /--theme-primary: var\(--primary-color/);
  assert.match(css, /--theme-secondary: var\(--secondary-color/);
  assert.match(css, /color-mix\(/);
});

test('theme gradients are applied to every public gradient surface', () => {
  const expectedMappings = [
    ['.brand-mark', '--gradient-brand'],
    ['.hero-overlay', '--gradient-hero-overlay'],
    ['.section-soft', '--gradient-section-soft'],
    ['.section-deep', '--gradient-section-deep'],
    ['.placeholder-image', '--gradient-placeholder'],
    ['.cta-section', '--gradient-cta'],
    ['.page-hero', '--gradient-page-hero'],
  ];

  for (const [selector, variable] of expectedMappings) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      css,
      new RegExp(`${escapedSelector}\\s*\\{[^}]*var\\(${variable}\\)`, 's')
    );
  }
});
