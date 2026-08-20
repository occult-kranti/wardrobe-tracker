/**
 * The one alias table for @almari/shared.
 *
 * Every resolver that needs to find the shared package reads this module:
 * vite.config.ts (resolve.alias), every esbuild call site in scripts/, and
 * scripts/check-alias-parity.mjs, which proves the resolvers still agree.
 * Add an alias here and the parity check carries it everywhere; add one
 * anywhere else and the parity check fails the build.
 *
 * The package root is found by walking upward until packages/shared/aliases.mjs
 * exists, rather than trusting import.meta.url alone. The reason is concrete:
 * vite bundles its config file and inlines this module into it, rewriting
 * import.meta.url to vite.config.ts's own URL at the repo root. The walk
 * arrives at the same directory from either starting point.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARED_PACKAGE = '@almari/shared';

function findPackageRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, 'packages', 'shared');
    if (existsSync(path.join(candidate, 'aliases.mjs'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`@almari/shared: no packages/shared found above ${fileURLToPath(import.meta.url)}`);
    }
    dir = parent;
  }
}

/** Absolute path of the shared package directory. */
export const packageRoot = findPackageRoot();

/** The alias table: package specifier to absolute directory. */
export function sharedAliases() {
  return { [SHARED_PACKAGE]: packageRoot };
}
