import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPokemonScreenshotRatingPreview,renderPokemonScreenshotRatingPreviewHtml} from '../assets/js/pokemon-provisional-review-preview.js';
import {POKEMON_PROVISIONAL_RATING_RULE_VERSION} from '../assets/js/pokemon-provisional-rating.js';

const slots=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵']
  .map((subskill_name,i)=>({unlock_level:[10,25,50,70,80][i],subskill_name}));
const draft={species:'fixture',specialty:'樹果',nature:'固執',nature_bonus:'幫忙速度',
  nature_penalty:'食材機率',level:20,subskills:slots,ingredients:[],identity_guard_warnings:[]};
const profile={species:draft.species,specialty:draft.specialty,nature:draft.nature,level:draft.level};
const conf={species:0.99,specialty:0.98,nature:0.97,level:0.99,subskills:0.96};
const observation={profile,subskills:slots,evidence:{source_image_refs:['private-image-ref'],
  field_confidence:conf,field_conflicts:{},unreadable_fields:[]}};
const revision={analysis_type:'ai',source_image_ref:'private-image-ref',
  result:{analysis:{observations:[observation]}}};
const before=JSON.stringify({draft,revision});
const valid=buildPokemonScreenshotRatingPreview({draft,revision});
assert.equal(valid.status,'PROVISIONAL_HEURISTIC');
assert.equal(valid.proposed_rating,'S+');
assert.equal(valid.rule_version,POKEMON_PROVISIONAL_RATING_RULE_VERSION);
assert.equal(valid.current_contribution,30);
assert.equal(valid.future_contribution,33);
assert.equal(valid.player_data_write,false);
assert.equal(valid.overwrite_allowed,false);
assert.equal(JSON.stringify({draft,revision}),before,'preview mutated evidence');
const html=renderPokemonScreenshotRatingPreviewHtml(valid);
assert.match(html,/S\+/);
assert.match(html,/CURRENT/);
assert.match(html,/FUTURE/);
assert.match(html,/不會覆蓋舊評級/);
const check=(d,r,reason)=>{
  const value=buildPokemonScreenshotRatingPreview({draft:d,revision:r});
  assert.equal(value.status,'REVIEW_REQUIRED',reason);
  assert.equal(value.proposed_rating,null,reason);
  assert.equal(value.player_data_write,false);
  assert.equal(value.overwrite_allowed,false);
  return value;
};
assert.ok(check(draft,{...revision,analysis_type:'ocr'},'OCR only').reason_codes.includes('OBSERVATION_V2_REQUIRED'));
assert.ok(check(draft,{...revision,result:{analysis:{observations:[{...observation,
  evidence:{...observation.evidence,source_image_refs:[]}}]}}},'no source').reason_codes.includes('OBSERVATION_IMAGE_PROVENANCE_MISSING'));
// RATE.2 negative-first: evidence for image-A must not authenticate a revision
// whose canonical source_image_ref points to a different or missing image.
assert.ok(check(draft,{...revision,source_image_ref:'different-private-image-ref'},
  'revision image mismatch').reason_codes.includes('REVISION_IMAGE_PROVENANCE_MISMATCH'));
assert.ok(check(draft,{...revision,source_image_ref:null},
  'revision image identity missing').reason_codes.includes('REVISION_IMAGE_PROVENANCE_MISMATCH'));
// RATE.2 negative-first: OCR/AI confidence must be an actual finite numeric
// observation, not a coercible string or boolean that Number() turns into 0.99/1.
for(const untrusted of ['0.99',true]){
  const held=check(draft,{...revision,result:{analysis:{observations:[{...observation,
    evidence:{...observation.evidence,field_confidence:{...conf,nature:untrusted}}}]}}},
    'coercible nonnumeric OCR confidence must HOLD');
  assert.ok(held.missing_inputs.includes('field_confidence_nature'));
}
// RATE.2 negative-first: a source image's OCR level/slot is not canonical
// numeric evidence merely because String()/Number() matches a reviewed draft.
// The draft can contain a verified number while the observation says "20" or
// true; an apparent match must never authorize a heuristic rating.
for(const untrusted of ['20',true]){
  const held=check(draft,{...revision,result:{analysis:{observations:[{...observation,
    profile:{...profile,level:untrusted}}]}}},'coercible source level must HOLD');
  assert.ok(held.reason_codes.includes('SOURCE_NONCANONICAL_LEVEL'));
}
for(const untrusted of ['10',true]){
  const held=check(draft,{...revision,result:{analysis:{observations:[{...observation,
    subskills:[{...slots[0],unlock_level:untrusted},...slots.slice(1)]}]}}},
    'coercible source subskill slot must HOLD');
  assert.ok(held.reason_codes.includes('SOURCE_NONCANONICAL_SUBSKILL_LEVEL'));
}
assert.ok(check(draft,{...revision,result:{analysis:{observations:[{...observation,
  evidence:{...observation.evidence,field_confidence:{...conf,nature:0.3}}}]}}},'low confidence').reason_codes.includes('LOW_CONFIDENCE_nature'));
assert.ok(check(draft,{...revision,result:{analysis:{observations:[{...observation,
  evidence:{...observation.evidence,field_confidence:{...conf,subskills:null}}}]}}},'missing confidence').missing_inputs.includes('field_confidence_subskills'));
assert.ok(check({...draft,nature:'勤奮'},revision,'manual unverified edit').reason_codes.includes('DRAFT_SOURCE_MISMATCH_nature'));
assert.ok(check({...draft,baseline_hydrated_fields:['nature']},revision,'baseline source').reason_codes.includes('BASELINE_NOT_NEW_IMAGE_EVIDENCE'));
assert.ok(check({...draft,identity_guard_warnings:[{reason:'unverified'}]},revision,'identity guard').reason_codes.includes('IDENTITY_REVIEW_REQUIRED'));
assert.ok(check(draft,{...revision,result:{analysis:{observations:[{...observation,
  evidence:{...observation.evidence,field_conflicts:{nature:{status:'CONFLICT'}}}}]}}},'conflict').reason_codes.includes('OBSERVATION_FIELD_CONFLICT'));
assert.ok(check({...draft,subskills:slots.slice(0,3)},revision,'partial slots').missing_inputs.includes('subskill_level_70'));
const hostile=renderPokemonScreenshotRatingPreviewHtml({...valid,source_image_refs:['<img src=x onerror=alert(1)>']});
assert.doesNotMatch(hostile,/<img/);
assert.match(hostile,/&lt;img/);
// Runtime wiring must remain a display-only consumer, never an implicit writer.
const ui=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
assert.match(ui,/id="analysisProvisionalRatingPreview"/);
assert.match(ui,/buildPokemonScreenshotRatingPreview/);
assert.match(ui,/renderPokemonScreenshotRatingPreviewHtml/);
assert.match(ui,/function readRatingPreviewDraft/);
assert.match(ui,/refreshRatingPreview\(root\)/);
console.log(JSON.stringify({gate:'G14_RATE2_SCREENSHOT_REVIEW_READ_ONLY',
  status:'PASS',valid_grade:'S+',negative_cases:11,
  identity_and_source_fail_closed:true,no_player_write:true}));
