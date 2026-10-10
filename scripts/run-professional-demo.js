import { startProfessionalDemo } from './professional-demo.js';

const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--reference-date='))) throw new Error('Usage: npm run demo:professional -- --reference-date=YYYY-MM-DD');
const controller = new AbortController();
let fixture;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { controller.abort(); if (fixture) await fixture.close(); });
try {
  fixture = await startProfessionalDemo({ referenceDate: args.find(arg => arg.startsWith('--reference-date='))?.split('=')[1], signal: controller.signal, onProgress: console.log });
  console.log(`Professional fictional demo: ${fixture.base}`);
  console.log(`Reference date: ${fixture.plan.referenceDate}; seed: ${fixture.plan.seed}; currency: INR`);
  console.log('Sign in: administrator@example.test / SyntheticPass123! (temporary synthetic account)');
  console.log(JSON.stringify(fixture.verification, null, 2));
  console.log('Use Monthly / Six months, ending at the reference month. Ctrl+C closes and removes the temporary database.');
} catch (error) { console.error(error.message); process.exitCode = controller.signal.aborted ? 0 : 1; }
