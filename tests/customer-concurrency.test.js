import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startFixture, client } from './helpers.js';
import { Audit } from '../server/models.js';
let fixture, api;
before(async () => { fixture = await startFixture(); api = await client(fixture.base); });
after(async () => { if (fixture) await fixture.close(); });
async function create() {
  const result = await api('/customers', 'POST', { code: crypto.randomUUID(), name: 'Synthetic concurrency customer', email: '', phone: '' });
  assert.equal(result.status, 201); return result.body;
}
const fields = c => ({ code: c.code, name: c.name, email: c.email, phone: c.phone, version: c.version });
test('customer updates reject stale versions and preserve the winning data and audit', async () => {
  const c = await create();
  const results = await Promise.all(['First editor', 'Second editor'].map(name => api(`/customers/${c._id}`, 'PATCH', { ...fields(c), name })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const winner = results.find(r => r.status === 200), conflict = results.find(r => r.status === 409);
  assert.equal(conflict.body.code, 'EDIT_CONFLICT'); assert.match(conflict.body.error, /Reload/);
  const latest = await api(`/customers/${c._id}`);
  assert.equal(latest.status, 200); assert.equal(latest.body.version, 1); assert.equal(latest.body.name, winner.body.name);
  assert.equal(await Audit.countDocuments({ action: 'customers.updated', entityId: c._id }), 1);
  assert.equal((await api(`/customers/${c._id}`, 'PATCH', { ...fields(c), phone: 'obsolete' })).status, 409);
  const retry = await api(`/customers/${c._id}`, 'PATCH', { ...fields(latest.body), phone: 'reviewed' });
  assert.equal(retry.status, 200); assert.equal(retry.body.version, 2); assert.equal(retry.body.name, winner.body.name);
});
test('customer version validation, authorization, not-found and idempotent replay', async () => {
  const c = await create(), body = { ...fields(c), name: 'Reviewed change' }, key = crypto.randomUUID();
  assert.equal((await fetch(`${fixture.base}/api/customers/${c._id}`)).status, 401);
  const { version, ...withoutVersion } = body;
  for (const invalid of [withoutVersion, { ...body, version: -1 }, { ...body, version: '0' }]) assert.equal((await api(`/customers/${c._id}`, 'PATCH', invalid)).status, 400);
  const first = await api(`/customers/${c._id}`, 'PATCH', body, key);
  const replay = await api(`/customers/${c._id}`, 'PATCH', body, key);
  assert.equal(first.status, 200); assert.deepEqual(replay.body, first.body);
  assert.equal((await api(`/customers/${c._id}`)).body.version, 1);
  assert.equal(await Audit.countDocuments({ action: 'customers.updated', entityId: c._id }), 1);
  assert.equal((await api('/customers/000000000000000000000000', 'PATCH', body)).status, 404);
  assert.equal((await api('/customers/000000000000000000000000')).status, 404);
});
