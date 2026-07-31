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

for(const pattern of [/snapshot\(`identity-merge-v4:/,/begin\(\)/,/commit\(\)/,/rollback\(\)/,/status='archived'/,/SYSTEM-IDENTITY-MERGE-v0\.3\.30/]) assert.match(dedup,pattern);
assert.match(quality,/isProfileComplete/);
assert.match(quality,/profileCompleteness\(item\)>=4/);
assert.match(quality,/profileCompleteness\(item\)<=1/);
assert.doesNotMatch(quality,/identity_review_required/);
assert.doesNotMatch(quality,/registered_at/);
assert.doesNotMatch(quality,/identity_fingerprint/);

const qualityUrl=`data:text/javascript;base64,${Buffer.from(quality).toString('base64')}`;
const {isWeakSkeleton,isProfileComplete,planSkeletonMerges,auditActivePokemon}=await import(qualityUrl);
const complete=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0,identity_review_required:0,registered_at:null,identity_fingerprint:null,sp:1183,main_skill:'活力填充S',main_skill_level:1,nature:'慢吞吞',helper_seconds:3290,carry_limit:31,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});
const skeleton=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0.99,identity_review_required:0,registered_at:'legacy',identity_fingerprint:'legacy',sp:null,main_skill:null,main_skill_level:null,nature:null,helper_seconds:null,carry_limit:null,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});

const quagsire=complete('pkm-quagsire','土王',31);
const staleQuagsire=skeleton('pkm-private-quagsire','土王',30);
assert.equal(isProfileComplete(quagsire),true);
assert.equal(isWeakSkeleton(staleQuagsire),true);
assert.equal(planSkeletonMerges([quagsire,staleQuagsire]).length,1);
const monferno=complete('pkm-monferno','猛火猴',25,{specialty:'技能',type:'格鬥',core_role:'樹果遞增技能核心',recommendation:'優先進化烈焰猴'});
const staleMonferno=skeleton('pkm-private-monferno','猛火猴',21,{specialty:'技能',type:'格鬥',core_role:'樹果遞增技能核心',recommendation:'優先進化烈焰猴'});
assert.equal(planSkeletonMerges([monferno,staleMonferno]).length,1);
assert.equal(planSkeletonMerges([quagsire,complete('pkm-quagsire-2','土王',32),staleQuagsire]).length,0);
assert.equal(planSkeletonMerges([quagsire,skeleton('wrong','土王',30,{recommendation:'不同建議'})]).length,0);
assert.equal(auditActivePokemon([quagsire,staleQuagsire]).ok,false);
assert.equal(auditActivePokemon([quagsire]).ok,true);

assert.match(evidence,/buildAbilitySignature/);
assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/renderSharedKnowledge\(true\)/);
assert.match(shared,/renderSharedKnowledge\(force=false\)/);
assert.match(master,/BERRY_BY_TYPE/);
assert.match(detail,/pokemonTypeSelect/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.32'/);
assert.match(bootstrap,/20260731-tech2c-confirmation-ui/);
assert.match(bootstrap,/identity-confirmation-entry\.js/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.32-tech2c-confirmation-ui/);
assert.match(sw,/identity-candidate-engine\.js/);
assert.match(sw,/identity-confirmation-entry\.js/);
console.log('PASS profile completeness identity guard and current UI/PWA contracts');
