import assert from 'node:assert/strict';
import {BERRY_BY_TYPE} from '../assets/js/pokemon-master-options.js';
import {POKEMON_VISUAL_EVIDENCE_VERSION} from '../assets/js/pokemon-visual-evidence-contract.js';
import {POKEMON_VISUAL_PROMPT_POLICY_VERSION} from '../assets/js/pokemon-visual-prompt-policy.js';
import {
  POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION,
  POKEMON_75_VISUAL_REAUDIT_CONTRACT,
  compilePokemon75VisualReauditUpdate,
} from '../assets/js/pokemon-75-visual-reaudit-compiler.js';

const direct=(kind,value,ref,unlockLevel=null)=>({
  kind,value,source_image_ref:ref,confidence:0.99,observation_basis:'DIRECT_IMAGE',inference_used:false,
  ...(unlockLevel==null?{}:{unlock_level:unlockLevel}),
});

function validObservation(){
  const type='幽靈';
  const berry=BERRY_BY_TYPE[type];
  assert.ok(berry,'fixture type must have governed berry');
  return {
    schema_version:'2.0-observation',
    prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
    source:'synthetic_regression_fixture',
    observations:[{
      incoming_ref:'fixture-drifloon-001',
      requested_action:'resolve_on_import',
      identity:{target_pokemon_instance_id:null,target_update_token:null,capture_species_id:null,current_species_id:null,registered_date:null,instance_discriminator:null},
      profile:{
        species:null,species_observation_basis:null,header_name_text:'飄飄球',nickname:null,
        level:12,sp:500,specialty:null,type,main_skill:null,main_skill_level:null,
        nature:null,nature_bonus:null,nature_penalty:null,helper_seconds:null,carry_limit:null,
        favorite_berry:berry,sleep_time_text:null,sleep_hours:null,
      },
      ingredients:[{unlock_level:1,ingredient_name:'萌綠玉米',quantity:1}],
      subskills:[],
      audit_candidates:[],
      evidence:{source_image_refs:['fixture-top.png'],field_confidence:{level:1,sp:1},unreadable_fields:[],field_conflicts:{},notes:null},
      visual_evidence:{
        contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
        prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
        public_relation_may_generate_player_observation:false,
        type:direct('TYPE_VISUAL',type,'fixture-top.png'),
        berry:direct('BERRY_VISUAL',berry,'fixture-top.png'),
        ingredients:[direct('INGREDIENT_VISUAL','萌綠玉米','fixture-top.png',1)],
        main_skill:null,
        subskills:[],
      },
    }],
  };
}

const identityIndex=[{incoming_ref:'fixture-drifloon-001',pokemon_id:'fixture-pokemon-001',canonical_species:'飄飄球'}];
const compiled=compilePokemon75VisualReauditUpdate({
  observationPayload:validObservation(),
  identityIndex,
  updateId:'UPD-SYNTHETIC-POKEMON75-VISUAL-COMPILER',
  generatedAt:'2026-08-15T00:00:00.000Z',
  source:'synthetic regression only',
  sourceZipSha256:'synthetic-not-private',
  expectedPokemonCount:1,
});

assert.equal(POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION,'pokemon-75-visual-reaudit-compiler-2026-08-15-a');
assert.equal(POKEMON_75_VISUAL_REAUDIT_CONTRACT,'pokemon-75-source-screenshot-reaudit/2.0');
assert.equal(compiled.preflight.status,'MATCH');
assert.equal(compiled.preflight.safe_for_sqlite_apply,true);
assert.equal(compiled.summary.pokemon_count,1);
assert.equal(compiled.summary.operation_count,2);
assert.equal(compiled.payload.pokemon_visual_evidence_required,true);
assert.equal(compiled.payload.reaudit_contract.old_package_values_may_seed_player_observation,false);
assert.equal(compiled.payload.reaudit_contract.identity_index_may_supply_stable_ids_only,true);
assert.equal(compiled.payload.pokemon_visual_evidence_manifest.observations[0].pokemon_id,'fixture-pokemon-001');
const pokemonOp=compiled.payload.operations.find(row=>row.entity==='pokemon');
const ingredientOp=compiled.payload.operations.find(row=>row.entity==='pokemon_ingredients');
assert.equal(pokemonOp.data.species,'飄飄球');
assert.equal(pokemonOp.data.type,'幽靈');
assert.equal(pokemonOp.data.favorite_berry,BERRY_BY_TYPE['幽靈']);
assert.equal('nickname' in pokemonOp.data,false,'editable header must not become nickname');
assert.equal(ingredientOp.data.ingredient_name,'萌綠玉米');
assert.equal(ingredientOp.data.quantity,1);

const missingType=validObservation();
missingType.observations[0].visual_evidence.type=null;
assert.throws(()=>compilePokemon75VisualReauditUpdate({observationPayload:missingType,identityIndex,expectedPokemonCount:1}),/POKEMON75_REQUIRED_DIRECT_EVIDENCE_MISSING/);

const inferredBerry=validObservation();
inferredBerry.observations[0].visual_evidence.berry.inference_used=true;
assert.throws(()=>compilePokemon75VisualReauditUpdate({observationPayload:inferredBerry,identityIndex,expectedPokemonCount:1}),/(OBSERVATION_VALIDATION_FAILED|DIRECT_IMAGE_BASIS_REQUIRED)/);

const conflict=validObservation();
conflict.observations[0].profile.helper_seconds=null;
conflict.observations[0].evidence.field_conflicts={helper_seconds:{values:[4374,774],source_image_refs:['a.png','b.png'],status:'CONFLICT',resolution_required:true}};
assert.throws(()=>compilePokemon75VisualReauditUpdate({observationPayload:conflict,identityIndex,expectedPokemonCount:1}),/POKEMON75_UNRESOLVED_FIELD_CONFLICT/);

const wrongIngredient=validObservation();
wrongIngredient.observations[0].ingredients[0].ingredient_name='好眠番茄';
assert.throws(()=>compilePokemon75VisualReauditUpdate({observationPayload:wrongIngredient,identityIndex,expectedPokemonCount:1}),/INGREDIENT_SCALAR_EVIDENCE_MISMATCH/);

const oldPolicy=validObservation();
oldPolicy.prompt_policy_version='pokemon-visual-prompt-policy-2026-08-15-a';
assert.throws(()=>compilePokemon75VisualReauditUpdate({observationPayload:oldPolicy,identityIndex,expectedPokemonCount:1}),/(OBSERVATION_VALIDATION_FAILED|PROMPT_POLICY_VERSION_MISMATCH)/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'POKEMON75_FRESH_VISUAL_REAUDIT_COMPILER',
  compiler_version:POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION,
  contract:POKEMON_75_VISUAL_REAUDIT_CONTRACT,
  visual_preflight:'MATCH',
  old_package_values_as_observation:false,
  identity_index_stable_ids_only:true,
  unresolved_conflict_blocks:true,
  missing_direct_type_blocks:true,
  inference_blocks:true,
},null,2));
