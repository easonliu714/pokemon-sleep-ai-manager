import fs from 'node:fs';
import assert from 'node:assert/strict';

const authority = fs.readFileSync(new URL('../assets/js/version-authority.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

const predecessor = Object.freeze({
  version: 'v0.4.27.55.3.2',
  build: '20260903-v04275532-page-aware-static-shell',
  cache: 'pokemon-sleep-ai-v0.4.27.55.3.2-v04275532-page-aware-static-shell',
});
const successor = Object.freeze({
  version: 'v0.4.27.55.3.3',
  build: '20260904-v04275533-page-hydration-authority',
  cache: 'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority',
});
const successor331 = Object.freeze({
  version: 'v0.4.27.55.3.3.1',
  build: '20260905-v042755331-page-prewarm-collapsible-hydration',
  cache: 'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration',
});

const live = authority.match(/const authority = Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1] || '';
assert.ok(live.includes(`app_version: '${successor331.version}'`) || live.includes(`app_version: '${successor.version}'`) || live.includes(`app_version: '${predecessor.version}'`), 'live authority must be .55.3.2, .55.3.3, or governed .55.3.3.1 successor');
if(live.includes(`app_version: '${successor331.version}'`)){
  assert.ok(live.includes(`app_build: '${successor331.build}'`), 'live .55.3.3.1 build mismatch');
  assert.ok(live.includes(`cache_name: '${successor331.cache}'`), 'live .55.3.3.1 cache mismatch');
  assert.ok(authority.includes(`// app_version: '${successor.version}'`), '.55.3.3 predecessor bridge must remain present');
  assert.ok(authority.includes(`// app_version: '${predecessor.version}'`), '.55.3.2 predecessor bridge must remain present');
}else if(live.includes(`app_version: '${successor.version}'`)){
  assert.ok(live.includes(`app_build: '${successor.build}'`), 'live .55.3.3 build mismatch');
  assert.ok(live.includes(`cache_name: '${successor.cache}'`), 'live .55.3.3 cache mismatch');
  assert.ok(authority.includes(`// app_version: '${predecessor.version}'`), '.55.3.2 predecessor bridge must remain present');
}else{
  assert.ok(live.includes(`app_build: '${predecessor.build}'`), 'live .55.3.2 build mismatch');
  assert.ok(live.includes(`cache_name: '${predecessor.cache}'`), 'live .55.3.2 cache mismatch');
}
assert.match(sw, /importScripts\('\.\/assets\/js\/version-authority\.js'\)/, 'service worker must consume the central live version authority');
assert.match(sw, /const \{app_version:APP_VERSION,app_build:APP_BUILD,cache_name:CACHE\}=self\.PokemonSleepVersionAuthority;/, 'service worker version/cache identity must be derived from the central authority');

console.log('v0.4.27.55.3.2 predecessor / .55.3.3 / .55.3.3.1 successor release authority contract: PASS');
