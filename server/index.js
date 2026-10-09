import mongoose from 'mongoose';
import { app, initialize } from './app.js';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before starting');
if (!process.env.IDEMPOTENCY_SECRET || process.env.IDEMPOTENCY_SECRET.length < 32) throw new Error('Configure IDEMPOTENCY_SECRET using npm run configure');
if (!['INR', 'USD', 'EUR', 'GBP'].includes(process.env.CURRENCY || 'INR')) throw new Error('Use a supported two-decimal currency: INR, USD, EUR, GBP');
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN?.startsWith('https://')) throw new Error('Production requires an HTTPS APP_ORIGIN');
try { await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: process.env.NODE_ENV !== 'production' }); }
catch (error) { console.error(JSON.stringify({ event: 'database.connection.failed', type: error.name })); process.exit(1); }
const hello = await mongoose.connection.db.admin().command({ hello: 1 });
if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('A transaction-capable MongoDB replica set is required');
if (process.env.NODE_ENV !== 'production') await Promise.all(Object.values(mongoose.models).map(model => model.init()));
else {
  for (const model of Object.values(mongoose.models)) {
    const deployed = await model.collection.indexes();
    for (const [key, options] of model.schema.indexes()) {
      if (!deployed.some(index => JSON.stringify(index.key) === JSON.stringify(key) && (!options.unique || index.unique) && (options.expireAfterSeconds === undefined || options.expireAfterSeconds === index.expireAfterSeconds))) throw new Error(`Missing required index for ${model.modelName}; run the reviewed db:indexes command`);
    }
  }
}
await initialize();
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => { console.log(`Business Operations server ready on port ${server.address().port}`); if (process.send) process.send({ port: server.address().port }); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
