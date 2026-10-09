import mongoose from 'mongoose';
import argon2 from 'argon2';
import { z } from 'zod';
import { User, Policy, Audit } from '../server/models.js';
// Non-destructive first-account bootstrap. No catalog or customer fixtures.
const email = z.string().email().parse(process.env.ADMIN_EMAIL).toLowerCase();
const password = z.string().min(12).max(128).parse(process.env.ADMIN_PASSWORD);
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Policy.init(), Audit.init()]);
  await Policy.updateOne({ key: 'bootstrap' }, { $setOnInsert: { version: 0 } }, { upsert: true });
  const passwordHash = await argon2.hash(password);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    await Policy.updateOne({ key: 'bootstrap' }, { $inc: { version: 1 } }, { session });
    if (await User.exists({ role: 'Administrator' }).session(session)) throw new Error('Administrator already exists; bootstrap refused');
    const [user] = await User.create([{ name: process.env.ADMIN_NAME || 'Business Administrator', email, passwordHash, role: 'Administrator' }], { session });
    await Audit.create([{ actor: user._id, action: 'user.bootstrapped', entity: 'user', entityId: String(user._id) }], { session });
  }); } finally { await session.endSession(); }
  console.log('Initial administrator created. Remove ADMIN_PASSWORD from your environment.');
} catch (error) {
  console.error(error.message === 'Administrator already exists; bootstrap refused' ? error.message : `Administrator bootstrap failed (${error.name}). Check configuration and transaction support privately.`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
