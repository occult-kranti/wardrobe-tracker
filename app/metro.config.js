// The monorepo doorway for @almari/shared (Expo SDK 57, docs read 2026-08-19).
//
// The repo root is not an npm workspace — the web app and this app install
// separately by design — so Expo's automatic monorepo detection has nothing
// to key on and the two monorepo settings are declared explicitly.
//
// The shapes are deliberately narrow. watchFolders admits packages/ only,
// not the repo root: the shared package is all the app may reach for, and
// watching the whole root would put the web tree's node_modules under the
// file watcher. nodeModulesPaths stays pinned to app/node_modules alone:
// @almari/shared carries zero runtime dependencies by contract, so nothing
// above app/ should ever satisfy a dependency lookup — a second node_modules
// in the lookup path is how duplicate react copies and "invalid hook call"
// crashes begin (docs/34 §2.8).
//
// Module resolution for '@almari/shared/*' itself rides on tsconfig paths,
// which Expo CLI feeds to Metro by default (tsconfigPaths). The app does not
// import the shared package yet; this wiring is the doorway, kept ready.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoPackages = path.resolve(projectRoot, '..', 'packages');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoPackages];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
