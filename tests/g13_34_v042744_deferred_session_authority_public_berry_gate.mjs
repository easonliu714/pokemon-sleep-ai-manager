import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GROUP_BOUND_REVIEW_RUNTIME_VERSION,
  PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
  applyPublicFixedFieldAuthorityToDraft,
  installDeferredReviewAuthority,
  publicFixedFieldsForSpecies,
} from '../assets/js/group-bound-review-session-runtime-v042744.js';

const RELEASE=Object.freeze({
  app_version:'v0.4.27.44',
  app_build:'20260827-v042744-deferred-session-authority-public-berry',
  cache_name:'pokemon-sleep-ai-v0.4.27.44-v042744-deferred-session-authority-public-berry',
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
assert.match(versionAuthority,new RegExp(`app_version:\\s*'${RELEASE.app_version.replaceAll('.','\\.')}'`));
assert.match(versionAuthority,new RegExp(`app_build:\\s*'${RELEASE.app_build}'`));
assert.match(versionAuthority,new RegExp(`cache_name:\\s*'${RELEASE.cache_name.replaceAll('.','\\.')}'`));
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
assert.match(serviceWorker,/\.\/assets\/js\/group-bound-review-session-runtime-v042744\.js/,'v0.4.27.44 runtime must be precached for offline use');

const fixed=publicFixedFieldsForSpecies('小鍛匠');
assert.ok(fixed,'小鍛匠 must have verified public reference fields');
assert.equal(fixed.type,'妖精');
assert.equal(fixed.favorite_berry,'桃桃果','public reference should derive Fairy -> 桃桃果 from canonical type-to-berry master');

const reviewed=applyPublicFixedFieldAuthorityToDraft({
  species:'小鍛匠',
  type:'妖精',
  favorite_berry:'零餘果',
  nickname:'',
});
assert.equal(reviewed.draft.favorite_berry,'零餘果','public relation must not silently rewrite the AI image observation');
assert.equal(reviewed.draft.type,'妖精');
assert.equal(reviewed.changed,false,'review-only validation must not mutate player draft fields');
assert.equal(reviewed.review_required,true);
assert.equal(reviewed.auto_rewrite,false);
assert.equal(reviewed.missing_public_fill,false);
assert.equal(reviewed.warnings.length,1);
assert.equal(reviewed.warnings[0].status,'REVIEW_REQUIRED_TYPE_BERRY_MISMATCH');
assert.equal(reviewed.warnings[0].auto_rewrite,false);
assert.equal(reviewed.warnings[0].evidence_role,'VALIDATION_NOT_IMAGE_EVIDENCE');
assert.match(reviewed.warnings[0].message,/樹果：AI 辨識為「零餘果」；依目前觀察屬性「妖精」的公版關係參考值為「桃桃果」/);
assert.match(reviewed.warnings[0].message,/平台保留 AI 觀察值，不會自動改寫/);
assert.doesNotMatch(reviewed.warnings[0].message,/\{|\}/,'user-facing relation conflict must not be JSON');

const typeMismatch=applyPublicFixedFieldAuthorityToDraft({
  species:'小鍛匠',
  type:'毒',
  favorite_berry:'零餘果',
});
assert.equal(typeMismatch.draft.type,'毒','verified species reference must not overwrite observed type');
assert.equal(typeMismatch.draft.favorite_berry,'零餘果');
assert.equal(typeMismatch.review_required,true);
assert.equal(typeMismatch.warnings.length,1,'berry matches observed Poison type, so only species/type reference conflict should be flagged');
assert.equal(typeMismatch.warnings[0].status,'REVIEW_REQUIRED_SPECIES_TYPE_MISMATCH');
assert.match(typeMismatch.warnings[0].message,/屬性：AI 辨識為「毒」；公版物種資料為「妖精」/);

const missing=applyPublicFixedFieldAuthorityToDraft({species:'小鍛匠',type:'妖精',favorite_berry:''});
assert.equal(missing.draft.favorite_berry,'','public relation must not fill missing image evidence');
assert.equal(missing.review_required,false);

const untouched=applyPublicFixedFieldAuthorityToDraft({species:'信使鳥',favorite_berry:'橙橙果'});
assert.equal(untouched.draft.favorite_berry,'橙橙果','unknown/no-type observation must remain untouched');
assert.equal(untouched.review_required,false);

class FakeScope extends EventTarget {}
const scope=new FakeScope();
scope.setInterval=setInterval;
scope.clearInterval=clearInterval;
scope.UpdateCenterLiveDebug={record(){}};
scope.DebugTrace={record(){}};

const runtime=installDeferredReviewAuthority(scope,{interval_ms:5,max_wait_ms:500});
assert.equal(runtime.version,GROUP_BOUND_REVIEW_RUNTIME_VERSION);
assert.equal(runtime.public_relation_version,PUBLIC_FIXED_FIELD_AUTHORITY_VERSION);
assert.equal(runtime.getState().status,'PENDING_CORE','early import must wait for multicapture core instead of permanently failing');

await sleep(20);
scope.PokemonSleepMultiCaptureConsistency={
  normalizeRevision(revision){
    return {
      species:revision.species||'小鍛匠',
      type:revision.type||'妖精',
      favorite_berry:revision.favorite_berry||'零餘果',
      source_refs:['img-a'],analysis_ids:['analysis-a'],ingredients:[],subskills:[],conflicts:[],conflicted_fields:[],identity_guard_warnings:[],analysis_target_context:null,
    };
  },
  getState(){return {active_group_id:null,groups:[]};},
  selectGroup(){return null;},
};
await sleep(40);
assert.equal(runtime.getState().status,'READY','deferred installer must recover after core becomes available');
assert.equal(runtime.getState().event_guard_installed,true);
assert.ok(scope.PokemonSleepGroupBoundReviewEventGuardV042743,'v0.4.27.43 guard must actually be installed after retry');
assert.ok(scope.PokemonSleepGroupBoundReviewSessionV042743,'v0.4.27.43 session cache must actually be installed after retry');

const normalized=scope.PokemonSleepMultiCaptureConsistency.normalizeRevision({analysis_type:'ai',species:'小鍛匠',type:'妖精',favorite_berry:'零餘果'});
assert.equal(normalized.favorite_berry,'零餘果','wrapped normalizeRevision must preserve exact AI berry observation');
assert.equal(normalized.type,'妖精');
assert.equal(normalized.identity_guard_warnings.length,0,'public relation warning must not masquerade as a rejected identity candidate');

const profileConsistency=fs.readFileSync('assets/js/player-profile-consistency-v042723.js','utf8');
assert.match(profileConsistency,/REVIEW_REQUIRED_TYPE_BERRY_MISMATCH/);
assert.match(profileConsistency,/auto_rewrite:false/);
assert.match(profileConsistency,/VALIDATION_NOT_IMAGE_EVIDENCE/);
assert.match(profileConsistency,/屬性／樹果需要人工覆核/);
assert.match(profileConsistency,/平台不會自動改寫/);
assert.doesNotMatch(profileConsistency,/draft\.favorite_berry=canonicalBerry/,'current player-profile successor must remain review-only');

const legacy=fs.readFileSync('assets/js/v0383-catalog-ocr-review-contract.js','utf8');
assert.match(legacy,/group-bound-review-session-runtime-v042744\.js/);
assert.match(legacy,/full_review_projection_retired_v042744/);
assert.doesNotMatch(legacy,/trace\('full_review_projection_applied'/,'legacy shared-DOM projector must be permanently retired');
const projectionBody=legacy.match(/function applyReviewProjection\(detail\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.doesNotMatch(projectionBody,/querySelector|setTimeout|\.value\s*=/,'retired projector must perform zero delayed DOM writes');

const runtimeSource=fs.readFileSync('assets/js/group-bound-review-session-runtime-v042744.js','utf8');
assert.doesNotMatch(runtimeSource,/new\s+MutationObserver|MutationObserver\s*\(/,'v0.4.27.44 must not add a MutationObserver');
assert.match(runtimeSource,/max_wait_ms=120000/,'deferred installer must remain bounded');
assert.match(runtimeSource,/auto_rewrite:false/,'public relation validation must be review-only');
assert.doesNotMatch(runtimeSource,/draft\.favorite_berry\s*=\s*(?:authoritative|canonical)/,'v0.4.27.44 must not auto-rewrite favorite berry');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.34',
  version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
  release:RELEASE,
  checks:{
    delayed_core_install_recovery:true,
    legacy_shared_dom_projection_retired:true,
    tinkatink_public_reference_berry:'桃桃果',
    ai_wrong_berry_preserved:true,
    human_review_warning:true,
    type_berry_auto_rewrite:false,
    missing_berry_public_fill:false,
    unknown_species_not_silently_rewritten:true,
    runtime_precached:true,
    release_authority_v042744:true,
    no_new_mutation_observer:true,
  },
},null,2));
