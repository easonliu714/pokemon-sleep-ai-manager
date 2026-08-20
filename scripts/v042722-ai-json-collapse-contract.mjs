import assert from 'node:assert/strict';
import fs from 'node:fs';

const authority=fs.readFileSync('assets/js/version-authority.js','utf8');
const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');
const source=fs.readFileSync('assets/js/ai-json-collapse-v042722.js','utf8');

assert.match(authority,/app_version:\s*'v0\.4\.27\.22'/);
assert.match(authority,/app_build:\s*'20260820-v042722-collapsed-ai-json'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.22-v042722-collapsed-ai-json'/);
assert.match(runtime,/import '\.\/ai-json-collapse-v042722\.js';/);
assert.match(source,/AI_JSON_COLLAPSE_VERSION='v0\.4\.27\.22-ai-json-collapse-2026-08-20-a'/);
assert.match(source,/details\.open=false/);
assert.match(source,/AI 分析結果 JSON（點擊展開）/);
assert.match(source,/pre\.classList\.contains\('hidden'\)/);
assert.match(source,/MutationObserver/);
assert.match(source,/getElementById\('updates'\)/);
assert.doesNotMatch(source,/pokemon_evolution_master|pokemon_evolution_status_master|INSERT|UPDATE pokemon|DELETE FROM/);

console.log(JSON.stringify({status:'PASS',gate:'V042722_AI_JSON_COLLAPSE',version:'v0.4.27.22',default_open:false,hidden_existing_json_untouched:true,player_data_write:false},null,2));
