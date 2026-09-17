/**
 * Publishes the production build (`dist/`) to the `gh-pages` branch so GitHub
 * Pages can serve the game as a static site.
 *
 * Works both locally (`npm run deploy`) and in CI (the deploy workflow calls
 * it with `--skip-build` after running the build itself). Uses git plumbing
 * with a temporary index — no worktrees, no clones — and parents every deploy
 * commit on the previous `gh-pages` head so the branch history stays linear
 * and diffable.
 *
 * Usage:
 *   node tools/publish-gh-pages.mjs                # build + publish
 *   node tools/publish-gh-pages.mjs --skip-build   # publish existing dist/
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_BUILD = process.argv.includes('--skip-build');
const BRANCH = 'gh-pages';

/** Runs `git` in the repo root and returns trimmed stdout. */
function git(args, { env = {}, check = true } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (check) {
      console.error(`✗ git ${args.join(' ')} failed:\n${error.stderr ?? error.message}`);
      process.exit(1);
    }
    return null;
  }
}

const run = (cmd, options = {}) =>
  execFileSync(cmd, options.args ?? [], { cwd: ROOT, stdio: options.stdio ?? 'inherit' });

/* ---------------------------------------------------------------- build --- */

if (!SKIP_BUILD) {
  console.log('▶ Building production bundle…');
  run(process.execPath, {
    args: [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  });
}

const indexHtml = path.join(ROOT, 'dist', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('✗ dist/index.html not found — run a build first (npm run build).');
  process.exit(1);
}

/* ------------------------------------------------------------ git state --- */

const remoteUrl = git(['config', '--get', 'remote.origin.url']);
if (!remoteUrl) {
  console.error('✗ No `origin` remote configured — cannot publish.');
  process.exit(1);
}

// Where the site will live (standard project-pages URL; ignores custom domains).
const [, ownerRepo] = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/) ?? [];
const pagesUrl = ownerRepo
  ? `https://${ownerRepo.split('/')[0]}.github.io/${ownerRepo.split('/')[1]}/`
  : null;

console.log('▶ Looking up the current gh-pages head…');
// `git ls-remote` needs no fetch / remote-tracking refspec, so the parent
// lookup works on single-branch CI checkouts and fresh clones alike.
const lsRemote = git(['ls-remote', 'origin', `refs/heads/${BRANCH}`], { check: false });
const parent = lsRemote ? lsRemote.split(/\s+/)[0] : null;

if (parent) {
  // Shallow CI checkouts only contain `main` objects, and `git commit-tree -p`
  // needs the parent commit locally — pull the branch's objects into
  // FETCH_HEAD (an explicit ref, so no remote-tracking refspec is required).
  git(['fetch', '--no-tags', 'origin', BRANCH]);
}
const sourceSha = git(['rev-parse', '--short=9', 'HEAD']);

const dirty = git(['status', '--porcelain'], { check: false });
if (dirty) {
  console.warn(
    '⚠ Working tree has uncommitted changes — the published build may not match any commit.',
  );
}

/* --------------------------------------------------- commit the bundle --- */

// Build a tree whose root is `dist/` using a throwaway index:
//   add dist/** to a temp index, then `write-tree --prefix=dist/` lifts the
//   subtree out as the root — no prefix ends up in the published branch.
const tempIndex = path.join(os.tmpdir(), `monkey-mayhem-ghpages-${process.pid}`);
fs.rmSync(tempIndex, { force: true });
const indexEnv = { GIT_INDEX_FILE: tempIndex };
git(['read-tree', '--empty'], { env: indexEnv });
git(['add', '--force', '-A', '--', 'dist'], { env: indexEnv });
const tree = git(['write-tree', '--prefix=dist/'], { env: indexEnv });
fs.rmSync(tempIndex, { force: true });

// CI commits as the workflow bot; local commits use the repo's own identity.
const isCI = process.env.GITHUB_ACTIONS === 'true';
const authorName = isCI ? 'github-actions[bot]' : 'Monkey Mayhem Deploy';
const authorEmail = isCI
  ? '41898282+github-actions[bot]@users.noreply.github.com'
  : 'deploy@monkey-mayhem.local';
const identityEnv = {
  GIT_AUTHOR_NAME: authorName,
  GIT_AUTHOR_EMAIL: authorEmail,
  GIT_COMMITTER_NAME: authorName,
  GIT_COMMITTER_EMAIL: authorEmail,
};

const message = [
  `Deploy ${sourceSha} to GitHub Pages`,
  '',
  `Built from source commit ${sourceSha} of main's deploy pipeline.`,
  parent ? `Previous deploy: ${parent.slice(0, 9)}` : 'First deploy — fresh gh-pages history.',
].join('\n');

const commitArgs = ['commit-tree', tree, '-m', message];
if (parent) commitArgs.push('-p', parent);
const commit = git(commitArgs, { env: identityEnv });

/* --------------------------------------------------------------- push ---- */

console.log(`▶ Pushing ${commit.slice(0, 9)} to ${BRANCH}…`);
// With a known parent this is a normal fast-forward guarded by a lease that
// refuses to stomp a deploy pushed after our ls-remote. Without one (first
// deploy, or a deliberately reset history) the branch is machine-managed, so
// a plain force push is the correct move.
const lease = parent ? `--force-with-lease=refs/heads/${BRANCH}:${parent}` : '--force';
git(['push', lease, 'origin', `${commit}:refs/heads/${BRANCH}`]);

console.log(
  `\n✓ Published dist/ (source ${sourceSha}) to the ${BRANCH} branch.` +
    (pagesUrl ? `\n  Once Pages is enabled for the repo, the game lives at ${pagesUrl}` : ''),
);
