import { mkdir } from 'node:fs/promises';
import { startFixture } from '../tests/helpers.js';
await mkdir('.cache', { recursive: true });
const fixture = await startFixture();
console.log(`Synthetic demo: ${fixture.base}`);
console.log('Accounts: administrator@example.test, manager@example.test, staff@example.test');
console.log('Synthetic password: SyntheticPass123!');
console.log('Data is isolated and temporary. This is not your production database.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.close(); process.exit(0); });
