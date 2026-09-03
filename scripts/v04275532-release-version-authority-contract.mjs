import fs from 'node:fs';
import assert from 'node:assert/strict';

const authority = fs.readFileSync(new URL('../assets/js/version-authority.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

const expected = Object.freeze({
  version: 'v0.4.27.55.3.2',
  build: '20260903-v04275532-page-aware-static-shell',
  cache: 'pokemon-sleep-ai-v0.4.27.55.3.2-v04275532-page-aware-static-shell',
});

assert.match(authority, new RegExp(`app_version:\\s*'${expected.version.replaceAll('.', '\\.')}'`), 'live app_version authority must publish v0.4.27.55.3.2');
assert.match(authority, new RegExp(`app_build:\\s*'${expected.build}'`), 'live app_build authority must publish the .55.3.2 build');
assert.match(authority, new RegExp(`cache_name:\\s*'${expected.cache.replaceAll('.', '\\.')}'`), 'live cache authority must rotate for .55.3.2');
assert.match(sw, /importScripts\('\.\/assets\/js\/version-authority\.js'\)/, 'service worker must consume the central live version authority');
assert.match(sw, /const \{app_version:APP_VERSION,app_build:APP_BUILD,cache_name:CACHE\}=self\.PokemonSleepVersionAuthority;/, 'service worker version/cache identity must be derived from the central authority');

console.log('v0.4.27.55.3.2 release version authority contract: PASS');
