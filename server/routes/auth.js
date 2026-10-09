import mongoose from 'mongoose';
import argon2 from 'argon2';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { User, Session } from '../models.js';
import { fail, hash, parse, audit, cookie } from '../core.js';

export function registerAuth(app) {
app.get('/api/health', (req, res) => res.json({ ok: mongoose.connection.readyState === 1 }));
app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' }) }), async (req, res) => {
  if (req.get('Origin') !== (process.env.APP_ORIGIN || 'http://localhost:3000')) fail(403, 'Invalid request origin');
  const data = parse(z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }), req.body);
  const user = await User.findOne({ email: data.email.toLowerCase(), active: true });
  const valid = user ? await argon2.verify(user.passwordHash, data.password) : await argon2.verify(app.locals.dummyHash, data.password);
  if (!user || !valid) fail(401, 'Invalid email or password');
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  await Session.create({ hash: hash(token), csrf, user: user._id, expiresAt: new Date(Date.now() + 8 * 3600000) });
  res.set('Set-Cookie', cookie(token)).json({ user: { id: user._id, name: user.name, role: user.role }, csrf });
});
app.use('/api', async (req, res, next) => {
  const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('boms_session='))?.slice(13);
  const session = token && await Session.findOne({ hash: hash(token), expiresAt: { $gt: new Date() } }).lean();
  const user = session && await User.findOne({ _id: session.user, active: true }).select('-passwordHash').lean();
  if (!user) fail(401, 'Please sign in');
  req.user = user; req.session = session;
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.get('Origin') !== (process.env.APP_ORIGIN || 'http://localhost:3000') || req.get('X-CSRF-Token') !== session.csrf) fail(403, 'Invalid request origin or CSRF token');
  }
  next();
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.user, csrf: req.session.csrf, currency: process.env.CURRENCY || 'INR' }));
app.post('/api/auth/logout', async (req, res) => { await Session.deleteOne({ _id: req.session._id }); res.set('Set-Cookie', cookie('')).json({ ok: true }); });
app.post('/api/auth/password', rateLimit({ windowMs: 60000, limit: 6, handler: (req, res) => res.status(429).json({ error: 'Too many password requests. Try again later.' }) }), async (req, res) => {
  const data = parse(z.object({ current: z.string().max(128), password: z.string().min(12).max(128) }), req.body);
  const user = await User.findById(req.user._id);
  if (!await argon2.verify(user.passwordHash, data.current)) fail(400, 'Current password is incorrect');
  const passwordHash = await argon2.hash(data.password);
  await mongoose.connection.transaction(async session => {
    const changed = await User.updateOne({ _id: user._id, active: true, passwordHash: user.passwordHash }, { $set: { passwordHash } }, { session });
    if (changed.matchedCount !== 1) fail(409, 'Account or password changed. Please sign in again.');
    await Session.deleteMany({ user: user._id }, { session });
    await audit(req, 'password.changed', 'user', user._id, session);
  });
  res.set('Set-Cookie', cookie('')).json({ ok: true });
});

}
