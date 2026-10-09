import { startFixture } from '../tests/helpers.js';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('.cache', { recursive: true });
const fixture = await startFixture();
await writeFile('.cache/browser-url.txt', fixture.base);
console.log(`Synthetic browser fixture ready: ${fixture.base}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.close(); process.exit(0); });
