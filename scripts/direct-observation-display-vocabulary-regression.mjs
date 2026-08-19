import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAIN_SKILLS,NATURES,resolvePokemonProductionModifierProfile} from '../assets/js/pokemon-master-options.js';
import {evaluateSkillTextEvidence} from '../assets/js/pokemon-visual-evidence-contract.js';

const direct=(value)=>({kind:'MAIN_SKILL_TEXT',value,source_image_ref:'ability.png',confidence:0.99,observation_basis:'DIRECT_IMAGE',inference_used:false});
const observedMainSkillLabels=[
  '樹果遞增','料理強化S','料理成功S','夢魘（能量填充M）','食材精選S','十項全能（揮指）','治癒波動（活力療癒S）','禮物（食材獲取S）','蓄力（能量填充S）',
];
for(const value of observedMainSkillLabels){
  assert.ok(MAIN_SKILLS.includes(value),`direct display label missing: ${value}`);
  assert.equal(evaluateSkillTextEvidence(direct(value),'MAIN_SKILL_TEXT').status,'MATCH',`direct display label rejected: ${value}`);
}
for(const value of ['流星群（樹果遽增）','夢魘（能量填充M）']){
  assert.equal(evaluateSkillTextEvidence(direct(value),'MAIN_SKILL_TEXT').status,'MATCH',`NFKC-equivalent finite vocabulary mismatch: ${value}`);
}
assert.equal(evaluateSkillTextEvidence(direct('流星群（樹果速增）'),'MAIN_SKILL_TEXT').status,'REVIEW_REQUIRED','physical-validation typo must not become canonical direct vocabulary');
assert.deepEqual(NATURES['慢吞吞'],['食材機率','活力回復量'],'production semantic key must remain backward-compatible');
const directUiNature=resolvePokemonProductionModifierProfile({nature:'慢吞吞',nature_bonus:'食材發現率',nature_penalty:'活力回復量',unlocked_subskills:[]});
const legacyNature=resolvePokemonProductionModifierProfile({nature:'慢吞吞',nature_bonus:'食材機率',nature_penalty:'活力回復量',unlocked_subskills:[]});
assert.equal(directUiNature.nature_reconciliation.status,'CONSISTENT');
assert.equal(legacyNature.nature_reconciliation.status,'CONSISTENT');
assert.ok(directUiNature.modifiers.some(row=>row.source_name==='食材機率'),'direct UI alias must not change production modifier source_name contract');
const externalPrompt=fs.readFileSync('prompts/pokemon-screenshot-to-json.md','utf8');
for(const value of observedMainSkillLabels)assert.ok(externalPrompt.includes(value),`external prompt missing direct display label: ${value}`);
console.log(JSON.stringify({status:'PASS',gate:'DIRECT_OBSERVATION_DISPLAY_VOCABULARY',main_skill_labels:observedMainSkillLabels.length,nature_ui_label:'食材發現率',production_semantic_key:'食材機率',legacy_nature_alias_supported:true,nfkc_symmetric:true,internal_external_vocabulary_parity:true,latios_skill_canonical:'流星群（樹果遽增）'},null,2));
