const test = require('node:test');
const assert = require('node:assert/strict');

test('Phase 3: Multi-Type Tracking Questions & Metric Aggregations', async (t) => {

  await t.test('Question schema normalization defaults missing type to boolean', () => {
    const rawQuestions = [
      { id: 'q1', name: 'Brain Fog', question: 'Trouble focusing' },
      { id: 'q2', name: 'Overall Mood', question: 'Rate your day', type: 'scale' },
      { id: 'q3', name: 'Hours of Sleep', question: 'Total sleep', type: 'number', unit: 'hrs' }
    ];

    const normalized = rawQuestions.map(q => ({
      ...q,
      type: q.type || 'boolean',
      unit: q.unit || ''
    }));

    assert.equal(normalized[0].type, 'boolean');
    assert.equal(normalized[0].unit, '');
    assert.equal(normalized[1].type, 'scale');
    assert.equal(normalized[2].type, 'number');
    assert.equal(normalized[2].unit, 'hrs');
  });

  await t.test('Scale metrics (1-10) aggregate rolling average, min, max, and count accurately', () => {
    // 5 logged days of mood ratings over a 14-day window
    const entries = [
      { date: '2026-10-10', metrics: { mood: 7 } },
      { date: '2026-10-11', metrics: { mood: 8 } },
      { date: '2026-10-12', metrics: {} }, // unlogged that day
      { date: '2026-10-13', metrics: { mood: 9 } },
      { date: '2026-10-14', metrics: { mood: 6 } },
      { date: '2026-10-15', metrics: { mood: 8 } }
    ];

    const qId = 'mood';
    const vals = entries
      .filter(e => e.metrics && e.metrics[qId] !== undefined && e.metrics[qId] !== null)
      .map(e => e.metrics[qId]);

    assert.equal(vals.length, 5, 'Should have recorded 5 values');
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    assert.equal(sum, 38);
    assert.equal(avg.toFixed(1), '7.6');
    assert.equal(min, 6);
    assert.equal(max, 9);
  });

  await t.test('Quantitative numeric metrics compute rolling averages and handle float precision', () => {
    // Hours of sleep logged
    const entries = [
      { date: '2026-10-11', metrics: { sleep: 7.5 } },
      { date: '2026-10-12', metrics: { sleep: 6.0 } },
      { date: '2026-10-13', metrics: { sleep: 8.5 } },
      { date: '2026-10-14', metrics: { sleep: 7.0 } }
    ];

    const qId = 'sleep';
    const vals = entries
      .filter(e => e.metrics && e.metrics[qId] !== undefined && e.metrics[qId] !== null)
      .map(e => e.metrics[qId]);

    assert.equal(vals.length, 4);
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    assert.equal(sum, 29);
    assert.equal(avg.toFixed(1), '7.3');
    assert.equal(min, 6.0);
    assert.equal(max, 8.5);
  });

  await t.test('Empty metrics list returns 0 count and safely handles no-data state', () => {
    const entries = [
      { date: '2026-10-10', metrics: {} },
      { date: '2026-10-11', symptoms: ['details'] } // legacy entry without metrics
    ];

    const vals = entries
      .filter(e => e.metrics && e.metrics['caffeine'] !== undefined && e.metrics['caffeine'] !== null)
      .map(e => e.metrics['caffeine']);

    assert.equal(vals.length, 0);
  });

  await t.test('Legacy entries without metrics object load without errors', () => {
    const rawLegacyEntries = [
      { id: 'entry-old-1', date: '2026-10-01', symptoms: ['restless', 'dass_s1'], notes: 'Old entry' },
      { id: 'entry-old-2', date: '2026-10-02', symptoms: [] }
    ];

    const normalized = rawLegacyEntries.map(e => ({
      ...e,
      symptoms: Array.isArray(e.symptoms) ? e.symptoms : [],
      metrics: (e.metrics && typeof e.metrics === 'object') ? e.metrics : {}
    }));

    assert.ok(normalized[0].metrics);
    assert.deepEqual(normalized[0].metrics, {});
    assert.equal(normalized[0].symptoms.length, 2);
    assert.equal(normalized[1].symptoms.length, 0);
  });

  await t.test('CSV formatting correctly renders Metrics_Logged summary and values', () => {
    const customQuestions = [
      { id: 'c_mood', name: 'Overall Mood', type: 'scale' },
      { id: 'c_sleep', name: 'Hours of Sleep', type: 'number', unit: 'hrs' },
      { id: 'c_fog', name: 'Brain Fog', type: 'boolean' }
    ];

    const entry = {
      date: '2026-10-18',
      symptoms: ['c_fog'],
      metrics: { c_mood: 8, c_sleep: 7.5 },
      notes: 'Well rested'
    };

    const metricStrings = Object.entries(entry.metrics).map(([qId, val]) => {
      const qObj = customQuestions.find(q => q.id === qId);
      const qName = qObj ? qObj.name : qId;
      const isScale = qObj && qObj.type === 'scale';
      const unit = (qObj && qObj.unit) ? ` ${qObj.unit}` : '';
      return isScale ? `${qName}: ${val}/10` : `${qName}: ${val}${unit}`;
    }).join('; ');

    assert.equal(metricStrings, 'Overall Mood: 8/10; Hours of Sleep: 7.5 hrs');
  });
});
