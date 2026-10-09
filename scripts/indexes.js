import mongoose from 'mongoose';
import '../server/models.js';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI');
try {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  // createIndexes adds declared indexes. Never uses syncIndexes (which can drop indexes).
  for (const model of Object.values(mongoose.models)) { await model.createIndexes(); console.log(`${model.modelName}: declared indexes created or already present`); }
} catch (error) {
  console.error(`Index creation failed (${error.name}). Check connection configuration and duplicate unique fields privately.`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
