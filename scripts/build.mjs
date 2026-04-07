import { rm, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'website');
const outDir = path.join(rootDir, 'dist');

const copyDir = async (from, to) => {
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(fromPath, toPath);
      continue;
    }
    if (entry.isFile()) {
      await copyFile(fromPath, toPath);
    }
  }
};

await rm(outDir, { recursive: true, force: true });
await copyDir(srcDir, outDir);
