import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveBasePotCapacity} from '../assets/js/pot-capacity-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionTuple=value=>{
  const text=String(value||'');
  if(!/^v\d+(?:\.\d+){2,}$/.test(text))return null;
  return text.slice(1).split('.').map(Number);
};
const versionAtLeast=(value,minimum)=>{
  const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;
  const length=Math.max(a.length,b.length);
  for(let i=0;i<length;i++){const left=a[i]||0,right=b[i]||0;if(left!==right)return left>right;}
  return true;
};
const ui=read('assets/js/weekly-context-ui-bridge.js');
const manual=read('assets/js/weekly-context-manual-override.js');
const store=read('assets/js/weekly-context-store.js');
const version=read('assets/js/version-authority.js');

const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(versionAtLeast(appVersion,'v0.4.13.6'),`v0.4.13.6 pot contract requires v0.4.13.6 or successor, got ${appVersion}`);
if(appVersion==='v0.4.13.6'){
  assert.equal(appBuild,'20260812-v04136-pot-manual-authority-alignment');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13.6-v04136-pot-manual-authority-alignment');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.13.6'"),'successor release must retain v0.4.13.6 lineage');
  assert.ok(version.includes("// app_build: '20260812-v04136-pot-manual-authority-alignment'"));
}
assert.ok(version.includes("// app_version: 'v0.4.13.5'"),'release lineage must retain v0.4.13.5');

const accountWins=resolveBasePotCapacity({accountCapacity:60,legacyWeeklyPot:57});
assert.deepEqual(accountWins,{pot_size:60,source:'ACCOUNT_CAPACITY',is_legacy_fallback:false});
const legacyFallback=resolveBasePotCapacity({accountCapacity:null,legacyWeeklyPot:57});
assert.deepEqual(legacyFallback,{pot_size:57,source:'LEGACY_WEEKLY_POT_FALLBACK',is_legacy_fallback:true});

assert.match(store,/Base pot capacity is account-level player state/);
assert.match(store,/row\.pot_size=potAuthority\.pot_size/);

const overrideFields=ui.match(/const weeklyOverrideFields=\[([^\]]+)\]/)?.[1]||'';
assert.ok(overrideFields,'weeklyOverrideFields contract missing');
assert.equal(overrideFields.includes('pot_size'),false,'new weekly UI writes must not route pot_size to weekly manual override');
assert.match(ui,/for\(const field of weeklyOverrideFields\)/);
assert.match(ui,/source==='ACCOUNT_CAPACITY'\?'帳號鍋子容量'/);
assert.match(ui,/source==='LEGACY_WEEKLY_POT_FALLBACK'\?'舊版本週鍋子 fallback'/);
assert.match(ui,/function writeAccountPotCapacity\(/);
assert.match(ui,/INSERT INTO account_capacity\(capacity_key,total_capacity,used_count,updated_at,source\)/);
assert.match(ui,/ON CONFLICT\(capacity_key\) DO UPDATE SET/);
assert.match(ui,/total_capacity=excluded\.total_capacity/);
assert.match(ui,/source=excluded\.source/);
assert.match(ui,/MANUAL_WEEKLY_CONTEXT_UI/);
assert.match(ui,/WEEKLY_CONTEXT_LEGACY_PROMOTION/);
assert.match(ui,/鍋子基礎容量不可清空/);
assert.match(ui,/manualEffects,null,typedValue\('base_notes'/,'manual fallback must not create a new weekly_context.pot_size value');
assert.match(ui,/if\(potEdit\.needsAccountWrite\)writeAccountPotCapacity\(potEdit\.value,potEdit\.source\)/);
assert.match(ui,/if\(\['weekly_context','account_capacity'\]\.includes\(event\.detail\?\.entity\)\)schedule\(\)/);

assert.match(manual,/WEEKLY_MANUAL_OVERRIDE_FIELDS=Object\.freeze\(\[[\s\S]*'pot_size'/,'legacy manual pot field must remain readable for compatibility');
assert.match(ui,/for\(const field of weeklyOverrideFields\)if\(active\.has\(field\)\)/,'new writes must prune pot_size from weekly override payloads');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.13.6_POT_MANUAL_AUTHORITY_ALIGNMENT_SUCCESSOR_AWARE',
  app_version:appVersion,
  nested_hotfix_version_supported:true,
  account_capacity_precedence:true,
  weekly_pot_new_override:false,
  manual_edit_routes_to_account_capacity:true,
  legacy_weekly_pot_read_compatibility:true,
  blank_capacity_rejected:true,
  account_capacity_source_label:true,
},null,2));
