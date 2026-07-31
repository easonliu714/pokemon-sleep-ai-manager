import fs from 'node:fs';
import assert from 'node:assert/strict';

const dedup=fs.readFileSync('assets/js/identity-dedup.js','utf8');
const quality=fs.readFileSync('assets/js/identity-quality-guard.js','utf8');
const evidence=fs.readFileSync('assets/js/identity-evidence-builder.js','utf8');
const recipeGuard=fs.readFileSync('assets/js/recipe-render-guard.js','utf8');
const shared=fs.readFileSync('assets/js/shared-knowledge-ui.js','utf8');
const master=fs.readFileSync('assets/js/pokemon-master-options.js','utf8');
const detail=fs.readFileSync('assets/js/pokemon-detail.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

assert.match(dedup,/snapshot\(`identity-merge-v3:/);
assert.match(dedup,/begin\(\)/);
assert.match(dedup,/commit\(\)/);
assert.match(dedup,/rollback\(\)/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_ingredients/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_subskills/);
assert.match(dedup,/status='archived'/);
assert.match(dedup,/planSkeletonMerges/);
assert.match(dedup,/auditActivePokemon/);
assert.match(dedup,/SYSTEM-IDENTITY-MERGE-v0\.3\.29/);

assert.match(quality,/profileCompleteness/);
assert.match(quality,/isWeakSkeleton/);
assert.match(quality,/matches\.length!==1/);
assert.match(quality,/Math\.abs\(weakLevel-candidateLevel\)>10/);
assert.match(quality,/duplicateGroups/);

const qualityUrl=`data:text/javascript;base64,${Buffer.from(quality).toString('base64')}`;
const {isWeakSkeleton,planSkeletonMerges,auditActivePokemon}=await import(qualityUrl);

const complete=(id,name,level,overrides={})=>({
  pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',
  identity_confidence:0.96,identity_review_required:0,registered_at:'2026-07-01T00:00:00+08:00',
  identity_fingerprint:`fp-${id}`,main_skill:'活力填充S',nature:'慢吞吞',helper_seconds:3290,
  carry_limit:31,sp:1183,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',
  ...overrides,
});
const skeleton=(id,name,level,overrides={})=>({
  pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',
  identity_confidence:0.5,identity_review_required:1,registered_at:null,identity_fingerprint:null,
  main_skill:null,nature:null,helper_seconds:null,carry_limit:null,sp:null,
  core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',
  ...overrides,
});

const quagsire=complete('pkm-quagsire','土王',31);
const staleQuagsire=skeleton('pkm-private-quagsire','土王',30);
assert.equal(isWeakSkeleton(staleQuagsire),true);
let plans=planSkeletonMerges([quagsire,staleQuagsire]);
assert.equal(plans.length,1,'stale-level 土王 skeleton must converge');
assert.equal(plans[0].winner.pokemon_id,'pkm-quagsire');
assert.equal(plans[0].loser.pokemon_id,'pkm-private-quagsire');

const monferno=complete('pkm-monferno','猛火猴',25,{specialty:'技能',type:'格鬥',core_role:'樹果遞增技能核心',recommendation:'優先進化烈焰猴'});
const staleMonferno=skeleton('pkm-private-monferno','猛火猴',21,{specialty:'技能',type:'格鬥',core_role:'樹果遞增技能核心',recommendation:'優先進化烈焰猴'});
plans=planSkeletonMerges([monferno,staleMonferno]);
assert.equal(plans.length,1,'stale-level 猛火猴 skeleton must converge');

const secondQuagsire=complete('pkm-quagsire-2','土王',32);
plans=planSkeletonMerges([quagsire,secondQuagsire,staleQuagsire]);
assert.equal(plans.length,0,'ambiguous candidates must never auto-merge');

const incompatible=skeleton('pkm-private-wrong','土王',30,{recommendation:'不同建議'});
plans=planSkeletonMerges([quagsire,incompatible]);
assert.equal(plans.length,0,'conflicting evidence must block auto-merge');

let audit=auditActivePokemon([quagsire,staleQuagsire]);
assert.equal(audit.ok,false);
assert.deepEqual(audit.skeletons,['pkm-private-quagsire']);
audit=auditActivePokemon([quagsire]);
assert.equal(audit.ok,true);

assert.match(evidence,/buildAbilitySignature/);
assert.match(evidence,/\[1,30,60\]\.every/);
assert.match(evidence,/\[10,25,50,70,80\]\.every/);
assert.match(evidence,/counts\.get\(item\.fingerprint\)===1/);
assert.match(evidence,/identity_confidence=0\.96/);
assert.match(evidence,/identity_review_required=0/);
assert.match(evidence,/ability_fingerprint/);
assert.match(evidence,/SYSTEM-IDENTITY-EVIDENCE-BUILDER-v0\.3\.27/);
assert.match(evidence,/snapshot\(`identity-evidence-builder:/);
assert.match(evidence,/begin\(\)/);
assert.match(evidence,/commit\(\)/);
assert.match(evidence,/rollback\(\)/);
assert.doesNotMatch(evidence,/registered_at=\?/,'builder must not invent registered_at');

assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/renderSharedKnowledge\(true\)/);
assert.match(shared,/renderSharedKnowledge\(force=false\)/);

assert.match(master,/SPECIALTIES=\['技能','樹果','食材'\]/);
assert.match(master,/BERRY_BY_TYPE/);
assert.match(master,/NATURES=/);
assert.match(master,/MAIN_SKILLS=/);
assert.match(master,/SUBSKILLS=/);
assert.match(master,/mergedOptions/);
assert.match(detail,/pokemonTypeSelect/);
assert.match(detail,/pokemonNatureSelect/);
assert.match(detail,/BERRY_BY_TYPE\[type\.value\]/);
assert.match(detail,/NATURES\[nature\.value\]/);
assert.match(detail,/select\('specialty'/);
assert.match(detail,/select\('main_skill'/);
assert.match(detail,/mergedOptions\(INGREDIENTS/);
assert.match(detail,/mergedOptions\(SUBSKILLS/);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.29'/);
assert.match(bootstrap,/20260731-identity-quality-guard1/);
assert.match(bootstrap,/'identity-quality-guard\.js'/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.29-identity-quality-guard/);
assert.match(sw,/identity-quality-guard\.js/);

console.log('PASS identity duplicate/skeleton guards, recipe guard, and master data editor regression');
