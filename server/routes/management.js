import argon2 from 'argon2';
import { z } from 'zod';
import { User, Session, Order, Movement, Audit, Policy } from '../models.js';
import { fail, id, text, parse, manager, admin, audit, mutate } from '../core.js';

export function registerManagement(app) {
for (const [path, Model, restricted] of [['orders', Order, false], ['movements', Movement, true], ['audit', Audit, true], ['users', User, true]]) {
  app.get(`/api/${path}`, ...(restricted ? [path === 'users' ? admin : manager] : []), async (req, res) => {
    const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page || 1); const filter = {};
    if (path === 'orders' && req.query.status) filter.status = z.enum(['draft', 'confirmed', 'fulfilled', 'cancelled']).parse(req.query.status);
    if (path === 'movements' && req.query.product) filter.product = id.parse(req.query.product);
    if (path === 'orders' && req.query.q) { const q = z.string().max(80).parse(req.query.q); const term = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; filter.$or = [{ number: term }, { customerName: term }]; }
    const query = Model.find(filter).select(path === 'users' ? '-passwordHash' : '').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20);
    if (path === 'audit' || path === 'movements') query.populate('actor', 'name');
    if (path === 'movements') query.populate('product', 'name sku').populate('order', 'number');
    const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]); res.json({ items, total, page, limit: 20 });
  });
}
app.post('/api/users', admin, async (req, res) => {
  const data = parse(z.object({ name: text, email: z.string().email().max(254), password: z.string().min(12).max(128), role: z.enum(['Administrator', 'Manager', 'Staff']) }), req.body);
  const passwordHash = await argon2.hash(data.password);
  res.status(201).json(await mutate(req, async session => { const [user] = await User.create([{ name: data.name, email: data.email.toLowerCase(), passwordHash, role: data.role }], { session }); await audit(req, 'user.created', 'user', user._id, session); return { _id: user._id, name: user.name, role: user.role }; }));
});
app.patch('/api/users/:id', admin, async (req, res) => {
  const userId = id.parse(req.params.id); const data = parse(z.object({ active: z.boolean(), role: z.enum(['Administrator', 'Manager', 'Staff']) }), req.body);
  if (userId === String(req.user._id)) fail(409, 'Self role changes and deactivation are prohibited');
  res.json(await mutate(req, async session => {
    await Policy.updateOne({ key: 'administrators' }, { $inc: { version: 1 } }, { session });
    const user = await User.findById(userId).select('-passwordHash').session(session); if (!user) fail(404, 'User not found');
    if (user.active && user.role === 'Administrator' && (!data.active || data.role !== 'Administrator') && await User.countDocuments({ active: true, role: 'Administrator' }).session(session) <= 1) fail(409, 'Keep at least one active administrator');
    Object.assign(user, data); await user.save({ session }); await Session.deleteMany({ user: userId }, { session }); await audit(req, 'user.updated', 'user', userId, session); return user.toObject();
  }));
});

}
