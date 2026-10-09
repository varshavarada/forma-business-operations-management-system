import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const template = await readFile('.env.example', 'utf8');
try {
  await writeFile('.env', template.replace('IDEMPOTENCY_SECRET=', `IDEMPOTENCY_SECRET=${randomBytes(32).toString('hex')}`), { flag: 'wx', mode: 0o600 });
  console.log('Private .env created. Edit the database URI and application origin locally. No secret was printed.');
} catch (error) {
  if (error.code === 'EEXIST') { console.error('.env already exists; configuration was not overwritten.'); process.exitCode = 1; }
  else throw error;
}
