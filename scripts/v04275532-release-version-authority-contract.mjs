import fs from 'node:fs';
import assert from 'node:assert/strict';

const authority = fs.readFileSync(new URL('../assets/js/version-authority.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

// Governed release lineage. Keep this table exact: no prefix/fuzzy successor admission.
const releases = Object.freeze([
  Object.freeze({
    version: 'v0.4.27.55.3.2',
    build: '20260903-v04275532-page-aware-static-shell',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.2-v04275532-page-aware-static-shell',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3',
    build: '20260904-v04275533-page-hydration-authority',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.1',
    build: '20260905-v042755331-page-prewarm-collapsible-hydration',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.2',
    build: '20260906-v042755332-ai-key-update-status-knowledge-host',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.2-v042755332-ai-key-update-status-knowledge-host',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.3',
    build: '20260907-v042755333-candy-master-progressive-render',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.3-v042755333-candy-master-progressive-render',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.4',
    build: '20260908-v042755334-page-status-visibility-watchdog',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.4-v042755334-page-status-visibility-watchdog',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.5',
    build: '20260908-v042755335-g121a-authority-closure',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.5-v042755335-g121a-authority-closure',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.6',
    build: '20260910-v042755336-g121d-evolution-recommendation-ui',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.6-v042755336-g121d-evolution-recommendation-ui',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.7',
    build: '20260911-v042755337-g121d-real-device-closure',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.7-v042755337-g121d-real-device-closure',
  }),
  Object.freeze({
    version: 'v0.4.27.55.3.3.8',
    build: '20260913-v042755338-g121-authority-parity-real-device-closure',
    cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.8-v042755338-g121-authority-parity-real-device-closure',
  }),
]);

const live = authority.match(/const authority = Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1] || '';
const liveVersion = live.match(/app_version:\s*'([^']+)'/)?.[1] || '';
const liveIndex = releases.findIndex(row => row.version === liveVersion);
assert.ok(liveIndex >= 0, `live authority must be an exact governed release from ${releases[0].version} through ${releases.at(-1).version}`);

const current = releases[liveIndex];
assert.ok(live.includes(`app_build: '${current.build}'`), `live ${current.version} build mismatch`);
assert.ok(live.includes(`cache_name: '${current.cache}'`), `live ${current.version} cache mismatch`);

// Every governed predecessor must remain as a non-executable parser/lineage bridge.
for (const predecessor of releases.slice(0, liveIndex).reverse()) {
  assert.ok(
    authority.includes(`// app_version: '${predecessor.version}'`),
    `${predecessor.version} predecessor bridge must remain present`,
  );
}

// A future version is never admitted by prefix or ordering alone: it must be added above with exact build/cache.
assert.equal(releases.filter(row => row.version === liveVersion).length, 1, 'live version must map to exactly one governed release tuple');
assert.match(sw, /importScripts\('\.\/assets\/js\/version-authority\.js'\)/, 'service worker must consume the central live version authority');
assert.match(sw, /const \{app_version:APP_VERSION,app_build:APP_BUILD,cache_name:CACHE\}=self\.PokemonSleepVersionAuthority;/, 'service worker version/cache identity must be derived from the central authority');

console.log(JSON.stringify({
  gate: 'V04275532_RELEASE_VERSION_AUTHORITY',
  status: 'PASS',
  live_version: current.version,
  live_build: current.build,
  live_cache: current.cache,
  governed_release_count: releases.length,
  predecessor_bridge_count: liveIndex,
  exact_tuple_required: true,
  fuzzy_successor_admission: false,
}, null, 2));
