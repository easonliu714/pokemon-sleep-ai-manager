import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GROUP_BOUND_REVIEW_RUNTIME_VERSION,
  PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
  applyPublicFixedFieldAuthorityToDraft,
  installDeferredReviewAuthority,
  publicFixedFieldsForSpecies,
} from '../assets/js/group-bound-review-session-runtime-v042744.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const fixed=publicFixedFieldsForSpecies('小鍛匠');
assert.ok(fixed,'小鍛匠 must have verified public fixed fields');
assert.equal(fixed.type,'妖精');
assert.equal(fixed.favorite_berry,'桃桃果');

const corrected=applyPublicFixedFieldAuthorityToDraft({
  species:'小鍛匠',
  type:'妖精',
  favorite_berry:'零餘果',
  nickname:'',
});
assert.equal(corrected.draft.favorite_berry,'桃桃果','AI berry contradiction must not enter authoritative review draft');
assert.equal(corrected.draft.type,'妖精');
assert.equal(corrected.warnings.length,1);
assert.match(corrected.warnings[0].message,/樹果：AI 辨識為「零餘果」；公版固定資料為「桃桃果」/);
assert.doesNotMatch(corrected.warnings[0].message,/\{|\}/,'user-facing fixed-field conflict must not be JSON');
assert.equal(corrected.draft.identity_guard_warnings.length,1);

const untouched=applyPublicFixedFieldAuthorityToDraft({species:'信使鳥',favorite_berry:'橙橙果'});
assert.equal(untouched.draft.favorite_berry,'橙橙果','unverified species must not be silently rewritten');
assert.equal(untouched.changed,false);

class FakeScope extends EventTarget {}
const scope=new FakeScope();
scope.setInterval=setInterval;
scope.clearInterval=clearInterval;
scope.UpdateCenterLiveDebug={record(){}};
scope.DebugTrace={record(){}};

const runtime=installDeferredReviewAuthority(scope,{interval_ms:5,max_wait_ms:500});
assert.equal(runtime.version,GROUP_BOUND_REVIEW_RUNTIME_VERSION);
assert.equal(runtime.fixed_field_version,PUBLIC_FIXED_FIELD_AUTHORITY_VERSION);
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

const normalized=scope.PokemonSleepMultiCaptureConsistency.normalizeRevision({analysis_type:'ai',species:'小鍛匠',favorite_berry:'零餘果'});
assert.equal(normalized.favorite_berry,'桃桃果');
assert.equal(normalized.identity_guard_warnings.length,1);
assert.match(normalized.identity_guard_warnings[0].message,/零餘果.*桃桃果/);

const legacy=fs.readFileSync('assets/js/v0383-catalog-ocr-review-contract.js','utf8');
assert.match(legacy,/group-bound-review-session-runtime-v042744\.js/);
assert.match(legacy,/full_review_projection_retired_v042744/);
assert.doesNotMatch(legacy,/trace\('full_review_projection_applied'/,'legacy shared-DOM projector must be permanently retired');
const projectionBody=legacy.match(/function applyReviewProjection\(detail\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.doesNotMatch(projectionBody,/querySelector|setTimeout|\.value\s*=/,'retired projector must perform zero delayed DOM writes');

const runtimeSource=fs.readFileSync('assets/js/group-bound-review-session-runtime-v042744.js','utf8');
assert.doesNotMatch(runtimeSource,/new\s+MutationObserver|MutationObserver\s*\(/,'v0.4.27.44 must not add a MutationObserver');
assert.match(runtimeSource,/max_wait_ms=120000/,'deferred installer must remain bounded');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.34',
  version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
  checks:{
    delayed_core_install_recovery:true,
    legacy_shared_dom_projection_retired:true,
    tinkatink_public_berry_authority:'桃桃果',
    ai_wrong_berry_preserved_as_human_warning:true,
    unknown_species_not_silently_rewritten:true,
    no_new_mutation_observer:true,
  },
},null,2));
