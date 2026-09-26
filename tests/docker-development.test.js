import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..');

test('development entrypoint synchronizes dependencies only when the lockfile changes', (t) => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cosoremi-entrypoint-')
  );
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const commandDirectory = path.join(workspace, 'bin');
  const log = path.join(workspace, 'commands.log');
  fs.mkdirSync(commandDirectory);
  fs.mkdirSync(path.join(workspace, 'node_modules'));
  fs.writeFileSync(path.join(workspace, 'package-lock.json'), '{}\n');

  for (const command of ['node', 'npm']) {
    const executable = path.join(commandDirectory, command);
    fs.writeFileSync(
      executable,
      `#!/bin/sh\nprintf '%s %s\\n' '${command}' "$*" >> "$COSOREMI_TEST_LOG"\n`
    );
    fs.chmodSync(executable, 0o755);
  }

  const run = () =>
    spawnSync(
      '/bin/sh',
      [path.join(root, 'docker-entrypoint.sh'), 'npm', 'run', 'dev'],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: {
          ...process.env,
          COSOREMI_TEST_LOG: log,
          NODE_ENV: 'development',
          PATH: `${commandDirectory}:/usr/bin:/bin`,
        },
      }
    );

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Development dependencies changed/);
  assert.match(fs.readFileSync(log, 'utf8'), /npm ci/);
  assert.match(fs.readFileSync(log, 'utf8'), /npm run db:generate/);

  fs.writeFileSync(log, '');
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(second.stdout, /Development dependencies changed/);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /npm ci|db:generate/);
  assert.match(fs.readFileSync(log, 'utf8'), /npm run dev/);
});
