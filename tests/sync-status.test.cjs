const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function setup({ offline = false, pending = false } = {}) {
  const nodes = new Map(), timers = new Map(), store = new Map([['lq_sync_pending', String(pending)]]);
  let timerId = 0, requests = [], replies = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, hidden: false, disabled: false, addEventListener() {} });
    return nodes.get(id);
  };
  const ctx = vm.createContext({
    document: { getElementById: node, documentElement: { style: { setProperty() {} } } },
    window: { innerHeight: 800, addEventListener() {}, visualViewport: null }, navigator: { onLine: !offline },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    cloudStatusIcon: node('cloud-status-icon'), cloudBtnText: node('cloud-btn-text'),
    btnPushCloud: node('btn-push-cloud'), cloudModal: null,
    FIREBASE_ENDPOINT: 'https://example.invalid/app.json', ADMIN_PIN_DEFAULT: 'example',
    accounts: [{ username: 'before' }], isEmergencyLocked: false,
    getNotificationList: () => [], getTeleConfig: () => ({}), showToast() {}, showNotice() {}, pullFromCloud() {},
    console: { error() {} }, AbortController,
    fetch: async (url, options) => { requests.push({ url, options }); return await new Promise((resolve, reject) => { replies.push(resolve); options.signal.addEventListener('abort', () => reject(new Error('timeout'))); }); },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  const status = html.slice(html.indexOf('      let syncPending ='), html.indexOf('      if (cloudModal) {', html.indexOf('      let syncPending =')));
  const push = html.slice(html.indexOf('      async function pushToCloud('), html.indexOf('      function initFirebaseRealtimeListener('));
  vm.runInContext(status + push, ctx);
  return { ctx, node, store, timers, requests, replies, run: code => vm.runInContext(code, ctx) };
}
test('application scripts compile', () => {
  for (const [, js] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(js);
});
test('initial offline status never claims data is saved', () => {
  const h = setup({ offline: true });
  assert.equal(h.node('sync-status-bar').dataset.state, 'offline');
  assert.equal(h.requests.length, 0);
});
test('successful writes show saved only after server confirms', async () => {
  const h = setup(); h.run('triggerAutoSync()');
  assert.equal(h.store.get('lq_sync_pending'), 'true');
  const promise = h.run('pushToCloud(true)');
  assert.equal(h.node('sync-status-bar').dataset.state, 'saving');
  h.replies.shift()({ ok: true }); await promise;
  assert.equal(h.store.get('lq_sync_pending'), 'false');
  assert.equal(h.node('sync-status-bar').dataset.state, 'saved');
});
test('failed writes preserve pending flag and expose retry', async () => {
  const h = setup(); const promise = h.run('pushToCloud(true)');
  h.replies.shift()({ ok: false, json: async () => ({ error: 'denied' }) }); await promise;
  assert.equal(h.store.get('lq_sync_pending'), 'true');
  assert.equal(h.node('sync-status-bar').dataset.state, 'error');
  assert.equal(h.node('sync-retry').hidden, false);
  h.run('updateCloudUI("🟢", "ok")');
  assert.notEqual(h.node('sync-status-bar').dataset.state, 'saved');
});
test('offline edits remain pending without sending requests', async () => {
  const h = setup({ offline: true }); await h.run('pushToCloud(true)');
  assert.equal(h.requests.length, 0);
  assert.equal(h.store.get('lq_sync_pending'), 'true');
  assert.equal(h.node('sync-status-bar').dataset.state, 'offline');
});
test('edits while saving do not clear pending or start concurrent writes', async () => {
  const h = setup(); const promise = h.run('pushToCloud(true)');
  h.run('accounts.push({username:"after"}); triggerAutoSync(); pushToCloud(true)');
  assert.equal(h.requests.length, 1);
  h.replies.shift()({ ok: true }); await promise;
  assert.equal(h.store.get('lq_sync_pending'), 'true');
  assert.notEqual(h.node('sync-status-bar').dataset.state, 'saved');
  assert.equal(h.timers.size, 1);
});
test('pending state survives reload and remains visible after a cloud read', () => {
  const h = setup({ pending: true }); h.run('updateCloudUI("🟢", "ok")');
  assert.equal(h.node('sync-status-bar').dataset.state, 'error');
  assert.equal(h.node('sync-retry').hidden, false);
});
test('pull only replaces local accounts when there are no unsynced edits', () => {
  assert.match(html, /if \(canReplaceLocal && pullRevision === localSyncRevision && !syncPending && !pushInFlight && JSON\.stringify\(normalized\) !== JSON\.stringify\(accounts\)\)/);
});
test('stalled writes time out, preserve pending changes and allow retry', async () => {
  const h = setup(); const promise = h.run('pushToCloud(true)');
  [...h.timers.values()][0](); await promise;
  assert.equal(h.node('sync-status-bar').dataset.state, 'error');
  assert.equal(h.node('sync-retry').hidden, false);
  assert.equal(h.store.get('lq_sync_pending'), 'true');
  assert.equal(h.node('btn-push-cloud').disabled, false);
});
