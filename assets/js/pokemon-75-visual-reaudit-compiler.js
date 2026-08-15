import {validateObservationPayload} from './ai-observation.js';
import {POKEMON_VISUAL_PROMPT_POLICY_VERSION} from './pokemon-visual-prompt-policy.js';
import {
  buildPokemonVisualEvidenceManifest,
  evaluatePokemonVisualUpdatePackage,
} from './pokemon-visual-update-preflight.js';

export const POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION='pokemon-75-visual-reaudit-compiler-2026-08-15-a';
export const POKEMON_75_VISUAL_REAUDIT_CONTRACT='pokemon-75-source-screenshot-reaudit/2.0';

const clean=value=>String(value??'').normalize('NFKC').trim();
const meaningful=value=>value!==null&&value!==undefined&&clean(value)!=='';
const clone=value=>JSON.parse(JSON.stringify(value));
const directValue=evidence=>clean(evidence?.value)||null;
const finiteConfidence=value=>Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1;

const PROFILE_FIELDS_WITH_EXPLICIT_CONFIDENCE=Object.freeze([
  'level','sp','specialty','nature','nature_bonus','nature_penalty',
  'helper_seconds','carry_limit','sleep_time_text','sleep_hours',
]);

function indexByLevel(rows=[]){
  return new Map((Array.isArray(rows)?rows:[]).map(row=>[Number(row?.unlock_level),row]));
}

function identityMap(identityIndex=[]){
  const map=new Map();
  for(const row of Array.isArray(identityIndex)?identityIndex:[]){
    const ref=clean(row?.incoming_ref),pokemonId=clean(row?.pokemon_id),species=clean(row?.canonical_species);
    if(!ref)throw new Error('POKEMON75_IDENTITY_INCOMING_REF_MISSING');
    if(map.has(ref))throw new Error(`POKEMON75_IDENTITY_DUPLICATE_REF:${ref}`);
    if(!pokemonId)throw new Error(`POKEMON75_IDENTITY_POKEMON_ID_MISSING:${ref}`);
    if(!species)throw new Error(`POKEMON75_IDENTITY_CANONICAL_SPECIES_MISSING:${ref}`);
    map.set(ref,{...clone(row),incoming_ref:ref,pokemon_id:pokemonId,canonical_species:species});
  }
  return map;
}

function conflictFields(observation){
  return observation?.evidence?.field_conflicts&&typeof observation.evidence.field_conflicts==='object'
    ?Object.keys(observation.evidence.field_conflicts)
    :[];
}

function unreadableFields(observation){
  return new Set((observation?.evidence?.unreadable_fields||[]).map(clean).filter(Boolean));
}

function fieldIsBlocked(observation,field){
  const conflicts=conflictFields(observation);
  if(conflicts.some(key=>key===field||key.startsWith(`${field}.`)))return true;
  return unreadableFields(observation).has(field);
}

function explicitlyObservedScalar(observation,field){
  const value=observation?.profile?.[field];
  if(!meaningful(value)||fieldIsBlocked(observation,field))return undefined;
  const confidence=observation?.evidence?.field_confidence?.[field];
  if(!finiteConfidence(confidence))return undefined;
  return value;
}

function assertDirectEvidence(evidence,kind,label){
  if(!evidence)throw new Error(`POKEMON75_REQUIRED_DIRECT_EVIDENCE_MISSING:${label}`);
  if(evidence.kind!==kind)throw new Error(`POKEMON75_DIRECT_EVIDENCE_KIND_MISMATCH:${label}`);
  if(evidence.observation_basis!=='DIRECT_IMAGE'||evidence.inference_used!==false)throw new Error(`POKEMON75_DIRECT_IMAGE_BASIS_REQUIRED:${label}`);
  if(!directValue(evidence))throw new Error(`POKEMON75_DIRECT_EVIDENCE_VALUE_MISSING:${label}`);
  if(!clean(evidence.source_image_ref))throw new Error(`POKEMON75_DIRECT_EVIDENCE_SOURCE_MISSING:${label}`);
  if(!finiteConfidence(evidence.confidence))throw new Error(`POKEMON75_DIRECT_EVIDENCE_CONFIDENCE_INVALID:${label}`);
  return evidence;
}

function operationBase(operationId,entity,key,data,evidence){
  return {
    operation_id:operationId,
    entity,
    action:'upsert',
    key,
    data,
    evidence,
    review_required:false,
    clear_fields:[],
  };
}

function compilePokemonOperations(observation,identity,sequence,sourceZipSha256){
  const operations=[];
  const visual=observation.visual_evidence||{};
  const typeEvidence=assertDirectEvidence(visual.type,'TYPE_VISUAL',`${identity.pokemon_id}:type`);
  const berryEvidence=assertDirectEvidence(visual.berry,'BERRY_VISUAL',`${identity.pokemon_id}:berry`);
  const sourceRefs=[...(observation?.evidence?.source_image_refs||[])].filter(Boolean);
  const commonEvidence={
    source_type:'fresh_screenshot_observation_v2',
    source_image_ref:sourceRefs.join('+')||typeEvidence.source_image_ref,
    confidence:Math.min(Number(typeEvidence.confidence),Number(berryEvidence.confidence)),
    ...(sourceZipSha256?{source_zip_sha256:sourceZipSha256}:{}),
    compiler_version:POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION,
    prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
  };
  const data={
    species:identity.canonical_species,
    current_species:identity.canonical_species,
    type:directValue(typeEvidence),
    favorite_berry:directValue(berryEvidence),
  };
  for(const field of PROFILE_FIELDS_WITH_EXPLICIT_CONFIDENCE){
    const value=explicitlyObservedScalar(observation,field);
    if(value!==undefined)data[field]=value;
  }
  if(visual.main_skill){
    const evidence=assertDirectEvidence(visual.main_skill,'MAIN_SKILL_TEXT',`${identity.pokemon_id}:main_skill`);
    data.main_skill=directValue(evidence);
  }
  operations.push(operationBase(
    `OP-${String(sequence.next++).padStart(4,'0')}`,
    'pokemon',
    {pokemon_id:identity.pokemon_id},
    data,
    commonEvidence,
  ));

  const ingredientEvidence=indexByLevel(visual.ingredients);
  const ingredientRows=indexByLevel(observation.ingredients);
  for(const level of [1,30,60]){
    const evidence=ingredientEvidence.get(level);
    if(!evidence)continue;
    assertDirectEvidence(evidence,'INGREDIENT_VISUAL',`${identity.pokemon_id}:ingredient:${level}`);
    const row=ingredientRows.get(level);
    const observedName=clean(row?.ingredient_name);
    if(!observedName)throw new Error(`POKEMON75_INGREDIENT_SCALAR_MISSING:${identity.pokemon_id}:${level}`);
    if(observedName!==directValue(evidence))throw new Error(`POKEMON75_INGREDIENT_SCALAR_EVIDENCE_MISMATCH:${identity.pokemon_id}:${level}`);
    if(fieldIsBlocked(observation,`ingredients.${level}.ingredient_name`))throw new Error(`POKEMON75_INGREDIENT_CONFLICT:${identity.pokemon_id}:${level}`);
    const ingredientData={ingredient_name:observedName};
    if(Number.isFinite(Number(row?.quantity)))ingredientData.quantity=Number(row.quantity);
    operations.push(operationBase(
      `OP-${String(sequence.next++).padStart(4,'0')}`,
      'pokemon_ingredients',
      {pokemon_id:identity.pokemon_id,unlock_level:level},
      ingredientData,
      {...commonEvidence,source_image_ref:evidence.source_image_ref,confidence:Number(evidence.confidence)},
    ));
  }

  const subskillEvidence=indexByLevel(visual.subskills);
  const subskillRows=indexByLevel(observation.subskills);
  for(const level of [10,25,50,70,80]){
    const evidence=subskillEvidence.get(level);
    if(!evidence)continue;
    assertDirectEvidence(evidence,'SUBSKILL_TEXT',`${identity.pokemon_id}:subskill:${level}`);
    const row=subskillRows.get(level);
    const observedName=clean(row?.subskill_name);
    if(!observedName)throw new Error(`POKEMON75_SUBSKILL_SCALAR_MISSING:${identity.pokemon_id}:${level}`);
    if(observedName!==directValue(evidence))throw new Error(`POKEMON75_SUBSKILL_SCALAR_EVIDENCE_MISMATCH:${identity.pokemon_id}:${level}`);
    if(fieldIsBlocked(observation,`subskills.${level}.subskill_name`))throw new Error(`POKEMON75_SUBSKILL_CONFLICT:${identity.pokemon_id}:${level}`);
    operations.push(operationBase(
      `OP-${String(sequence.next++).padStart(4,'0')}`,
      'pokemon_subskills',
      {pokemon_id:identity.pokemon_id,unlock_level:level},
      {subskill_name:observedName},
      {...commonEvidence,source_image_ref:evidence.source_image_ref,confidence:Number(evidence.confidence)},
    ));
  }
  return operations;
}

function manifestRow(observation,identity){
  const visual=observation.visual_evidence||{};
  return {
    observation_ref:observation.incoming_ref,
    pokemon_id:identity.pokemon_id,
    species:identity.canonical_species,
    type:visual.type||null,
    berry:visual.berry||null,
    ingredients:Array.isArray(visual.ingredients)?visual.ingredients:[],
    main_skill:visual.main_skill||null,
    subskills:Array.isArray(visual.subskills)?visual.subskills:[],
  };
}

export function compilePokemon75VisualReauditUpdate({
  observationPayload,
  identityIndex,
  updateId,
  generatedAt=new Date().toISOString(),
  source='fresh original screenshot re-audit',
  sourceZipSha256=null,
  expectedPokemonCount=75,
}={}){
  const validation=validateObservationPayload(observationPayload);
  if(validation.errors.length)throw new Error(`POKEMON75_OBSERVATION_VALIDATION_FAILED:${validation.errors.join('|')}`);
  const payload=validation.payload;
  if(payload.prompt_policy_version!==POKEMON_VISUAL_PROMPT_POLICY_VERSION)throw new Error('POKEMON75_PROMPT_POLICY_VERSION_MISMATCH');
  const observations=payload.observations||[];
  if(observations.length!==Number(expectedPokemonCount))throw new Error(`POKEMON75_OBSERVATION_COUNT_MISMATCH:${observations.length}:${expectedPokemonCount}`);
  const identities=identityMap(identityIndex);
  if(identities.size!==Number(expectedPokemonCount))throw new Error(`POKEMON75_IDENTITY_COUNT_MISMATCH:${identities.size}:${expectedPokemonCount}`);
  const operationSequence={next:1};
  const operations=[];
  const manifestRows=[];
  const seenPokemonIds=new Set();
  for(const observation of observations){
    const ref=clean(observation.incoming_ref);
    const identity=identities.get(ref);
    if(!identity)throw new Error(`POKEMON75_IDENTITY_NOT_FOUND:${ref}`);
    if(seenPokemonIds.has(identity.pokemon_id))throw new Error(`POKEMON75_POKEMON_ID_DUPLICATE:${identity.pokemon_id}`);
    seenPokemonIds.add(identity.pokemon_id);
    if(conflictFields(observation).length)throw new Error(`POKEMON75_UNRESOLVED_FIELD_CONFLICT:${ref}:${conflictFields(observation).join(',')}`);
    operations.push(...compilePokemonOperations(observation,identity,operationSequence,sourceZipSha256));
    manifestRows.push(manifestRow(observation,identity));
  }
  const updatePackage={
    schema_version:'1.1',
    update_id:clean(updateId)||`UPD-${generatedAt.replace(/[-:TZ.]/g,'').slice(0,14)}-PRIVATE-POKEMON-75-VISUAL-REAUDIT`,
    generated_at:generatedAt,
    source,
    scenario:'pokemon_profile_field_audit_update',
    privacy:{github_commit_allowed:false,contains_personal_account_data:true,intended_storage:'browser_indexeddb_sqlite_only'},
    pokemon_visual_evidence_required:true,
    reaudit_contract:{
      contract:POKEMON_75_VISUAL_REAUDIT_CONTRACT,
      compiler_version:POKEMON_75_VISUAL_REAUDIT_COMPILER_VERSION,
      prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
      source_bytes_required:true,
      old_package_values_may_seed_player_observation:false,
      identity_index_may_supply_stable_ids_only:true,
      expected_pokemon_count:Number(expectedPokemonCount),
      source_zip_sha256:sourceZipSha256||null,
    },
    operations,
    pokemon_visual_evidence_manifest:buildPokemonVisualEvidenceManifest(manifestRows),
  };
  const preflight=evaluatePokemonVisualUpdatePackage(updatePackage);
  if(preflight.status!=='MATCH'||preflight.safe_for_sqlite_apply!==true){
    throw new Error(`POKEMON75_VISUAL_PREFLIGHT_BLOCKED:${preflight.status}:${preflight.reason}:${(preflight.binding_conflicts||[]).join('|')}`);
  }
  return {payload:updatePackage,preflight,summary:{pokemon_count:observations.length,operation_count:operations.length,manifest_count:manifestRows.length}};
}
