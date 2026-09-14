import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const canonical = path.resolve(root, '..', 'battle-bros-contracts', 'schemas');
const local = path.join(root, 'schemas');
const sync = process.argv.includes('--sync');
const names = (await readdir(canonical)).filter(name => name.endsWith('.schema.json')).sort();
let drift = false;

await mkdir(local, { recursive: true });
for (const name of names) {
  const source = await readFile(path.join(canonical, name));
  let target = null;
  try { target = await readFile(path.join(local, name)); } catch (_) {}
  if (target && source.equals(target)) continue;
  drift = true;
  if (sync) {
    await writeFile(path.join(local, name), source);
    console.log(`synced ${name}`);
  } else {
    console.error(`schema drift: ${name}`);
  }
}

if (drift && !sync) process.exitCode = 1;
if (!drift) console.log('schemas: frontend copies match battle-bros-contracts');

