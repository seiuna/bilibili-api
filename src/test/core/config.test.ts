import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigManager } from '../../core/config.js';

describe('ConfigManager Profile loading', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'bili-config-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('rejects malformed JSON without overwriting the existing Profile', async () => {
    const file = join(directory, 'malformed.json');
    const original = '{"cookie":"test-only-cookie",';
    await writeFile(file, original, 'utf8');
    const config = new ConfigManager(file);

    await expect(config.load()).rejects.toBeInstanceOf(SyntaxError);
    expect(await readFile(file, 'utf8')).toBe(original);
    expect(config.data.cookie).toBe('');
  });

  it('propagates non-ENOENT read failures without replacing the path', async () => {
    const file = join(directory, 'directory.json');
    await mkdir(file);
    const config = new ConfigManager(file);

    await expect(config.load()).rejects.toThrow();
    expect((await stat(file)).isDirectory()).toBe(true);
  });

  it('still creates defaults for a missing explicit Profile', async () => {
    const file = join(directory, 'missing.json');
    const config = new ConfigManager(file);

    await config.load();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(config.data);
    expect(config.data.cookie).toBe('');
  });

  it('loads an existing valid Profile without rewriting it', async () => {
    const file = join(directory, 'valid.json');
    const original = '{\n  "cookie": "test-only-cookie", "mid": 123\n}\n';
    await writeFile(file, original, 'utf8');
    const config = new ConfigManager(file);

    await config.load();
    expect(config.data.cookie).toBe('test-only-cookie');
    expect(config.data.mid).toBe(123);
    expect(config.data.refreshToken).toBe('');
    expect(await readFile(file, 'utf8')).toBe(original);
  });
});
