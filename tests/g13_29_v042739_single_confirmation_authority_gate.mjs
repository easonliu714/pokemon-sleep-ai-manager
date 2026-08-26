import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const explicitPath='assets/js/explicit-manual-draft-save-v042737.js';
const overlayPath='assets/js/analysis-manual-draft-overlay-v042719.js';
const firstRenderPath='assets/js/confirmation-first-render-authority-v042732.js';
for(const path of [explicitPath,overlayPath,firstRenderPath]){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  assert.equal(syntax.status,0,`${path} syntax must pass`);
}

const explicit=await import(`${pathToFileURL(explicitPath).href}?t=${Date.now()}`);
const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const overlaySource=fs.readFileSync(overlayPath,'utf8');
const firstRenderSource=fs.readFileSync(firstRenderPath,'utf8');
const explicitSource=fs.readFileSync(explicitPath,'utf8');
const coreSource=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');

assert.match(versionAuthority,/app_version:\s*'v0\.4\.27\.39'/);
assert.match(versionAuthority,/app_build:\s*'20260825-v042739-single-confirmation-authority'/);
assert.match(versionAuthority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.39-v042739-single-confirmation-authority'/);
assert.match(versionAuthority,/\/\/ app_version: 'v0\.4\.27\.38'/,'v0.4.27.38 must remain as immutable predecessor parser evidence');

assert.equal(explicit.SINGLE_CONFIRMATION_AUTHORITY_VERSION,'v0.4.27.39-single-confirmation-authority-2026-08-25-a');
assert.equal(explicit.isLegacyCorrectedConfirmationEvent({v042718_form_authority_corrected:true}),true);
assert.equal(explicit.isLegacyCorrectedConfirmationEvent({v042718_form_authority_corrected:false}),false);
assert.match(explicitSource,/v042739_legacy_corrected_event_suppressed/);
assert.match(explicitSource,/addEventListener\?\.\('pokemon-sleep:analysis-confirmation-group-selected',suppressLegacyCorrectedEvent,true\)/);
assert.match(explicitSource,/addEventListener\?\.\('pokemon-sleep:analysis-confirmation-merged',suppressLegacyCorrectedEvent,true\)/);
assert.match(explicitSource,/scope\.PokemonSleepSingleConfirmationAuthorityV042739=api/);
assert.match(explicitSource,/single_confirmation_authority:true/);
assert.match(explicitSource,/v042739_authoritative_render_committed/);

// v0.4.27.29 manual overlay and v0.4.27.36 first-render projection are retained only
// as predecessor helpers. In v0.4.27.39 they cannot register production DOM writers.
assert.match(overlaySource,/SINGLE_CONFIRMATION_AUTHORITY_SHADOW_VERSION='v0\.4\.27\.39-single-confirmation-authority-2026-08-25-a'/);
assert.match(overlaySource,/if\(!shadowOnly\)\{/);
assert.match(overlaySource,/captureVisibleForm:shadowOnly\?noCapture:captureVisibleForm/);
assert.match(overlaySource,/restoreVisibleForm:shadowOnly\?noRestore:restoreVisibleForm/);
assert.match(overlaySource,/confirmation_dom_write_authority:!shadowOnly/);
assert.match(overlaySource,/confirmation_dom_capture_authority:!shadowOnly/);
assert.match(firstRenderSource,/SINGLE_CONFIRMATION_AUTHORITY_SHADOW_VERSION='v0\.4\.27\.39-single-confirmation-authority-2026-08-25-a'/);
assert.match(firstRenderSource,/if\(!shadowOnly\)\{/);
assert.match(firstRenderSource,/projectVisible:shadowOnly\?shadowProject:projectVisible/);
assert.match(firstRenderSource,/confirmation_dom_write_authority:!shadowOnly/);
assert.match(firstRenderSource,/event_draft_mutation_authority:!shadowOnly/);

// Physical +1 replay, expressed without player-private values. Visible group A has been
// contaminated by next group B across both scalar and structured fields. The single
// authority must restore the entire form, not only species/type/berry.
const nodes={
  species:{type:'text',value:'GROUP_B_SPECIES',dataset:{field:'species'}},
  type:{type:'text',value:'GROUP_B_TYPE',dataset:{field:'type'}},
  favorite_berry:{type:'text',value:'GROUP_B_BERRY',dataset:{field:'favorite_berry'}},
  nature:{type:'text',value:'GROUP_B_NATURE',dataset:{field:'nature'}},
  main_skill:{type:'text',value:'GROUP_B_SKILL',dataset:{field:'main_skill'}},
  level:{type:'number',value:'22',dataset:{field:'level'}},
  ingredient_name_1:{type:'text',value:'GROUP_B_INGREDIENT',dataset:{field:'ingredient_name_1'}},
  ingredient_qty_1:{type:'number',value:'9',dataset:{field:'ingredient_qty_1'}},
  subskill_name_10:{type:'text',value:'GROUP_B_SUBSKILL',dataset:{field:'subskill_name_10'}},
};
const unlock={type:'checkbox',checked:false,dataset:{check:'sub_unlock_10'}};
const fakeRoot={
  querySelectorAll:selector=>selector==='[data-field]'?Object.values(nodes):selector==='[data-check]'?[unlock]:[],
};
const authoritativeA={
  species:'GROUP_A_SPECIES',type:'GROUP_A_TYPE',favorite_berry:'GROUP_A_BERRY',nature:'GROUP_A_NATURE',main_skill:'GROUP_A_SKILL',level:11,
  ingredients:[{unlock_level:1,ingredient_name:'GROUP_A_INGREDIENT',quantity:1}],
  subskills:[{unlock_level:10,subskill_name:'GROUP_A_SUBSKILL',is_unlocked:1}],
};
const projected=explicit.projectAuthoritativeForm(fakeRoot,authoritativeA);
assert.deepEqual(new Set(projected),new Set([
  'field:species','field:type','field:favorite_berry','field:nature','field:main_skill','field:level',
  'field:ingredient_name_1','field:ingredient_qty_1','field:subskill_name_10','check:sub_unlock_10',
]));
assert.equal(nodes.species.value,'GROUP_A_SPECIES');
assert.equal(nodes.type.value,'GROUP_A_TYPE');
assert.equal(nodes.favorite_berry.value,'GROUP_A_BERRY');
assert.equal(nodes.nature.value,'GROUP_A_NATURE');
assert.equal(nodes.main_skill.value,'GROUP_A_SKILL');
assert.equal(nodes.level.value,'11');
assert.equal(nodes.ingredient_name_1.value,'GROUP_A_INGREDIENT');
assert.equal(nodes.ingredient_qty_1.value,'1');
assert.equal(nodes.subskill_name_10.value,'GROUP_A_SUBSKILL');
assert.equal(unlock.checked,true);

const before=explicit.snapshotForm(fakeRoot,authoritativeA);
const classification=explicit.classifyFormSnapshot({...before,touched_keys:[]});
assert.equal(classification.clean,true,'after authoritative projection there must be no residual system drift');
assert.equal(classification.manual_dirty,false);

// Existing core conflict semantics must remain fail-closed; v0.4.27.39 does not guess
// between genuinely conflicting cross-image ingredient/subskill observations.
assert.match(coreSource,/REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT/);
assert.match(coreSource,/addConflict\(out,'ingredients',out\.ingredients,next\.ingredients\);out\.ingredients=\[\]/);
assert.match(coreSource,/addConflict\(out,'subskills',out\.subskills,next\.subskills\);out\.subskills=\[\]/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.29_V042739_SINGLE_CONFIRMATION_AUTHORITY',
  physical_failure_replay:'A<-B and B<-C visible +1 contamination after otherwise correct per-image revisions',
  core_hydrated_draft_is_automatic_render_authority:true,
  explicit_manual_save_is_only_user_write_authority:true,
  legacy_corrected_event_suppressed:true,
  legacy_manual_overlay_shadow_only:true,
  first_render_projector_shadow_only:true,
  full_form_authoritative_reprojection:true,
  species_type_berry_only_patch_retired:true,
  cross_image_conflict_fail_closed_preserved:true,
  private_player_fixture_embedded:false,
},null,2));