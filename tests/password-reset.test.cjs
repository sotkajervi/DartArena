const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/password-reset.ts', 'utf8');
const compiled = '// Generated from src/pages/password-reset.ts. Do not edit directly.\n' + ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup(hash = '', options = {}) {
  const nodes = {};
  for (const id of ['resetMessage','requestForm','passwordForm','savePassword','sendReset','resetEmail','newPassword','confirmPassword']) {
    nodes[id] = { textContent: '', className: '', value: '', hidden: id === 'passwordForm', disabled: id === 'savePassword', focus() {}, reset() { nodes.newPassword.value = nodes.confirmPassword.value = ''; } };
  }
  let callback;
  const calls = { update: [], request: [], signout: [], history: [] };
  const user = { id: 'existing-account' };
  const auth = {
    onAuthStateChange(fn) { callback = fn; },
    async getUser() { return options.invalid ? { data: {}, error: { code: 'bad_jwt' } } : { data: { user }, error: null }; },
    async resetPasswordForEmail(email, config) { calls.request.push({email, config}); return { error: options.sendError || null }; },
    async updateUser(data) { calls.update.push(data); return { data: { user }, error: options.updateError || null }; },
    async signOut(config) { calls.signout.push(config); return { error: null }; },
  };
  vm.runInNewContext(compiled.replace('export {};', ''), {
    window: { supabase: { createClient(url, key, config) { calls.config = config; return { auth }; } } },
    document: { getElementById: id => nodes[id] }, URLSearchParams,
    location: { hash, search: '', pathname: '/DartArena/password-reset.html' },
    history: { replaceState(...args) { calls.history.push(args); } }, setTimeout: fn => setImmediate(fn),
  });
  await tick();
  return { nodes, calls, async emit(event) { callback(event, { user }); await tick(); await tick(); }, async submit(id) { await nodes[id].onsubmit({preventDefault(){}}); } };
}
const recovery = '#type=recovery&access_token=verified-by-supabase&refresh_token=refresh';
test('published JavaScript matches the TypeScript source', () => assert.equal(fs.readFileSync('password-reset.js', 'utf8'), compiled));
test('request uses a fixed redirect and a generic success message', async () => {
  const s = await setup(); s.nodes.resetEmail.value = ' player@example.com ';
  await s.submit('requestForm');
  assert.equal(s.calls.request[0].email, 'player@example.com');
  assert.equal(s.calls.request[0].config.redirectTo, 'https://sotkajervi.github.io/DartArena/');
  assert.match(s.nodes.resetMessage.textContent, /Hvis e-postadressen er registrert/);
  assert.equal(s.calls.config.auth.persistSession, false);
});
test('ordinary session and direct page visit cannot change a password', async () => {
  const s = await setup(); await s.emit('SIGNED_IN'); await s.emit('PASSWORD_RECOVERY'); await s.submit('passwordForm');
  assert.equal(s.nodes.passwordForm.hidden, true); assert.equal(s.calls.update.length, 0);
});
test('invalid recovery stays blocked and offers another email', async () => {
  const s = await setup(recovery, {invalid:true}); await s.emit('PASSWORD_RECOVERY');
  assert.equal(s.nodes.passwordForm.hidden, true); assert.equal(s.nodes.requestForm.hidden, false);
  assert.match(s.nodes.resetMessage.textContent, /ugyldig eller utløpt/);
});
test('recovery checks identity, validates passwords and updates existing user only', async () => {
  const s = await setup(recovery); await s.emit('PASSWORD_RECOVERY');
  assert.equal(s.nodes.passwordForm.hidden, false);
  s.nodes.newPassword.value = 'short'; await s.submit('passwordForm'); assert.equal(s.calls.update.length, 0);
  s.nodes.newPassword.value = 'a-long-unique-password'; s.nodes.confirmPassword.value = 'different';
  await s.submit('passwordForm'); assert.equal(s.calls.update.length, 0);
  s.nodes.confirmPassword.value = s.nodes.newPassword.value; await s.submit('passwordForm');
  assert.equal(s.calls.update.length, 1); assert.equal(s.calls.signout[0].scope, 'local');
  assert.equal(s.nodes.newPassword.value, ''); assert.equal(s.nodes.passwordForm.hidden, true);
  assert.match(s.nodes.resetMessage.textContent, /Passordet er oppdatert/);
  await s.submit('passwordForm'); assert.equal(s.calls.update.length, 1);
});
test('rate limits and weak password errors are visible and retryable', async () => {
  const s = await setup(recovery, { sendError: {code:'over_email_send_rate_limit'}, updateError:{code:'weak_password'} });
  await s.submit('requestForm'); assert.match(s.nodes.resetMessage.textContent, /For mange forsøk/); assert.equal(s.nodes.sendReset.disabled, false);
  await s.emit('PASSWORD_RECOVERY'); s.nodes.newPassword.value = s.nodes.confirmPassword.value = 'a-long-unique-password';
  await s.submit('passwordForm'); assert.match(s.nodes.resetMessage.textContent, /for svakt/); assert.equal(s.nodes.savePassword.disabled, false);
});
test('lobby entry forwards recovery and expired links, scrubs old URL, ignores regular login', () => {
  const code = fs.readFileSync('password-recovery-entry.js','utf8');
  for (const hash of [recovery, '#error=access_denied&error_code=otp_expired', '', '#type=signup&access_token=signup']) {
    const calls = [];
    vm.runInNewContext(code, { URL, URLSearchParams, location:{hash, pathname:'/DartArena/', href:'https://sotkajervi.github.io/DartArena/'+hash, replace:url=>calls.push(url)}, history:{replaceState:()=>calls.push('scrub')} });
    if (hash === recovery || hash.includes('error=')) { assert.equal(calls[0], 'scrub'); assert.ok(calls[1].startsWith('https://sotkajervi.github.io/DartArena/password-reset.html?recovery=1#')); }
    else assert.equal(calls.length, 0);
  }
});
