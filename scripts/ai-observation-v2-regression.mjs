import assert from 'node:assert/strict';
import {AI_OBSERVATION_PROMPT,buildObservationTemplate,normalizeObservationPayload,validateObservationPayload} from '../assets/js/ai-observation.js';
import {PROMPT_CATALOG,buildScenarioTemplate} from '../assets/js/prompt-catalog.js';

assert.match(AI_OBSERVATION_PROMPT,/不得自行建立 pokemon_id/);
assert.match(AI_OBSERVATION_PROMPT,/resolve_on_import/);
assert.equal(PROMPT_CATALOG.pokemon.contract,'observation-v2');
assert.equal(buildScenarioTemplate('pokemon').schema_version,'2.0-observation');
assert.equal(buildObservationTemplate().observations[0].identity.pokemon_instance_id,undefined);

const fenced=`說明文字\n\`\`\`json\n${JSON.stringify({schema_version:'2.0-observation',source:'anything',operations:[{action:'insert'}],observations:[{incoming_ref:'img-1',action:'insert',pokemon_id:'invented',pokemon_instance_id:'invented',requested_action:'insert',identity:{instance_discriminator:'02'},profile:{species:'土王',level:'31',sp:'1183',main_skill_level:'1'},ingredients:[{unlock_level:'30',ingredient_name:'N/A',quantity:'4'}],subskills:[{unlock_level:75,subskill_name:'食材機率S'},{unlock_level:100,subskill_name:'幫手速度S'}]}]})}\n\`\`\`\n額外文字`;
const normalized=normalizeObservationPayload(fenced);
assert.equal(normalized.schema_version,'2.0-observation');
assert.equal(normalized.source,'ai_screenshot_observation');
assert.equal(normalized.operations,undefined);
assert.equal(normalized.observations[0].requested_action,'resolve_on_import');
assert.equal(normalized.observations[0].pokemon_id,undefined);
assert.equal(normalized.observations[0].pokemon_instance_id,undefined);
assert.equal(normalized.observations[0].identity.instance_discriminator,null);
assert.equal(normalized.observations[0].profile.level,31);
assert.equal(normalized.observations[0].profile.sp,1183);
assert.equal(normalized.observations[0].ingredients[0].ingredient_name,null);
assert.equal(normalized.observations[0].ingredients[0].quantity,4);
assert.deepEqual(normalized.observations[0].subskills.map(row=>row.unlock_level),[70,80]);

let result=validateObservationPayload(fenced);
assert.deepEqual(result.errors,[]);
assert.equal(result.summary.requires_identity_resolution,1);

result=validateObservationPayload({observations:[{incoming_ref:'same',profile:{species:'土王'}},{incoming_ref:'same',profile:{species:'猛火猴'}}]});
assert.ok(result.errors.some(message=>message.includes('incoming_ref 重複')));

result=validateObservationPayload('not json');
assert.ok(result.errors.length>0);

console.log('PASS AI Observation v2 prompt, normalization, validation, and cross-model fixtures');
