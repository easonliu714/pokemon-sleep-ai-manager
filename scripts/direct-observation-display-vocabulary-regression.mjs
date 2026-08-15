import assert from 'node:assert/strict';
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
assert.deepEqual(NATURES['慢吞吞'],['食材發現率','活力回復量']);
assert.equal(resolvePokemonProductionModifierProfile({nature:'慢吞吞',nature_bonus:'食材發現率',nature_penalty:'活力回復量',unlocked_subskills:[]}).nature_reconciliation.status,'CONSISTENT');
assert.equal(resolvePokemonProductionModifierProfile({nature:'慢吞吞',nature_bonus:'食材機率',nature_penalty:'活力回復量',unlocked_subskills:[]}).nature_reconciliation.status,'CONSISTENT');
console.log(JSON.stringify({status:'PASS',gate:'DIRECT_OBSERVATION_DISPLAY_VOCABULARY',main_skill_labels:observedMainSkillLabels.length,nature_ui_label:'食材發現率',legacy_nature_alias:'食材機率'},null,2));
