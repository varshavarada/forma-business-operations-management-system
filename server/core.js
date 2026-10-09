import mongoose from 'mongoose';
import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';
import { Audit, Operation } from './models.js';
export const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
export const hash = value => createHash('sha256').update(value).digest('hex');
export const id = z.string().regex(/^[a-f\d]{24}$/i);
export const text = z.string().trim().min(1).max(120);
export const money = z.number().int().min(0).max(100000000);
export const positive = z.number().int().min(1).max(100000);
export const parse = (schema, body) => schema.strict().parse(body);
export const manager = (req, res, next) => ['Manager', 'Administrator'].includes(req.user.role) ? next() : next(Object.assign(new Error('Manager permission required'), { status: 403 }));
export const admin = (req, res, next) => req.user.role !== 'Administrator' ? next(Object.assign(new Error('Administrator permission required'), { status: 403 })) : next();
export const audit = (req, action, entity, entityId, session, detail = '') => Audit.create([{ actor: req.user._id, action, entity, entityId: String(entityId), detail }], { session });
// Each retry-sensitive mutation and its stored response commit together.
export async function mutate(req, action) {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[\w-]{8,100}$/.test(key)) fail(400, 'A valid Idempotency-Key is required');
  const scoped = `${req.user._id}:${key}`;
  // A keyed fingerprint avoids a fast offline verifier for password-bearing requests.
  const fingerprint = createHmac('sha256', process.env.IDEMPOTENCY_SECRET).update(JSON.stringify([req.method, req.originalUrl, req.body])).digest('hex');
  async function previous() {
    const existing = await Operation.findOne({ key: scoped }).lean();
    if (existing && existing.fingerprint !== fingerprint) fail(409, 'Submission key was already used for another request');
    return existing;
  }
  const existing = await previous();
  if (existing) return existing.result;
  try {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(async () => {
      const completed = await Operation.findOne({ key: scoped }).session(session).lean();
      if (completed) { if (completed.fingerprint !== fingerprint) fail(409, 'Submission key was already used for another request'); return completed.result; }
      const result = await action(session);
      await Operation.create([{ key: scoped, fingerprint, result }], { session });
      return result;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
    finally { await session.endSession(); }
  } catch (error) {
    if (error.code === 11000) { const completed = await previous(); if (completed) return completed.result; }
    throw error;
  }
}
export const cookie = value => `boms_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? 28800 : 0}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
