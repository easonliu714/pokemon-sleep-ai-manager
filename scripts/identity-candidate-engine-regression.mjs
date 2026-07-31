import assert from 'node:assert/strict';
import {classifyIdentityCandidates} from '../assets/js/identity-candidate-engine.js';

const base={pokemon_id:'pkm-1',pokemon_instance_id:'inst-1',update_token:'PKM-AAAA',species:'土王',current_species:'土王',level:30,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S',ingredients:[{unlock_level:1,ingredient_name:'放鬆可可'},{unlock_level:30,ingredient_name:'醒腦咖啡豆'}],subskills:[{unlock_level:10,subskill_name:'技能機率提升S'},{unlock_level:25,subskill_name:'持有上限提升S'}]};
const observation={identity:{target_pokemon_instance_id:null,target_update_token:null},profile:{species:'土王',level:31,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S'},ingredients:[{unlock_level:1,ingredient_name:'放鬆可可'},{unlock_level:30,ingredient_name:'醒腦咖啡豆'}],subskills:[{unlock_level:10,subskill_name:'技能機率提升S'},{unlock_level:25,subskill_name:'持有上限提升S'}]};

assert.equal(classifyIdentityCandidates({...observation,identity:{target_pokemon_instance_id:'inst-1'}},[base]).status,'exact_existing');
assert.equal(classifyIdentityCandidates(observation,[base]).status,'unique_high_confidence');
assert.equal(classifyIdentityCandidates(observation,[base,{...base,pokemon_id:'pkm-2',pokemon_instance_id:'inst-2'}]).status,'ambiguous_existing');
assert.equal(classifyIdentityCandidates({...observation,profile:{species:'皮卡丘',level:31}},[base]).status,'no_candidate');
assert.equal(classifyIdentityCandidates({identity:{},profile:{species:'土王',level:31}},[base]).status,'possible_existing');
console.log('PASS TECH.2B identity candidate classifications');
