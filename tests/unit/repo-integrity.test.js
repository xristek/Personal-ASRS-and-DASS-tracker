const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '../../');
const htmlPath = path.join(rootDir, 'index.html');
const swPath = path.join(rootDir, 'sw.js');
const manifestPath = path.join(rootDir, 'manifest.json');

test('Repository Code & Asset Integrity', async (t) => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const swCode = fs.readFileSync(swPath, 'utf8');

  await t.test('All inline scripts in index.html compile with zero syntax errors', () => {
    const scriptMatches = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(scriptMatches.length > 0, 'Must have inline script blocks');

    scriptMatches.forEach((match, idx) => {
      assert.doesNotThrow(() => {
        new vm.Script(match[1]);
      }, `Inline script block ${idx} has syntax errors`);
    });
  });

  await t.test('sw.js compiles with zero syntax errors', () => {
    assert.doesNotThrow(() => {
      new vm.Script(swCode);
    }, 'Service Worker script has syntax errors');
  });

  await t.test('All cache assets declared in sw.js exist on disk', () => {
    // Extract ASSETS array from sw.js
    const assetsMatch = swCode.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(assetsMatch, 'sw.js must define ASSETS array');

    const assetEntries = assetsMatch[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);

    assetEntries.forEach(asset => {
      if (asset === './') return; // root directory
      const cleanPath = asset.replace(/^\.\//, '');
      const fullPath = path.join(rootDir, cleanPath);
      assert.ok(fs.existsSync(fullPath), `Asset declared in sw.js does not exist on disk: ${cleanPath}`);
    });
  });

  await t.test('manifest.json is valid JSON and icons exist on disk', () => {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    let manifest;
    assert.doesNotThrow(() => {
      manifest = JSON.parse(manifestContent);
    }, 'manifest.json is not valid JSON');

    assert.ok(manifest.name, 'Manifest must have a name');
    assert.ok(Array.isArray(manifest.icons), 'Manifest must declare icons array');

    manifest.icons.forEach(icon => {
      const iconPath = path.join(rootDir, icon.src);
      assert.ok(fs.existsSync(iconPath), `Icon file in manifest does not exist: ${icon.src}`);
    });
  });

  await t.test('Critical DOM element IDs are present in index.html', () => {
    const criticalIds = [
      // Views & Navigation
      'viewDaily', 'viewReport', 'viewSettings', 'viewData',
      'tabDaily', 'tabReport', 'tabSettings', 'tabData',
      // Daily Entry & Heatmap
      'activityOverviewCard', 'streakBadge', 'streakCount', 'statTotalLogged', 'statBestStreak', 'heatmapGrid',
      'entryForm', 'entryDate', 'entryNotes', 'formTitle',
      'quickClearBtn', 'quickCopyYesterdayBtn', 'quickFillNotice',
      // Report & Comparison
      'reportEndDate', 'screenerScoreBanner', 'screenerScoreText', 'screenerScoreBadge',
      'trendChartContainer', 'periodComparisonCard', 'comparisonWindowLabel',
      'comparisonMetricsGrid', 'comparisonTakeaway', 'dassScoreCards',
      'reportTableBody', 'dassTableBody',
      // Theme Toggle & PWA
      'themeToggleBtn', 'themeIconSun', 'themeIconMoon', 'pwaInstallBtn'
    ];

    criticalIds.forEach(id => {
      assert.ok(html.includes(`id="${id}"`), `Missing required DOM element ID: ${id}`);
    });
  });
});

test('CSV Serialization & Escaping Formatting', async (t) => {
  function escapeCSVField(str) {
    if (str === null || str === undefined) return '""';
    const s = String(str);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  }

  await t.test('Escapes quotes with double quotes per RFC-4180', () => {
    const raw = 'Felt "nervous", but relaxed later';
    const escaped = escapeCSVField(raw);
    assert.equal(escaped, '"Felt ""nervous"", but relaxed later"');
  });

  await t.test('Wraps values containing commas or newlines in quotes', () => {
    const raw = 'Line 1\nLine 2';
    const escaped = escapeCSVField(raw);
    assert.equal(escaped, '"Line 1\nLine 2"');
  });

  await t.test('Handles empty strings safely', () => {
    assert.equal(escapeCSVField(''), '""');
  });
});
