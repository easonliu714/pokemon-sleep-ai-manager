import {BERRY_BY_TYPE,TYPES,MAIN_SKILLS,SUBSKILLS} from './pokemon-master-options.js';
import {canonicalBerryName} from './public-berry-strength-master.js';
import {inspectIngredientIdentity} from './public-ingredient-identity.js';
import {publicSpeciesIngredientCandidatesForObservedName} from './public-species-form-zh-tw-identity-resolver.js';

export const POKEMON_VISUAL_EVIDENCE_SCHEMA='pokemon-sleep-pokemon-visual-evidence/1.0';
export const POKEMON_VISUAL_EVIDENCE_VERSION='pokemon-visual-evidence-2026-08-15-c-direct-image-basis';
export const DIRECT_IMAGE_OBSERVATION_BASIS='DIRECT_IMAGE';
export const PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION=true;
export const DIRECT_EVIDENCE_KINDS=Object.freeze([
  'TYPE_VISUAL','BERRY_VISUAL','INGREDIENT_VISUAL','MAIN_SKILL_TEXT','SUBSKILL_TEXT',
]);
export const CONSISTENCY_STATUSES=Object.freeze(['MATCH','CONFLICT','REVIEW_REQUIRED','NOT_CHECKABLE']);

const clean=value=>String(value??'').normalize('NFKC').trim();
const typeSet=new Set(TYPES.map(clean));
const berrySet=new Set(Object.values(BERRY_BY_TYPE).map(value=>canonicalBerryName(clean(value))).filter(Boolean));
const mainSkillSet=new Set(MAIN_SKILLS.map(clean));
const subskillSet=new Set(SUBSKILLS.map(clean));
const finiteConfidence=value=>Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1;

function result(status,check,extra={}){
  return Object.freeze({status,check,generated_player_values:Object.freeze([]),...extra});
}

function inspectDirectEvidence(evidence,expectedKind){
  if(!evidence)return result('REVIEW_REQUIRED',expectedKind,{reason:'DIRECT_EVIDENCE_MISSING',observed_value:null});
  if(evidence.kind!==expectedKind)return result('REVIEW_REQUIRED',expectedKind,{reason:'DIRECT_EVIDENCE_KIND_MISMATCH',observed_value:clean(evidence.value)});
  if(evidence.observation_basis!==DIRECT_IMAGE_OBSERVATION_BASIS)return result('REVIEW_REQUIRED',expectedKind,{reason:'DIRECT_IMAGE_BASIS_REQUIRED',observed_value:clean(evidence.value),observation_basis:evidence.observation_basis||null});
  if(evidence.inference_used!==false)return result('REVIEW_REQUIRED',expectedKind,{reason:'INFERENCE_FORBIDDEN_FOR_DIRECT_EVIDENCE',observed_value:clean(evidence.value),inference_used:evidence.inference_used??null});
  if(!clean(evidence.value))return result('REVIEW_REQUIRED',expectedKind,{reason:'DIRECT_EVIDENCE_VALUE_MISSING',observed_value:null});
  if(!clean(evidence.source_image_ref))return result('REVIEW_REQUIRED',expectedKind,{reason:'SOURCE_IMAGE_REF_MISSING',observed_value:clean(evidence.value)});
  if(!finiteConfidence(evidence.confidence))return result('REVIEW_REQUIRED',expectedKind,{reason:'CONFIDENCE_INVALID',observed_value:clean(evidence.value)});
  return result('MATCH',expectedKind,{reason:'DIRECT_EVIDENCE_STRUCTURALLY_VALID',observed_value:clean(evidence.value),source_image_ref:clean(evidence.source_image_ref),confidence:Number(evidence.confidence),observation_basis:DIRECT_IMAGE_OBSERVATION_BASIS,inference_used:false});
}

export function evaluateTypeBerryConsistency({type=null,berry=null}={}){
  const typeDirect=inspectDirectEvidence(type,'TYPE_VISUAL');
  const berryDirect=inspectDirectEvidence(berry,'BERRY_VISUAL');
  if(typeDirect.status!=='MATCH'||berryDirect.status!=='MATCH')return result('REVIEW_REQUIRED','TYPE_BERRY_RELATION',{
    reason:'TYPE_AND_BERRY_MUST_BE_INDEPENDENTLY_OBSERVED',type_evidence:typeDirect,berry_evidence:berryDirect,
    public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  const observedType=typeDirect.observed_value;
  const observedBerryRaw=berryDirect.observed_value;
  // `葡萄果` is a legacy typo from the app's former public master, not a new
  // player inference. Canonicalize only for the public consistency comparison;
  // preserve the direct evidence value and never generate/rewrite player data.
  const observedBerry=canonicalBerryName(observedBerryRaw);
  if(!typeSet.has(observedType)||!berrySet.has(observedBerry))return result('REVIEW_REQUIRED','TYPE_BERRY_RELATION',{
    reason:!typeSet.has(observedType)?'UNKNOWN_TYPE_VISUAL':'UNKNOWN_BERRY_VISUAL',type_evidence:typeDirect,berry_evidence:berryDirect,
    observed_berry_raw:observedBerryRaw,observed_berry_canonical:observedBerry||null,
    public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  const expectedBerry=canonicalBerryName(BERRY_BY_TYPE[observedType]||null);
  if(!expectedBerry)return result('NOT_CHECKABLE','TYPE_BERRY_RELATION',{
    reason:'PUBLIC_TYPE_BERRY_RELATION_MISSING',type_evidence:typeDirect,berry_evidence:berryDirect,
    public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  if(observedBerry!==expectedBerry)return result('CONFLICT','TYPE_BERRY_RELATION',{
    reason:'TYPE_BERRY_VISUAL_CONFLICT',observed_type:observedType,observed_berry:observedBerryRaw,observed_berry_canonical:observedBerry,public_expected_berry:expectedBerry,
    type_evidence:typeDirect,berry_evidence:berryDirect,public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  return result('MATCH','TYPE_BERRY_RELATION',{
    reason:'INDEPENDENT_VISUAL_PAIR_CONSISTENT',observed_type:observedType,observed_berry:observedBerryRaw,observed_berry_canonical:observedBerry,public_expected_berry:expectedBerry,
    type_evidence:typeDirect,berry_evidence:berryDirect,public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
}

function normalizeCandidateSet(candidates){
  if(!Array.isArray(candidates))return null;
  return new Set(candidates.map(clean).filter(Boolean));
}

export function evaluateIngredientEvidence(evidence,{species=null,speciesIngredientCandidates=null,speciesIngredientResolver=publicSpeciesIngredientCandidatesForObservedName}={}){
  const direct=inspectDirectEvidence(evidence,'INGREDIENT_VISUAL');
  if(direct.status!=='MATCH')return result('REVIEW_REQUIRED','INGREDIENT_IDENTITY',{reason:direct.reason,direct_evidence:direct,auto_rewrite_player_observation:false});
  const identity=inspectIngredientIdentity(direct.observed_value);
  if(identity.status!=='MATCH')return result('REVIEW_REQUIRED','INGREDIENT_IDENTITY',{
    reason:identity.reason,direct_evidence:direct,identity,canonical_suggestion:identity.canonical_suggestion||null,
    auto_rewrite_player_observation:false,
  });
  const unlockLevel=Number(evidence?.unlock_level);
  if(![1,30,60].includes(unlockLevel))return result('REVIEW_REQUIRED','SPECIES_INGREDIENT_RELATION',{
    reason:'INGREDIENT_SLOT_LEVEL_INVALID',species:clean(species)||null,unlock_level:Number.isFinite(unlockLevel)?unlockLevel:null,
    observed_ingredient:identity.canonical_name,direct_evidence:direct,identity,auto_rewrite_player_observation:false,
  });
  let candidateResolution=null,candidateSet=normalizeCandidateSet(speciesIngredientCandidates);
  if(!candidateSet&&typeof speciesIngredientResolver==='function'){
    candidateResolution=speciesIngredientResolver(clean(species),unlockLevel);
    if(candidateResolution?.status==='MATCHABLE_PUBLIC_CANDIDATES')candidateSet=normalizeCandidateSet(candidateResolution.candidates);
    else return result('REVIEW_REQUIRED','SPECIES_INGREDIENT_RELATION',{
      reason:candidateResolution?.reason||'SPECIES_INGREDIENT_PUBLIC_AUTHORITY_UNRESOLVED',species:clean(species)||null,unlock_level:unlockLevel,
      observed_ingredient:identity.canonical_name,direct_evidence:direct,identity,species_identity:candidateResolution?.identity||null,
      public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
    });
  }
  if(!candidateSet)return result('NOT_CHECKABLE','SPECIES_INGREDIENT_RELATION',{
    reason:'SPECIES_INGREDIENT_PUBLIC_AUTHORITY_MISSING',species:clean(species)||null,unlock_level:unlockLevel,observed_ingredient:identity.canonical_name,
    direct_evidence:direct,identity,public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  if(!candidateSet.has(identity.canonical_name))return result('CONFLICT','SPECIES_INGREDIENT_RELATION',{
    reason:'SPECIES_INGREDIENT_VISUAL_CONFLICT',species:clean(species)||null,unlock_level:unlockLevel,observed_ingredient:identity.canonical_name,
    allowed_candidates:Object.freeze([...candidateSet]),direct_evidence:direct,identity,species_identity:candidateResolution?.identity||null,
    public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
  return result('MATCH','SPECIES_INGREDIENT_RELATION',{
    reason:'DIRECT_INGREDIENT_VISUAL_CONSISTENT_WITH_PUBLIC_CANDIDATES',species:clean(species)||null,unlock_level:unlockLevel,
    observed_ingredient:identity.canonical_name,allowed_candidates:Object.freeze([...candidateSet]),direct_evidence:direct,identity,
    species_identity:candidateResolution?.identity||null,public_relation_used_as:'CONSISTENCY_CHECK_ONLY',auto_rewrite_player_observation:false,
  });
}

export function evaluateSkillTextEvidence(evidence,kind){
  if(!['MAIN_SKILL_TEXT','SUBSKILL_TEXT'].includes(kind))throw new Error(`unsupported_skill_evidence_kind:${kind}`);
  const direct=inspectDirectEvidence(evidence,kind);
  if(direct.status!=='MATCH')return result('REVIEW_REQUIRED',kind,{reason:direct.reason,direct_evidence:direct,auto_rewrite_player_observation:false});
  const vocabulary=kind==='MAIN_SKILL_TEXT'?mainSkillSet:subskillSet;
  if(!vocabulary.has(direct.observed_value))return result('REVIEW_REQUIRED',kind,{
    reason:'FINITE_VOCABULARY_EXACT_MATCH_REQUIRED',observed_value:direct.observed_value,direct_evidence:direct,
    fuzzy_match_may_suggest_only:true,auto_rewrite_player_observation:false,
  });
  return result('MATCH',kind,{reason:'EXACT_FINITE_VOCABULARY_MATCH',observed_value:direct.observed_value,direct_evidence:direct,auto_rewrite_player_observation:false});
}

function aggregateStatus(checks){
  if(checks.some(row=>row.status==='CONFLICT'))return 'CONFLICT';
  if(checks.some(row=>row.status==='REVIEW_REQUIRED'||row.status==='NOT_CHECKABLE'))return 'REVIEW_REQUIRED';
  return 'MATCH';
}

export function evaluatePokemonVisualEvidence(input={},options={}){
  const checks=[];
  checks.push(evaluateTypeBerryConsistency({type:input.type,berry:input.berry}));
  const species=clean(input.species)||null;
  const injected=options.speciesIngredientCandidates;
  const publicResolver=typeof options.speciesIngredientResolver==='function'?options.speciesIngredientResolver:publicSpeciesIngredientCandidatesForObservedName;
  for(const row of input.ingredients||[]){
    const candidates=typeof injected==='function'?injected(species,Number(row?.unlock_level),row):Array.isArray(injected)?injected:null;
    checks.push(evaluateIngredientEvidence(row,{species,speciesIngredientCandidates:candidates,speciesIngredientResolver:publicResolver}));
  }
  if(input.main_skill)checks.push(evaluateSkillTextEvidence(input.main_skill,'MAIN_SKILL_TEXT'));
  for(const row of input.subskills||[])checks.push(evaluateSkillTextEvidence(row,'SUBSKILL_TEXT'));
  const status=aggregateStatus(checks);
  return Object.freeze({
    schema:POKEMON_VISUAL_EVIDENCE_SCHEMA,version:POKEMON_VISUAL_EVIDENCE_VERSION,status,
    public_relation_must_not_generate_player_observation:PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION,
    generated_player_values:Object.freeze([]),checks:Object.freeze(checks),
    safe_for_sqlite_apply:status==='MATCH',auto_rewrite_player_observation:false,
  });
}

export function assertPokemonVisualEvidenceSafeForApply(audit){
  if(!audit||audit.schema!==POKEMON_VISUAL_EVIDENCE_SCHEMA)throw new Error('POKEMON_VISUAL_EVIDENCE_PREFLIGHT_MISSING');
  if(audit.safe_for_sqlite_apply!==true||audit.status!=='MATCH')throw new Error(`POKEMON_VISUAL_EVIDENCE_BLOCKED:${audit.status||'UNKNOWN'}`);
  if((audit.generated_player_values||[]).length)throw new Error('PUBLIC_RELATION_GENERATED_PLAYER_OBSERVATION');
  return true;
}