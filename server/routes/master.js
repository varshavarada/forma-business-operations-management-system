import { z } from 'zod';
import { Customer, Product, Movement } from '../models.js';
import { fail, id, text, money, parse, manager, audit, mutate } from '../core.js';

export function registerMaster(app) {
const customerSchema = z.object({ code: text.transform(s => s.toUpperCase()), name: text, email: z.string().email().max(254).or(z.literal('')), phone: z.string().max(30), archived: z.boolean().optional() });
const productSchema = z.object({ description: z.string().trim().max(240).optional(), sku: text.transform(s => s.toUpperCase()), name: text, type: z.enum(['product', 'service']), price: money, reorderLevel: z.number().int().min(0).max(100000), archived: z.boolean().optional() });
app.get('/api/customers/:id', async (req, res) => {
  const doc = await Customer.findById(id.parse(req.params.id)).lean();
  if (!doc) fail(404, 'Record not found');
  res.json(doc);
});
for (const [path, Model, schema] of [['customers', Customer, customerSchema], ['products', Product, productSchema]]) {
  app.get(`/api/${path}`, async (req, res) => {
    const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page || 1);
    const limit = z.coerce.number().int().min(1).max(100).parse(req.query.limit || 20);
    const q = z.string().max(80).parse(req.query.q || '');
    const filter = { archived: req.query.archived === 'true' };
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const sort = req.query.sort === 'name' ? { name: 1, _id: 1 } : { createdAt: -1, _id: -1 };
    const [items, total] = await Promise.all([Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(), Model.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });
  app.post(`/api/${path}`, ...(path === 'products' ? [manager] : []), async (req, res) => {
    const data = parse(schema, req.body);
    const result = await mutate(req, async session => { const [doc] = await Model.create([data], { session }); await audit(req, `${path}.created`, path, doc._id, session); return doc.toObject(); });
    res.status(201).json(result);
  });
  app.patch(`/api/${path}/:id`, ...(path === 'products' ? [manager] : []), async (req, res) => {
    const recordId = id.parse(req.params.id);
    const data = parse(path === 'customers' ? schema.extend({ version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }) : schema, req.body);
    res.json(await mutate(req, async session => {
      if (path === 'customers') {
        const { version, ...fields } = data;
        const updated = await Model.findOneAndUpdate({ _id: recordId, version }, { $set: fields, $inc: { version: 1 } }, { new: true, runValidators: true, session });
        if (!updated) {
          if (!await Model.exists({ _id: recordId }).session(session)) fail(404, 'Record not found');
          throw Object.assign(new Error('This customer was updated by someone else. Reload the latest record and review your edits before saving.'), { status: 409, code: 'EDIT_CONFLICT' });
        }
        await audit(req, `${path}.updated`, path, updated._id, session);
        return updated.toObject();
      }
      const doc = await Model.findById(recordId).session(session); if (!doc) fail(404, 'Record not found');
      if (path === 'products' && doc.type !== data.type) fail(409, 'Catalog type cannot change');
      Object.assign(doc, data); doc.version += 1;
      await doc.save({ session }); await audit(req, `${path}.updated`, path, doc._id, session); return doc.toObject();
    }));
  });
}
app.post('/api/products/:id/adjust', manager, async (req, res) => {
  const productId = id.parse(req.params.id); const data = parse(z.object({ delta: z.number().int().min(-100000).max(100000).refine(n => n !== 0), reason: text }), req.body);
  res.json(await mutate(req, async session => {
    const doc = await Product.findOneAndUpdate({ _id: productId, type: 'product', archived: false, stock: { $gte: Math.max(0, -data.delta), $lte: 1000000000 - Math.max(0, data.delta) } }, { $inc: { stock: data.delta, version: 1 } }, { new: true, session });
    if (!doc) fail(409, 'Product unavailable or insufficient stock');
    await Movement.create([{ product: productId, delta: data.delta, reason: data.reason, actor: req.user._id }], { session });
    await audit(req, 'stock.adjusted', 'product', productId, session, data.reason); return doc.toObject();
  }));
});

}
