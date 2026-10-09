import { z } from 'zod';
import { Customer, Product, Order } from '../models.js';
import { fail, manager } from '../core.js';
const safeTotals = rows => {
  for (const row of rows) for (const key of ['sales', 'paid', 'orders', 'total', 'count']) {
    if (row[key] !== undefined && !Number.isSafeInteger(row[key])) fail(503, 'Report totals exceed the supported integer range');
  }
};

export function registerReporting(app) {
app.get('/api/dashboard', async (req, res) => {
  const [totals, trend, lowStock, pending, customers, outstanding] = await Promise.all([
    Order.aggregate([{ $match: { status: { $in: ['confirmed', 'fulfilled'] } } }, { $group: { _id: null, sales: { $sum: '$total' }, paid: { $sum: '$paid' }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: { $in: ['confirmed', 'fulfilled'] }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, total: { $sum: '$total' } } }, { $sort: { _id: 1 } }]),
    Product.find({ archived: false, type: 'product', $expr: { $lte: ['$stock', '$reorderLevel'] } }).select('name sku stock reorderLevel').sort({ stock: 1 }).limit(10).lean(),
    Order.find({ status: 'confirmed' }).select('number customerName total paid createdAt').sort({ createdAt: 1 }).limit(10).lean(), Customer.countDocuments({ archived: false }),
    Order.find({ status: { $in: ['confirmed', 'fulfilled'] }, $expr: { $lt: ['$paid', '$total'] } }).select('number customerName total paid').sort({ createdAt: 1 }).limit(10).lean()
  ]); safeTotals([...totals, ...trend]); res.json({ totals: totals[0] || { sales: 0, paid: 0, orders: 0 }, trend, lowStock, pending, customers, outstanding });
});
app.get('/api/reports', manager, async (req, res) => {
  const start = z.iso.date().parse(req.query.start); const end = z.iso.date().parse(req.query.end);
  const from = new Date(`${start}T00:00:00+05:30`), to = new Date(`${end}T00:00:00+05:30`); to.setUTCDate(to.getUTCDate() + 1);
  if (to <= from || to - from > 366 * 86400000) fail(400, 'Choose a date range of at most 366 days');
  const match = { createdAt: { $gte: from, $lt: to }, status: { $in: ['confirmed', 'fulfilled'] } };
  if (req.query.mode === 'outstanding') match.$expr = { $lt: ['$paid', '$total'] };
  const [summary, items] = await Promise.all([Order.aggregate([{ $match: match }, { $group: { _id: null, sales: { $sum: '$total' }, paid: { $sum: '$paid' }, count: { $sum: 1 } } }]), Order.find(match).select('number customerName total paid status createdAt').sort({ createdAt: -1 }).limit(1000).lean()]);
  safeTotals(summary); res.json({ summary: summary[0] || { sales: 0, paid: 0, count: 0 }, items, truncated: (summary[0]?.count || 0) > 1000 });
});
app.get('/api/reports/inventory', manager, async (req, res) => {
  const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page || 1);
  const filter = { archived: false, type: 'product' };
  const [items, total] = await Promise.all([Product.find(filter).select('name sku stock reorderLevel').sort({ name: 1, _id: 1 }).skip((page - 1) * 20).limit(20).lean(), Product.countDocuments(filter)]);
  res.json({ items, total, page, limit: 20 });
});

}
