import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  REVIEW_REFERENCE_HISTORY_UX_VERSION,
  IMPORT_HISTORY_EXPORT_SCHEMA,
  resolvePublicBerryReference,
  berryReferenceHumanMessage,
  berryReferenceApplyPolicy,
  evolutionRequirementSemantic,
  buildImportHistoryExport,
} from '../assets/js/review-reference-history-ux-v042745.js';

const RELEASE=Object.freeze({
  app_version:'v0.4.27.45',
  app_build:'20260827-v042745-public-reference-evolution-history-ux',
  cache_name:'pokemon-sleep-ai-v0.4.27.45-v042745-public-reference-evolution-history-ux',
});

assert.match(REVIEW_REFERENCE_HISTORY_UX_VERSION,/v0\.4\.27\.45/);
assert.equal(IMPORT_HISTORY_EXPORT_SCHEMA,'pokemon-sleep-import-history-export/1.0');

const blankBerry=resolvePublicBerryReference({species:'小鍛匠',observed_type:'妖精',observed_berry:''});
assert.equal(blankBerry.status,'AI_BLANK_PUBLIC_REFERENCE_AVAILABLE');
assert.equal(blankBerry.reference_berry,'桃桃果');
assert.equal(blankBerry.auto_write,false);
assert.equal(blankBerry.evidence_role,'REFERENCE_NOT_IMAGE_EVIDENCE');
assert.match(berryReferenceHumanMessage(blankBerry),/AI 未辨識樹果/);
assert.match(berryReferenceHumanMessage(blankBerry),/參考值為「桃桃果」/);
assert.match(berryReferenceHumanMessage(blankBerry),/儲存人工修改/);
assert.equal(berryReferenceApplyPolicy(blankBerry).allowed,false,'blank AI berry with a public reference must require manual confirmation before Apply');

const speciesFallback=resolvePublicBerryReference({
  species:'小鍛匠',observed_type:'',observed_berry:'',species_reference:{type:'妖精',favorite_berry:'桃桃果'},
});
assert.equal(speciesFallback.reference_type,'妖精');
assert.equal(speciesFallback.reference_type_basis,'VERIFIED_SPECIES_REFERENCE');
assert.equal(speciesFallback.reference_berry,'桃桃果');
assert.equal(speciesFallback.status,'AI_BLANK_PUBLIC_REFERENCE_AVAILABLE');
assert.equal(berryReferenceApplyPolicy(speciesFallback).allowed,false);

const wrongTypeBlankBerry=resolvePublicBerryReference({
  species:'小鍛匠',observed_type:'毒',observed_berry:'',species_reference:{type:'妖精',favorite_berry:'桃桃果'},
});
assert.equal(wrongTypeBlankBerry.status,'AI_BLANK_PUBLIC_SPECIES_REFERENCE_AVAILABLE');
assert.equal(wrongTypeBlankBerry.observed_type,'毒');
assert.equal(wrongTypeBlankBerry.reference_type,'妖精','verified species type must drive public reference when AI type conflicts');
assert.equal(wrongTypeBlankBerry.reference_berry,'桃桃果');
assert.equal(wrongTypeBlankBerry.type_reference_conflict,true);
assert.match(berryReferenceHumanMessage(wrongTypeBlankBerry),/目前觀察屬性「毒」與公版物種屬性不同/);
assert.match(berryReferenceHumanMessage(wrongTypeBlankBerry),/公版物種屬性「妖精」/);
assert.equal(berryReferenceApplyPolicy(wrongTypeBlankBerry).allowed,false);

const conflict=resolvePublicBerryReference({species:'小鍛匠',observed_type:'妖精',observed_berry:'零餘果'});
assert.equal(conflict.status,'REVIEW_REQUIRED_BERRY_PUBLIC_RELATION_MISMATCH');
assert.equal(conflict.review_required,true);
assert.equal(conflict.observed_berry,'零餘果');
assert.equal(conflict.reference_berry,'桃桃果');
const conflictText=berryReferenceHumanMessage(conflict);
assert.match(conflictText,/目前欄位為「零餘果」/);
assert.match(conflictText,/參考值為「桃桃果」/);
assert.match(conflictText,/不會自動改寫/);
assert.doesNotMatch(conflictText,/\{|\}/,'berry conflict UX must be human-readable, not JSON');
assert.equal(berryReferenceApplyPolicy(conflict).allowed,false);

const doubleWrong=resolvePublicBerryReference({species:'小鍛匠',observed_type:'毒',observed_berry:'零餘果',species_reference:{type:'妖精',favorite_berry:'桃桃果'}});
assert.equal(doubleWrong.status,'REVIEW_REQUIRED_BERRY_PUBLIC_RELATION_MISMATCH');
assert.equal(doubleWrong.reference_type,'妖精');
assert.equal(doubleWrong.reference_berry,'桃桃果');
assert.equal(doubleWrong.observed_berry,'零餘果');
assert.match(berryReferenceHumanMessage(doubleWrong),/公版物種屬性「妖精」/);
assert.equal(berryReferenceApplyPolicy(doubleWrong).allowed,false);

const alias=resolvePublicBerryReference({observed_type:'電',observed_berry:'葡萄果'});
assert.equal(alias.canonical_observed_berry,'萄葡果');
assert.equal(alias.reference_berry,'萄葡果');
assert.equal(alias.status,'PUBLIC_RELATION_MATCH_ALIAS_NORMALIZED');
assert.match(berryReferenceHumanMessage(alias),/正名為「萄葡果」/);
assert.equal(berryReferenceApplyPolicy(alias).allowed,false,'legacy alias must be manually saved as canonical public name before Apply');

const exact=resolvePublicBerryReference({observed_type:'妖精',observed_berry:'桃桃果'});
assert.equal(exact.status,'PUBLIC_RELATION_MATCH');
assert.equal(berryReferenceApplyPolicy(exact).allowed,true,'canonical matching berry may proceed');

const noReference=resolvePublicBerryReference({species:'未知物種',observed_type:'',observed_berry:''});
assert.equal(noReference.status,'NO_PUBLIC_REFERENCE');
assert.equal(berryReferenceApplyPolicy(noReference).allowed,true,'lack of public evidence must not invent a blocking requirement');

const notRequired=evolutionRequirementSemantic({authority_status:'MASTER_HYDRATED',public_requirement_state:'VERIFIED_NOT_REQUIRED',current_value:''});
assert.equal(notRequired.kind,'NOT_REQUIRED');
assert.equal(notRequired.label,'不需要');
assert.match(notRequired.detail,/公版已驗證/);
const notRequiredConflict=evolutionRequirementSemantic({authority_status:'MASTER_HYDRATED',public_requirement_state:'VERIFIED_NOT_REQUIRED',current_value:'王者之證'});
assert.equal(notRequiredConflict.kind,'NOT_REQUIRED_CONFLICT');
assert.equal(notRequiredConflict.label,'不需要');
assert.match(notRequiredConflict.detail,/目前欄位為「王者之證」/);
const terminal=evolutionRequirementSemantic({authority_status:'VERIFIED_TERMINAL_CURRENT_SLEEP'});
assert.equal(terminal.kind,'TERMINAL');
assert.equal(terminal.label,'已完全進化');
assert.match(terminal.detail,/已沒有下一階進化/);

const queries=[];
const fakeRows=(sql,params=[])=>{
  queries.push({sql,params});
  if(sql.startsWith('SELECT * FROM import_batches'))return [
    {update_id:'u2',schema_version:'1.1',generated_at:'2026-08-27T02:00:00Z',imported_at:'2026-08-27T02:01:00Z',source:'ai',operation_count:1,result_json:'{"ok":true}'},
    {update_id:'u1',schema_version:'1.1',generated_at:'2026-08-27T01:00:00Z',imported_at:'2026-08-27T01:01:00Z',source:'manual',operation_count:1,result_json:'{"ok":true}'},
  ];
  if(sql.startsWith('SELECT * FROM import_changes')&&params[0]==='u2')return [
    {id:2,operation_index:0,entity:'pokemon',action:'upsert',key_json:'{"pokemon_id":"p2"}',before_json:null,after_json:'{"level":20}',status:'applied',message:'ok'},
  ];
  if(sql.startsWith('SELECT * FROM import_changes')&&params[0]==='u1')return [
    {id:1,operation_index:0,entity:'ingredients',action:'upsert',key_json:'{"ingredient_name":"特選蘋果"}',before_json:'{"quantity":1}',after_json:'{"quantity":2}',status:'applied',message:'ok'},
  ];
  return [];
};
const history=buildImportHistoryExport(fakeRows,{exported_at:'2026-08-27T08:00:00Z'});
assert.equal(history.schema,IMPORT_HISTORY_EXPORT_SCHEMA);
assert.equal(history.batch_count,2);
assert.equal(history.change_count,2);
assert.deepEqual(history.batches[0].result,{ok:true});
assert.deepEqual(history.batches[0].changes[0].key,{pokemon_id:'p2'});
assert.equal(queries[0].sql,'SELECT * FROM import_batches ORDER BY imported_at DESC','export must include complete import history, not visible LIMIT 100 only');

const source=fs.readFileSync('assets/js/review-reference-history-ux-v042745.js','utf8');
const uiGuard=fs.readFileSync('assets/js/update-center-ui-guard.js','utf8');
const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const evolutionAuthority=fs.readFileSync('assets/js/analysis-confirmation-evolution-authority.js','utf8');
const appSource=fs.readFileSync('assets/js/app.js','utf8');
const pageHydrationSource=fs.readFileSync('assets/js/page-hydration-authority-v04275533.js','utf8');
const runner=fs.readFileSync('scripts/ci-g13-ocr-ai-regression.mjs','utf8');

assert.match(versionAuthority,/app_version: 'v0\.4\.27\.45'/);
assert.match(versionAuthority,/20260827-v042745-public-reference-evolution-history-ux/);
assert.match(versionAuthority,/pokemon-sleep-ai-v0\.4\.27\.45-v042745-public-reference-evolution-history-ux/);
assert.match(versionAuthority,/app_version: 'v0\.4\.27\.44'/,'v0.4.27.44 predecessor marker must remain');
assert.match(uiGuard,/import '\.\/review-reference-history-ux-v042745\.js';/,'existing Bootstrap probe must load v0.4.27.45 successor');
assert.match(serviceWorker,/\.\/assets\/js\/update-center-ui-guard\.js/,'parent module must remain explicitly precached');
assert.match(serviceWorker,/const isScript=.*endsWith\('\.js'\)/,'all same-origin JS modules must use script network-first path');
assert.match(serviceWorker,/caches\.open\(CACHE\)\.then\(cache=>cache\.put\(event\.request,copy\)\)/,'successfully fetched successor JS must be cached for later offline use');
assert.doesNotMatch(source,/MutationObserver\s*\(/,'v0.4.27.45 must not add MutationObserver');
assert.doesNotMatch(source,/berryInput\.value\s*=/,'public berry reference must never auto-write the visible observation');
assert.match(source,/data-v042745-berry-reference/);
assert.match(source,/publicBerryNamesV042745/,'berry field must receive governed public name candidates');
assert.match(source,/v042745_public_berry_apply_blocked/,'unconfirmed public berry reference must have an explicit Apply fail-closed trace');
assert.match(source,/addEventListener\('click',blockUnconfirmedBerryApply,true\)/,'public berry Apply guard must run in capture phase');
assert.match(source,/details\.open=false/,'import history must default to collapsed');
assert.match(source,/exportImportHistoryJsonBtnV042745/,'import history JSON export control must exist');
assert.match(source,/SELECT \* FROM import_batches ORDER BY imported_at DESC/,'history export must query complete batch history');
assert.doesNotMatch(source,/SELECT \* FROM import_batches ORDER BY imported_at DESC LIMIT 100/,'export must not inherit the visible-table 100-row cap');
assert.ok(/SELECT \* FROM import_batches ORDER BY imported_at DESC LIMIT 100/.test(appSource)||/SELECT \* FROM import_batches ORDER BY imported_at DESC LIMIT 100/.test(pageHydrationSource),'visible table may remain bounded for mobile rendering; page-aware successors may own this query outside startup app refresh');
assert.match(evolutionAuthority,/VERIFIED_NOT_REQUIRED/);
assert.match(evolutionAuthority,/VERIFIED_TERMINAL_CURRENT_SLEEP/);
assert.match(source,/已完全進化/);
assert.match(source,/不需要/);
assert.match(runner,/tests\/g13_35_v042745_reference_evolution_history_gate\.mjs/,'G13.35 must be part of consolidated regression');
assert.match(runner,/g13-ocr-ai-regression-2026-08-27-v042745-public-reference-evolution-history-ux/);
assert.match(runner,/g13-ocr-ai-regression-2026-08-27-v042744-deferred-session-authority-public-berry/,'v0.4.27.44 predecessor runner marker must remain');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.35',
  version:REVIEW_REFERENCE_HISTORY_UX_VERSION,
  release:RELEASE,
  checks:{
    ai_blank_berry_public_reference:true,
    verified_species_type_reference_precedence:true,
    berry_conflict_human_reference:true,
    berry_public_name_candidates:true,
    public_reference_auto_write:false,
    unconfirmed_public_berry_apply_blocked:true,
    canonical_matching_berry_apply_allowed:true,
    evolution_not_required_semantic:true,
    evolution_terminal_semantic:true,
    import_history_default_collapsed:true,
    import_history_full_json_export:true,
    visible_history_mobile_limit_preserved:true,
    successor_script_runtime_cached:true,
    predecessor_v042744_preserved:true,
    no_new_mutation_observer:true,
  },
},null,2));
