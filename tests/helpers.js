import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { app, initialize } from '../server/app.js';
import { User } from '../server/models.js';
export async function startFixture() {
  process.env.NODE_ENV = 'test';
  process.env.IDEMPOTENCY_SECRET = 'isolated-synthetic-fixture-key-never-use-in-production';
  // Never uses MONGODB_URI or any external/Atlas database.
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14' } });
  await mongoose.connect(db.getUri('boms_test'));
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  await initialize();
  const passwordHash = await argon2.hash('SyntheticPass123!');
  for (const role of ['Administrator', 'Manager', 'Staff']) await User.create({ name: `Test ${role}`, email: `${role.toLowerCase()}@example.test`, passwordHash, role });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = base;
  return { base, db, server, close: async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db.stop(); } };
}
export async function client(base, role = 'Administrator') {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: `${role.toLowerCase()}@example.test`, password: 'SyntheticPass123!' }) });
  const data = await response.json(); if (!response.ok) throw new Error(JSON.stringify(data));
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return async (path, method = 'GET', body, key = crypto.randomUUID(), headers = {}) => {
    const response = await fetch(`${base}/api${path}`, { method, headers: { Cookie: cookie, Origin: base, 'X-CSRF-Token': data.csrf, 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
}
