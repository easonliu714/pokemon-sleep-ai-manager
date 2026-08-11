import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STRATEGY_ANALYSIS_PACK_VERSION,
  STRATEGY_ANALYSIS_PROMPT_VERSION,
  STRATEGY_ANALYSIS_SHARING_NOTICE_VERSION,
} from '../assets/js/external-strategy-analysis-pack.js';
import {STRATEGY_ANALYSIS_PRIVACY_VERSION} from '../assets/js/external-strategy-analysis-privacy.js';
import {STRATEGY_ANALYSIS_LOCAL_VERSION} from '../assets/js/external-strategy-analysis-local.js';
import {STRATEGY_ANALYSIS_PACK_UI_VERSION,shareStrategyPromptText} from '../assets/js/war-room-strategy-analysis-pack-ui.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const activeVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const parts=value=>String(value).replace(/^v/,'').split('.').map(Number);
const compare=(left,right)=>{
  const a=parts(left),b=parts(right),length=Math.max(a.length,b.length);
  for(let index=0;index<length;index+=1){const diff=(a[index]||0)-(b[index]||0);if(diff)return Math.sign(diff);}
  return 0;
};
assert.ok(compare(activeVersion,'v0.4.9.1')>=0,`active version ${activeVersion} predates v0.4.9.1`);
if(activeVersion==='v0.4.9.1'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0491-war3-live-closure-semantic-integrity');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.9.1-v0491-war3-live-closure-semantic-integrity');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.9.1'"),'successor must retain v0.4.9.1 legacy parser bridge');
}
assert.ok(version.includes("// app_version: 'v0.4.9'"),'must retain v0.4.9 legacy parser bridge');
assert.ok(version.includes("// app_version: 'v0.4.8.5'"),'must retain v0.4.8.5 legacy parser bridge');

assert.equal(STRATEGY_ANALYSIS_PACK_VERSION,'strategy-analysis-pack-2026-08-10-c');
assert.equal(STRATEGY_ANALYSIS_PROMPT_VERSION,'strategy-analysis-prompt-2026-08-10-c');
assert.equal(STRATEGY_ANALYSIS_SHARING_NOTICE_VERSION,'strategy-analysis-sharing-notice-2026-08-10-a');
assert.equal(STRATEGY_ANALYSIS_PRIVACY_VERSION,'strategy-analysis-privacy-2026-08-10-b');
assert.equal(STRATEGY_ANALYSIS_LOCAL_VERSION,'strategy-analysis-local-2026-08-10-c');
assert.equal(STRATEGY_ANALYSIS_PACK_UI_VERSION,'strategy-analysis-pack-ui-2026-08-10-c');

const pack=read('assets/js/external-strategy-analysis-pack.js');
for(const token of [
  'inventory_parity_status','candidate_reference_closure','unresolved_candidate_reference_count','recipe_resource_parity_status',
  'sharing_notice','TRUSTED_AI_ONLY_NOT_PUBLIC','PRIVATE_GAME_RECORDS','DATA_CONSISTENCY_GAP','REFERENCE_INTEGRITY_GAP',
  '不得僅因 strategy_shortage=0','Resource opportunity-cost analysis','MISSING_RESOURCE','physical_available','raw_shortage',
])assert.ok(pack.includes(token),`v0.4.9.1 behavior missing ${token}`);
assert.equal(pack.includes('current:Number(req.current??req.available??0)'),false,'must not fabricate recipe current=0');

const ui=read('assets/js/war-room-strategy-analysis-pack-ui.js');
for(const token of ['分享提醒','只提供給你信賴的 AI 模型／服務','不建議公開張貼','離線使用','SQLite/WASM','分享 Prompt','shareStrategyPromptText','COPIED_FALLBACK'])assert.ok(ui.includes(token),`v0.4.9.1 UI behavior missing ${token}`);
assert.equal(ui.includes('new File('),false,'share path must not require file sharing');
assert.equal(ui.includes('navigator.canShare'),false,'share path must not depend on file canShare');
assert.equal(ui.includes('applyPayload('),false,'external strategy UI must not contain direct Apply');

let copied='';
const permissionDenied=Object.assign(new Error('Permission denied'),{name:'NotAllowedError'});
const fallback=await shareStrategyPromptText('trusted prompt',{shareFn:async()=>{throw permissionDenied;},writeTextFn:async value=>{copied=value;}});
assert.equal(fallback.status,'COPIED_FALLBACK');assert.equal(copied,'trusted prompt');
let copiedOnAbort=false;
const aborted=await shareStrategyPromptText('prompt',{shareFn:async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});},writeTextFn:async()=>{copiedOnAbort=true;}});
assert.equal(aborted.status,'ABORTED');assert.equal(copiedOnAbort,false);assert.equal((await shareStrategyPromptText('prompt')).status,'UNAVAILABLE');

const local=read('assets/js/external-strategy-analysis-local.js');
for(const token of ['buildUnifiedResourceSnapshot','buildLocalPokemonCandidateScoring','buildLocalTeamOptimization','buildLocalRecipeStrategyProjection','buildLocalRecipeDiscoveryStockpile','assertNoForbiddenKeyPaths'])assert.ok(local.includes(token),`v0.4.9.1 local adapter missing ${token}`);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.9.1 behavior baseline must not require SQLite migration 10');
const sw=read('service-worker.js');assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));assert.ok(sw.includes("url.pathname.endsWith('.js')"),'offline contract remains online-load-once dynamic JS runtime caching');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.9.1_RELEASE_CONTRACT',active_version:activeVersion,minimum_version:'v0.4.9.1',pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,sharing_notice_version:STRATEGY_ANALYSIS_SHARING_NOTICE_VERSION,recipe_semantic_integrity:true,candidate_reference_closure:true,trusted_ai_notice:true,offline_prerequisite_visible:true,android_share_permission_fallback:true,file_share_required:false,direct_apply_path:false,sqlite_migration_added:false},null,2));
