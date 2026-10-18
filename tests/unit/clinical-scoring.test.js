const test = require('node:test');
const assert = require('node:assert/strict');

// Clinical configurations as defined in the app
const asrsConfig = [
  { id: 'details', qNum: 'Q1', thresholdDays: 4 },
  { id: 'organizing', qNum: 'Q2', thresholdDays: 4 },
  { id: 'remembering', qNum: 'Q3', thresholdDays: 4 },
  { id: 'procrastination', qNum: 'Q4', thresholdDays: 8 },
  { id: 'fidgeting', qNum: 'Q5', thresholdDays: 8 },
  { id: 'restless', qNum: 'Q6', thresholdDays: 8 }
];

function getDassRating(days) {
  if (days <= 1) return { val: 0, label: "0 (Never/Rarely)" };
  if (days <= 4) return { val: 1, label: "1 (Sometimes)" };
  if (days <= 8) return { val: 2, label: "2 (Often)" };
  return { val: 3, label: "3 (Almost Always)" };
}

function getDassSeverity(scale, score) {
  if (scale === 'Depression') {
    if (score <= 9) return { label: "Normal" };
    if (score <= 13) return { label: "Mild" };
    if (score <= 20) return { label: "Moderate" };
    if (score <= 27) return { label: "Severe" };
    return { label: "Extremely Severe" };
  }
  if (scale === 'Anxiety') {
    if (score <= 7) return { label: "Normal" };
    if (score <= 9) return { label: "Mild" };
    if (score <= 14) return { label: "Moderate" };
    if (score <= 19) return { label: "Severe" };
    return { label: "Extremely Severe" };
  }
  if (scale === 'Stress') {
    if (score <= 14) return { label: "Normal" };
    if (score <= 18) return { label: "Mild" };
    if (score <= 25) return { label: "Moderate" };
    if (score <= 33) return { label: "Severe" };
    return { label: "Extremely Severe" };
  }
}

function calculateTrajectory(dassDelta, asrsDelta) {
  if ((dassDelta < 0 && asrsDelta <= 0) || (dassDelta <= 0 && asrsDelta < 0)) {
    return "Improving";
  } else if (dassDelta > 0 || asrsDelta > 0) {
    return "Elevated";
  }
  return "Stable";
}

test('ASRS Part A Threshold Criteria Logic', async (t) => {
  await t.test('Q1-Q3 meet threshold at 4 days, Q4-Q6 meet threshold at 8 days', () => {
    // Q1 at 3 days -> sub-threshold; at 4 days -> meets threshold
    assert.equal(3 >= asrsConfig[0].thresholdDays, false);
    assert.equal(4 >= asrsConfig[0].thresholdDays, true);

    // Q4 at 7 days -> sub-threshold; at 8 days -> meets threshold
    assert.equal(7 >= asrsConfig[3].thresholdDays, false);
    assert.equal(8 >= asrsConfig[3].thresholdDays, true);
  });

  await t.test('Positive screener is triggered when 4 or more criteria are met', () => {
    const isPositive = (metCriteria) => metCriteria >= 4;
    assert.equal(isPositive(0), false);
    assert.equal(isPositive(3), false);
    assert.equal(isPositive(4), true);
    assert.equal(isPositive(6), true);
  });
});

test('DASS-21 Frequency Rating Conversions', async (t) => {
  await t.test('Maps 0-1 days to rating 0', () => {
    assert.equal(getDassRating(0).val, 0);
    assert.equal(getDassRating(1).val, 0);
  });

  await t.test('Maps 2-4 days to rating 1', () => {
    assert.equal(getDassRating(2).val, 1);
    assert.equal(getDassRating(4).val, 1);
  });

  await t.test('Maps 5-8 days to rating 2', () => {
    assert.equal(getDassRating(5).val, 2);
    assert.equal(getDassRating(8).val, 2);
  });

  await t.test('Maps 9-14 days to rating 3', () => {
    assert.equal(getDassRating(9).val, 3);
    assert.equal(getDassRating(14).val, 3);
  });
});

test('DASS-21 Subscale Severity Banding (x2 Multiplied)', async (t) => {
  await t.test('Depression cutoffs', () => {
    assert.equal(getDassSeverity('Depression', 0).label, 'Normal');
    assert.equal(getDassSeverity('Depression', 9).label, 'Normal');
    assert.equal(getDassSeverity('Depression', 10).label, 'Mild');
    assert.equal(getDassSeverity('Depression', 13).label, 'Mild');
    assert.equal(getDassSeverity('Depression', 14).label, 'Moderate');
    assert.equal(getDassSeverity('Depression', 20).label, 'Moderate');
    assert.equal(getDassSeverity('Depression', 21).label, 'Severe');
    assert.equal(getDassSeverity('Depression', 27).label, 'Severe');
    assert.equal(getDassSeverity('Depression', 28).label, 'Extremely Severe');
    assert.equal(getDassSeverity('Depression', 42).label, 'Extremely Severe');
  });

  await t.test('Anxiety cutoffs', () => {
    assert.equal(getDassSeverity('Anxiety', 0).label, 'Normal');
    assert.equal(getDassSeverity('Anxiety', 7).label, 'Normal');
    assert.equal(getDassSeverity('Anxiety', 8).label, 'Mild');
    assert.equal(getDassSeverity('Anxiety', 9).label, 'Mild');
    assert.equal(getDassSeverity('Anxiety', 10).label, 'Moderate');
    assert.equal(getDassSeverity('Anxiety', 14).label, 'Moderate');
    assert.equal(getDassSeverity('Anxiety', 15).label, 'Severe');
    assert.equal(getDassSeverity('Anxiety', 19).label, 'Severe');
    assert.equal(getDassSeverity('Anxiety', 20).label, 'Extremely Severe');
  });

  await t.test('Stress cutoffs', () => {
    assert.equal(getDassSeverity('Stress', 0).label, 'Normal');
    assert.equal(getDassSeverity('Stress', 14).label, 'Normal');
    assert.equal(getDassSeverity('Stress', 15).label, 'Mild');
    assert.equal(getDassSeverity('Stress', 18).label, 'Mild');
    assert.equal(getDassSeverity('Stress', 19).label, 'Moderate');
    assert.equal(getDassSeverity('Stress', 25).label, 'Moderate');
    assert.equal(getDassSeverity('Stress', 26).label, 'Severe');
    assert.equal(getDassSeverity('Stress', 33).label, 'Severe');
    assert.equal(getDassSeverity('Stress', 34).label, 'Extremely Severe');
  });
});

test('Longitudinal Multi-Period Comparison & Trajectory', async (t) => {
  await t.test('Correctly identifies Improving trajectory', () => {
    assert.equal(calculateTrajectory(-6, 0), 'Improving');
    assert.equal(calculateTrajectory(0, -2), 'Improving');
    assert.equal(calculateTrajectory(-4, -1), 'Improving');
  });

  await t.test('Correctly identifies Elevated trajectory', () => {
    assert.equal(calculateTrajectory(4, 0), 'Elevated');
    assert.equal(calculateTrajectory(0, 1), 'Elevated');
    assert.equal(calculateTrajectory(2, 2), 'Elevated');
  });

  await t.test('Correctly identifies Stable trajectory', () => {
    assert.equal(calculateTrajectory(0, 0), 'Stable');
  });
});
