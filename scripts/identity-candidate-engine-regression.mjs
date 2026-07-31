import assert from 'node:assert/strict';
import {classifyIdentityCandidates,resolveObservationBatch} from '../assets/js/identity-candidate-engine.js';
import {createSqliteIdentityCandidateAdapter} from '../assets/js/sqlite-identity-candidate-adapter.js';

const base={
  pokemon_id:'pkm-1',pokemon_instance_id:'inst-1',update_token:'PKM-AAAA',
  species:'土王',current_species:'土王',capture_species:'烏波',evolution_chain_species:['烏波','土王'],
  registered_date:'2026-07-01',level:30,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S',
  ingredients:[{unlock_level:1,ingredient_name:'放鬆可可'},{unlock_level:30,ingredient_name:'醒腦咖啡豆'}],
  subskills:[{unlock_level:10,subskill_name:'技能機率提升S'},{unlock_level:25,subskill_name:'持有上限提升S'}]
};
const observation={
  incoming_ref:'obs-1',identity:{target_pokemon_instance_id:null,target_update_token:null},
  profile:{species:'土王',capture_species:'烏波',registered_date:'2026-07-01',level:31,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S'},
  ingredients:[{unlock_level:1,ingredient_name:'放鬆可可'},{unlock_level:30,ingredient_name:'醒腦咖啡豆'}],
  subskills:[{unlock_level:10,subskill_name:'技能機率提升S'},{unlock_level:25,subskill_name:'持有上限提升S'}]
};

assert.equal(classifyIdentityCandidates({...observation,identity:{target_pokemon_instance_id:'inst-1'}},[base]).status,'exact_existing');
assert.equal(classifyIdentityCandidates(observation,[base]).status,'unique_high_confidence');
assert.equal(classifyIdentityCandidates(observation,[base,{...base,pokemon_id:'pkm-2',pokemon_instance_id:'inst-2'}]).status,'ambiguous_existing');
assert.equal(classifyIdentityCandidates({...observation,profile:{species:'皮卡丘',level:31}},[base]).status,'no_candidate');
assert.equal(classifyIdentityCandidates({identity:{},profile:{species:'土王',level:31}},[base]).status,'possible_existing');

const evolvedObservation={...observation,profile:{...observation.profile,species:'烏波'}};
assert.equal(classifyIdentityCandidates(evolvedObservation,[base]).status,'unique_high_confidence');
const dateConflict={...observation,profile:{...observation.profile,registered_date:'2026-07-02'}};
assert.equal(classifyIdentityCandidates(dateConflict,[base]).status,'no_candidate');

const dto=resolveObservationBatch({observations:[observation]},[base])[0];
assert.equal(dto.incoming_ref,'obs-1');
assert.equal(dto.status,'unique_high_confidence');
assert.equal(dto.requires_confirmation,false);
assert.equal(dto.selected_pokemon_instance_id,'inst-1');
assert.ok(dto.candidates[0].evidence.length>=4);

const fakeDb={
  async all(sql){
    if(sql.includes('FROM pokemon_instance pi'))return [{...base,ingredients:undefined,subskills:undefined,evolution_chain_species:undefined}];
    if(sql.includes('pokemon_instance_ingredient'))return base.ingredients.map(row=>({...row,pokemon_instance_id:'inst-1'}));
    if(sql.includes('pokemon_instance_subskill'))return base.subskills.map(row=>({...row,pokemon_instance_id:'inst-1'}));
    if(sql.includes('pokemon_instance_evolution_chain'))return base.evolution_chain_species.map((species_name,evolution_order)=>({pokemon_instance_id:'inst-1',species_name,evolution_order}));
    return [];
  }
};
const candidates=await createSqliteIdentityCandidateAdapter(fakeDb).loadCandidates();
assert.equal(candidates.length,1);
assert.deepEqual(candidates[0].evolution_chain_species,['烏波','土王']);
assert.equal(candidates[0].ingredients[1].ingredient_name,'醒腦咖啡豆');
assert.equal(classifyIdentityCandidates(observation,candidates).status,'unique_high_confidence');

console.log('PASS TECH.2B identity candidate classifications, SQLite adapter, evolution evidence, and DTO');
