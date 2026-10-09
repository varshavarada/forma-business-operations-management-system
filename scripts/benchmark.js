import os from 'node:os';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { startFixture, client } from '../tests/helpers.js';
import { Customer, Product, Order, User } from '../server/models.js';
const startTime = performance.now();
const fixture = await startFixture();
try {
  const startupMs = performance.now() - startTime;
  const user = await User.findOne({ role: 'Administrator' });
  const customers = await Customer.insertMany(Array.from({ length: 1000 }, (_, i) => ({ code: `BENCH-C-${i}`, name: `Synthetic customer ${String(i).padStart(4, '0')}`, email: '', phone: '' })));
  const products = await Product.insertMany(Array.from({ length: 200 }, (_, i) => ({ sku: `BENCH-P-${i}`, name: `Synthetic product ${i}`, type: 'product', price: 10000 + i, stock: i % 20, reorderLevel: 3 })));
  await Order.insertMany(Array.from({ length: 2000 }, (_, i) => ({ number: `BENCH-O-${i}`, customer: customers[i % 1000]._id, customerName: customers[i % 1000].name, createdBy: user._id, status: i % 2 ? 'confirmed' : 'fulfilled', total: 10000, paid: i % 3 ? 10000 : 0, items: [{ product: products[i % 200]._id, name: products[i % 200].name, type: 'product', price: 10000, quantity: 1 }] })));
  const api = await client(fixture.base);
  let queries = 0; mongoose.set('debug', () => queries++);
  const cpuBefore = process.cpuUsage(); const elapsedStart = performance.now();
  const endpoints = ['/customers?limit=20', '/products?limit=20', '/orders?page=1', '/dashboard'];
  const results = [];
  for (const endpoint of endpoints) {
    for (let i = 0; i < 5; i++) await api(endpoint);
    const samples = [], payloads = [], queryCounts = [];
    for (let i = 0; i < 40; i++) { const before = queries; const start = performance.now(); const response = await api(endpoint); if (response.status !== 200) throw new Error(`Benchmark endpoint failed: ${endpoint}`); samples.push(performance.now() - start); payloads.push(Buffer.byteLength(JSON.stringify(response.body))); queryCounts.push(queries - before); }
    samples.sort((a, b) => a - b);
    results.push({ endpoint, requests: 40, concurrency: 1, p50Ms: Number(samples[19].toFixed(2)), p95Ms: Number(samples[37].toFixed(2)), maxMs: Number(samples[39].toFixed(2)), responseBytes: payloads[0], databaseCommandsPerRequest: [...new Set(queryCounts)] });
  }
  mongoose.set('debug', false);
  const cpu = process.cpuUsage(cpuBefore); const elapsedMs = performance.now() - elapsedStart;
  const plan = await Customer.find({ archived: false }).sort({ createdAt: -1, _id: -1 }).limit(20).lean().explain('executionStats');
  const assets = [];
  for (const file of ['client/index.html', 'client/styles.css', 'client/app.js']) { const bytes = await readFile(file); assets.push({ file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length }); }
  const report = { recordedAt: new Date().toISOString(), environment: { node: process.version, platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryMiB: Math.round(os.totalmem() / 1048576), mongodb: '7.0.14, isolated single-node replica set, local loopback' }, fixture: { customers: 1000, products: 200, orders: 2000 }, methodology: '5 warmups then 40 sequential HTTP requests per endpoint; includes authorization and JSON parsing; no network TLS; cached database binary; seeded records are synthetic read fixtures, not a stock-accounting history', startupMs: Number(startupMs.toFixed(2)), endpoints: results, nodeProcess: { rssMiBAfter: Number((process.memoryUsage().rss / 1048576).toFixed(2)), heapUsedMiBAfter: Number((process.memoryUsage().heapUsed / 1048576).toFixed(2)), cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000, measuredWallMs: Number(elapsedMs.toFixed(2)) }, customerQuery: { totalKeysExamined: plan.executionStats.totalKeysExamined, totalDocsExamined: plan.executionStats.totalDocsExamined, returned: plan.executionStats.nReturned, winningPlan: plan.queryPlanner.winningPlan }, assets, limitations: ['Node memory includes the benchmark harness and fixtures; MongoDB child-process resource use is not included.', 'No peak-memory, production-load, WAN, TLS, sustained-write or production capacity claim.', 'Read-only latency baseline; transaction correctness is separately integration-tested.'] };
  await mkdir('docs/evidence', { recursive: true }); await writeFile('docs/evidence/performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ endpoints: results, startupMs: report.startupMs, customerQuery: { keys: report.customerQuery.totalKeysExamined, docs: report.customerQuery.totalDocsExamined }, assets }, null, 2));
} finally { await fixture.close(); }
