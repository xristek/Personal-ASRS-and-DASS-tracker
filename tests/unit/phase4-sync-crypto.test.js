const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const rootDir = path.resolve(__dirname, '../../');
const htmlPath = path.join(rootDir, 'index.html');

function createSyncSandbox() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
  const mainScript = scriptMatches[scriptMatches.length - 1][1];

  const storageMap = new Map();
  const sessionMap = new Map();

  const mockStorage = (map) => ({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  });

  const sandbox = {
    window: {
      crypto: webcrypto,
      location: {
        origin: 'https://xristek.github.io',
        pathname: '/Personal-ASRS-and-DASS-tracker/',
        search: '',
        hash: '',
        assign: () => {}
      },
      history: { replaceState: () => {} },
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false, onLine: true },
      addEventListener: () => {}
    },
    document: {
      readyState: 'loading',
      documentElement: { classList: { toggle: () => false, contains: () => false, add: () => {}, remove: () => {} } },
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    navigator: { onLine: true },
    localStorage: mockStorage(storageMap),
    sessionStorage: mockStorage(sessionMap),
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.sessionStorage = sandbox.sessionStorage;

  vm.createContext(sandbox);
  vm.runInContext(mainScript, sandbox);
  return sandbox.window;
}

test('Phase 4: Zero-Knowledge Web Crypto Engine (PBKDF2 + AES-GCM-256)', async (t) => {
  const win = createSyncSandbox();
  const { CryptoEngine } = win;

  await t.test('Encrypts and decrypts tracker state round-trip with PBKDF2-SHA256 & AES-GCM-256', async () => {
    const sampleState = {
      schemaVersion: 2,
      entries: [
        {
          id: 'entry-101',
          date: '2026-10-20',
          symptoms: ['restless', 'dass_s1'],
          metrics: { custom_mood: 8, custom_sleep: 7.5 },
          notes: 'Encrypted note test',
          updatedAt: '2026-10-20T12:00:00.000Z'
        }
      ],
      customQuestions: [
        { id: 'custom_mood', name: 'Overall Mood', type: 'scale', unit: '', updatedAt: '2026-10-20T10:00:00.000Z' }
      ],
      deletedIds: { entries: {}, customQuestions: {} }
    };

    const passphrase = 'correct-horse-battery-staple-2026';
    const envelope = await CryptoEngine.encryptPayload(sampleState, passphrase);

    assert.equal(envelope.schemaVersion, 1);
    assert.equal(envelope.kdf, 'PBKDF2-SHA256');
    assert.equal(envelope.iterations, 100000);
    assert.equal(envelope.cipher, 'AES-GCM-256');
    assert.ok(envelope.salt && envelope.salt.length > 10, 'Must include base64 salt');
    assert.ok(envelope.iv && envelope.iv.length > 10, 'Must include base64 IV');
    assert.ok(envelope.ciphertext && !envelope.ciphertext.includes('Encrypted note test'), 'Ciphertext must not leak plaintext');

    const decrypted = await CryptoEngine.decryptPayload(envelope, passphrase);
    assert.deepEqual(JSON.parse(JSON.stringify(decrypted)), sampleState);
  });

  await t.test('Generates unique random salt and IV on every encryption operation', async () => {
    const payload = { entries: [{ id: 'e1', date: '2026-10-21' }] };
    const pass = 'same-passphrase-12345';

    const env1 = await CryptoEngine.encryptPayload(payload, pass);
    const env2 = await CryptoEngine.encryptPayload(payload, pass);

    assert.notEqual(env1.salt, env2.salt, 'Salt must be freshly randomized');
    assert.notEqual(env1.iv, env2.iv, 'IV must be freshly randomized');
    assert.notEqual(env1.ciphertext, env2.ciphertext, 'Ciphertext must differ across encryptions');
  });

  await t.test('Rejects wrong passphrase and tampered ciphertext (AES-GCM auth tag verification)', async () => {
    const payload = { entries: [{ id: 'e1', date: '2026-10-21', notes: 'Secret' }] };
    const env = await CryptoEngine.encryptPayload(payload, 'valid-passphrase-999');

    await assert.rejects(
      async () => CryptoEngine.decryptPayload(env, 'wrong-passphrase-000'),
      /Decryption failed/
    );

    // Tamper with ciphertext bytes
    const rawBytes = Buffer.from(env.ciphertext, 'base64');
    rawBytes[0] = rawBytes[0] ^ 0xff;
    const tamperedEnv = { ...env, ciphertext: rawBytes.toString('base64') };

    await assert.rejects(
      async () => CryptoEngine.decryptPayload(tamperedEnv, 'valid-passphrase-999'),
      /Decryption failed/
    );
  });
});

test('Phase 4: Google Drive OAuth Account Selection & Scope Verification', async (t) => {
  const win = createSyncSandbox();
  const { DriveAuth } = win;

  await t.test('buildAuthUrl enforces prompt=select_account and restricted drive.appdata scope', () => {
    const url = DriveAuth.buildAuthUrl('12345-test.apps.googleusercontent.com', 'https://example.com/app/');
    assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'));
    assert.ok(url.includes('client_id=12345-test.apps.googleusercontent.com'));
    assert.ok(url.includes('prompt=select_account'), 'Must prompt user to choose which Google account to use');
    assert.ok(url.includes(encodeURIComponent('https://www.googleapis.com/auth/drive.appdata')), 'Must request restricted drive.appdata scope');
  });

  await t.test('getCanonicalRedirectUri normalizes /index.html to trailing slash directory URL', () => {
    assert.equal(
      DriveAuth.getCanonicalRedirectUri('https://xristek.github.io/Personal-ASRS-and-DASS-tracker/index.html'),
      'https://xristek.github.io/Personal-ASRS-and-DASS-tracker/'
    );
    win.location.origin = 'https://xristek.github.io';
    win.location.pathname = '/Personal-ASRS-and-DASS-tracker/index.html';
    assert.equal(
      DriveAuth.getCanonicalRedirectUri(),
      'https://xristek.github.io/Personal-ASRS-and-DASS-tracker/'
    );
  });

  await t.test('generatePKCE produces valid URL-safe verifier and SHA-256 challenge', async () => {
    const pkce = await DriveAuth.generatePKCE();
    assert.ok(pkce.codeVerifier.length >= 40);
    assert.ok(pkce.codeChallenge.length >= 40);
    assert.notEqual(pkce.codeVerifier, pkce.codeChallenge);
  });
});

test('Phase 4: Deterministic Last-Write-Wins (LWW) SyncCoordinator.mergeState', async (t) => {
  const win = createSyncSandbox();
  const { SyncCoordinator } = win;

  await t.test('Merges disjoint entries and resolves conflicting updates using updatedAt LWW', () => {
    const localState = {
      entries: [
        { id: 'e-1', date: '2026-10-18', symptoms: ['restless'], metrics: {}, notes: 'Older local edit', updatedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'e-2', date: '2026-10-19', symptoms: ['details'], metrics: {}, notes: 'Local only day', updatedAt: '2026-10-19T09:00:00.000Z' }
      ],
      customQuestions: [
        { id: 'cq-1', name: 'Sleep', type: 'number', unit: 'hrs', updatedAt: '2026-10-18T08:00:00.000Z' }
      ],
      deletedIds: { entries: {}, customQuestions: {} }
    };

    const remoteState = {
      entries: [
        { id: 'e-1', date: '2026-10-18', symptoms: ['restless', 'procrastination'], metrics: {}, notes: 'Newer remote edit', updatedAt: '2026-10-18T15:30:00.000Z' },
        { id: 'e-3', date: '2026-10-20', symptoms: ['dass_s1'], metrics: {}, notes: 'Remote only day', updatedAt: '2026-10-20T11:00:00.000Z' }
      ],
      customQuestions: [
        { id: 'cq-2', name: 'Mood', type: 'scale', unit: '', updatedAt: '2026-10-19T12:00:00.000Z' }
      ],
      deletedIds: { entries: {}, customQuestions: {} }
    };

    const merged = SyncCoordinator.mergeState(localState, remoteState);
    assert.equal(merged.entries.length, 3);

    const oct18 = merged.entries.find((e) => e.date === '2026-10-18');
    assert.equal(oct18.notes, 'Newer remote edit');
    assert.deepEqual(oct18.symptoms, ['restless', 'procrastination']);

    assert.equal(merged.customQuestions.length, 2);
  });

  await t.test('Honors deletion tombstones and prevents resurrection of deleted items', () => {
    const localState = {
      entries: [
        { id: 'e-del', date: '2026-10-15', symptoms: ['motor'], notes: 'Should be deleted', updatedAt: '2026-10-15T10:00:00.000Z' },
        { id: 'e-keep', date: '2026-10-16', symptoms: [], notes: 'Kept', updatedAt: '2026-10-16T10:00:00.000Z' }
      ],
      customQuestions: [
        { id: 'cq-del', name: 'Old Question', type: 'boolean', updatedAt: '2026-10-15T10:00:00.000Z' }
      ],
      deletedIds: { entries: {}, customQuestions: {} }
    };

    const remoteState = {
      entries: [
        { id: 'e-keep', date: '2026-10-16', symptoms: [], notes: 'Kept', updatedAt: '2026-10-16T10:00:00.000Z' }
      ],
      customQuestions: [],
      deletedIds: {
        entries: { 'e-del': '2026-10-17T00:00:00.000Z' },
        customQuestions: { 'cq-del': '2026-10-17T00:00:00.000Z' }
      }
    };

    const merged = SyncCoordinator.mergeState(localState, remoteState);
    assert.equal(merged.entries.length, 1);
    assert.equal(merged.entries[0].id, 'e-keep');
    assert.equal(merged.customQuestions.length, 0);
    assert.equal(merged.deletedIds.entries['e-del'], '2026-10-17T00:00:00.000Z');
  });

  await t.test('Preserves backward compatibility with legacy entries missing updatedAt', () => {
    const localState = {
      entries: [
        { id: 'legacy-1', date: '2026-10-01', symptoms: ['restless'], notes: 'Legacy entry without updatedAt' }
      ],
      customQuestions: []
    };
    const remoteState = {
      entries: [
        { id: 'legacy-1', date: '2026-10-01', symptoms: ['restless', 'details'], notes: 'Updated with timestamp', updatedAt: '2026-10-21T08:00:00.000Z' }
      ],
      customQuestions: []
    };

    const merged = SyncCoordinator.mergeState(localState, remoteState);
    assert.equal(merged.entries.length, 1);
    assert.equal(merged.entries[0].notes, 'Updated with timestamp');
  });
});

test('Phase 4 Security Audit: Adversarial Crypto, OAuth CSRF & Injection Defenses', async (t) => {
  const win = createSyncSandbox();
  const { CryptoEngine, DriveAuth, SyncCoordinator } = win;

  await t.test('Blocks PBKDF2 iteration downgrade (<100k) and CPU DoS (>1M) in sync envelopes', async () => {
    const payload = { entries: [] };
    const validEnv = await CryptoEngine.encryptPayload(payload, 'strong-passphrase-123');

    await assert.rejects(
      async () => CryptoEngine.decryptPayload({ ...validEnv, iterations: 10 }, 'strong-passphrase-123'),
      /Invalid PBKDF2 iteration count/
    );

    await assert.rejects(
      async () => CryptoEngine.decryptPayload({ ...validEnv, iterations: 50000000 }, 'strong-passphrase-123'),
      /Invalid PBKDF2 iteration count/
    );

    await assert.rejects(
      async () => CryptoEngine.decryptPayload({ ...validEnv, kdf: 'NONE' }, 'strong-passphrase-123'),
      /Unsupported KDF algorithm/
    );

    await assert.rejects(
      async () => CryptoEngine.decryptPayload({ ...validEnv, cipher: 'AES-CBC' }, 'strong-passphrase-123'),
      /Unsupported cipher algorithm/
    );
  });

  await t.test('Blocks OAuth 2.0 Login CSRF when state parameter is missing or mismatched', async () => {
    // 1. Generate valid OAuth URL (stores expected state in sessionStorage)
    const authUrl = DriveAuth.buildAuthUrl('client-123.apps.googleusercontent.com', 'https://example.com/app');
    const urlParams = new URLSearchParams(authUrl.split('?')[1]);
    const validState = urlParams.get('state');
    assert.ok(validState && validState.length >= 20, 'Must generate high-entropy OAuth state');

    // 2. Simulate attacker redirecting with forged state
    win.location.hash = '#access_token=attacker_token_123&expires_in=3600&state=forged_attacker_state';
    await assert.rejects(
      async () => DriveAuth.handleOAuthRedirectHash(),
      /OAuth state verification failed/
    );
    assert.equal(DriveAuth.getTokenState(), null, 'Must not store token when state verification fails');
  });

  await t.test('Sanitizes XSS payloads in IDs and blocks prototype pollution in mergeState', () => {
    const maliciousRemote = {
      entries: [
        {
          id: "entry-1'); alert(1); //",
          date: '2026-10-21',
          symptoms: ["restless", "<script>alert(1)</script>"],
          metrics: JSON.parse('{"__proto__": 999, "constructor": 888, "custom_1": "7.5", "bad_metric": "not-a-number"}'),
          notes: '<img src=x onerror=alert(1)>',
          updatedAt: '2026-10-21T12:00:00.000Z'
        },
        {
          id: 'bad-date-entry',
          date: '2026-10-21"><script>',
          symptoms: [],
          updatedAt: '2026-10-21T12:00:00.000Z'
        }
      ],
      customQuestions: [
        {
          id: "cq_1'); alert(2); //",
          name: 'Mood',
          type: 'invalid_type_injection',
          unit: 'hrs',
          updatedAt: '2026-10-21T12:00:00.000Z'
        }
      ],
      deletedIds: {
        entries: JSON.parse('{"__proto__": "2099-01-01T00:00:00.000Z", "valid_del": "2026-10-21T00:00:00.000Z"}'),
        customQuestions: {}
      }
    };

    const merged = SyncCoordinator.mergeState({ entries: [], customQuestions: [] }, maliciousRemote);

    // Invalid date entry rejected; valid date entry has sanitized ID
    assert.equal(merged.entries.length, 1);
    assert.equal(merged.entries[0].id, 'entry-1alert1');
    assert.equal(Object.prototype.hasOwnProperty.call(merged.entries[0].metrics, '__proto__'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(merged.entries[0].metrics, 'constructor'), false);
    assert.equal(merged.entries[0].metrics.custom_1, 7.5);
    assert.equal(merged.entries[0].metrics.bad_metric, undefined);

    // Custom question ID and type sanitized
    assert.equal(merged.customQuestions.length, 1);
    assert.equal(merged.customQuestions[0].id, 'cq_1alert2');
    assert.equal(merged.customQuestions[0].type, 'boolean');

    // Tombstone map free of __proto__ pollution
    assert.equal(Object.prototype.hasOwnProperty.call(merged.deletedIds.entries, '__proto__'), false);
    assert.equal(merged.deletedIds.entries.valid_del, '2026-10-21T00:00:00.000Z');
  });
});
