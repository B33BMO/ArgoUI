/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPathWithinDirectory } from '../../../src/process/extensions/sandbox/pathSafety';

describe('extensions/pathSafety', () => {
  let tempDir = '';
  let root = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aionui-path-safety-'));
    root = path.join(tempDir, 'safe-root');
    await fs.mkdir(root, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns true when the target path equals the base directory', () => {
    expect(isPathWithinDirectory(root, root)).toBe(true);
  });

  it('returns true when the target path is inside the base directory', () => {
    const child = path.join(root, 'nested', 'file.txt');
    expect(isPathWithinDirectory(child, root)).toBe(true);
  });

  it('blocks prefix-spoofing paths (safe-root vs safe-root-evil)', () => {
    const prefixAttackPath = path.resolve('tmp', 'extensions', 'safe-root-evil', 'payload.txt');
    expect(isPathWithinDirectory(prefixAttackPath, root)).toBe(false);
  });

  it('returns false when the target path escapes the base directory', () => {
    const escapedPath = path.resolve(root, '..', 'outside.txt');
    expect(isPathWithinDirectory(escapedPath, root)).toBe(false);
  });

  it('rejects paths that escape the base directory through a directory symlink', async () => {
    const outsideDir = path.join(tempDir, 'outside');
    const outsideFile = path.join(outsideDir, 'secret.txt');
    const symlinkDir = path.join(root, 'linked');

    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(outsideFile, 'secret', 'utf-8');
    await fs.symlink(outsideDir, symlinkDir, 'dir');

    expect(isPathWithinDirectory(path.join(symlinkDir, 'secret.txt'), root)).toBe(false);
  });

  it('allows new file paths inside the base directory that do not yet exist', () => {
    const futureFile = path.join(root, 'new-dir', 'new-file.txt');
    expect(isPathWithinDirectory(futureFile, root)).toBe(true);
  });
});
