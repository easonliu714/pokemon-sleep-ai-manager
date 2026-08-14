import {
  POKEMON_VISUAL_EVIDENCE_VERSION,
  evaluatePokemonVisualEvidence,
} from './pokemon-visual-evidence-contract.js';

export const POKEMON_VISUAL_UPDATE_MANIFEST_SCHEMA='pokemon-sleep-pokemon-visual-evidence-manifest/1.0';
export const POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA='pokemon-sleep-pokemon-visual-update-preflight/1.0';
export const POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION='pokemon-visual-update-preflight-2026-08-15-b-operation-binding';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();
const meaningful=value=>value!==null&&value!==undefined&&clean(value)!=='';

function aggregateStatus(audits,bindingConflicts=[]){
  if(bindingConflicts.length||audits.some(row=>row.audit.status==='CONFLICT'))return 'CONFLICT';
  if(audits.some(row=>row.audit.status!=='MATCH'))return 'REVIEW_REQUIRED';
  return 'MATCH';
}

export function buildPokemonVisualEvidenceManifest(observations=[]){
  return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_MANIFEST_SCHEMA,
    contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
    source_kind:'SCREENSHOT_DERIVED',
    public_relation_may_generate_player_observation:false,
    observations:Object.freeze((Array.isArray(observations)?observations:[]).map(row=>Object.freeze(clone(row)))),
  });
}

export function isPokemonVisualEvidenceManifest(value){
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&value.schema===POKEMON_VISUAL_UPDATE_MANIFEST_SCHEMA);
}

function manifestIsStructurallyValid(manifest){
  if(!isPokemonVisualEvidenceManifest(manifest))return 'VISUAL_EVIDENCE_MANIFEST_INVALID';
  if(manifest.contract_version!==POKEMON_VISUAL_EVIDENCE_VERSION)return 'VISUAL_EVIDENCE_CONTRACT_VERSION_MISMATCH';
  if(manifest.public_relation_may_generate_player_observation!==false)return 'PUBLIC_RELATION_PLAYER_GENERATION_POLICY_INVALID';
  if(!Array.isArray(manifest.observations)||!manifest.observations.length)return 'VISUAL_EVIDENCE_OBSERVATIONS_MISSING';
  return null;
}

function evidenceValue(evidence){return clean(evidence?.value);}
function slotMap(rows){
  const out=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const level=Number(row?.unlock_level);
    if(Number.isFinite(level))out.set(level,row);
  }
  return out;
}

function operationBindingConflicts(payload,manifest){
  const conflicts=[];
  const manifestByPokemon=new Map((manifest?.observations||[]).filter(row=>clean(row?.pokemon_id)).map(row=>[clean(row.pokemon_id),row]));
  const pokemonOperations=(payload?.operations||[]).filter(op=>['pokemon','pokemon_ingredients','pokemon_subskills'].includes(op?.entity));
  for(const [index,operation] of pokemonOperations.entries()){
    const pokemonId=clean(operation?.key?.pokemon_id);
    if(!pokemonId){conflicts.push(`OPERATION_BINDING_POKEMON_ID_MISSING:${index}`);continue;}
    const row=manifestByPokemon.get(pokemonId);
    if(!row){conflicts.push(`VISUAL_MANIFEST_ROW_MISSING_FOR_POKEMON:${pokemonId}`);continue;}
    if(operation.entity==='pokemon'){
      for(const [field,evidenceKey] of [['type','type'],['favorite_berry','berry'],['main_skill','main_skill']]){
        const incoming=operation?.data?.[field];
        if(!meaningful(incoming))continue;
        const observed=evidenceValue(row?.[evidenceKey]);
        if(!observed)conflicts.push(`DIRECT_EVIDENCE_MISSING_FOR_WRITE:${pokemonId}:${field}`);
        else if(clean(incoming)!==observed)conflicts.push(`DIRECT_EVIDENCE_OPERATION_MISMATCH:${pokemonId}:${field}:${observed}:${clean(incoming)}`);
      }
    }else if(operation.entity==='pokemon_ingredients'){
      const level=Number(operation?.key?.unlock_level);
      const observedRow=slotMap(row?.ingredients).get(level);
      const incoming=operation?.data?.ingredient_name;
      if(meaningful(incoming)){
        const observed=evidenceValue(observedRow);
        if(!observed)conflicts.push(`DIRECT_EVIDENCE_MISSING_FOR_WRITE:${pokemonId}:ingredient:${level}`);
        else if(clean(incoming)!==observed)conflicts.push(`DIRECT_EVIDENCE_OPERATION_MISMATCH:${pokemonId}:ingredient:${level}:${observed}:${clean(incoming)}`);
      }
    }else if(operation.entity==='pokemon_subskills'){
      const level=Number(operation?.key?.unlock_level);
      const observedRow=slotMap(row?.subskills).get(level);
      const incoming=operation?.data?.subskill_name;
      if(meaningful(incoming)){
        const observed=evidenceValue(observedRow);
        if(!observed)conflicts.push(`DIRECT_EVIDENCE_MISSING_FOR_WRITE:${pokemonId}:subskill:${level}`);
        else if(clean(incoming)!==observed)conflicts.push(`DIRECT_EVIDENCE_OPERATION_MISMATCH:${pokemonId}:subskill:${level}:${observed}:${clean(incoming)}`);
      }
    }
  }
  return conflicts;
}

export function evaluatePokemonVisualUpdateManifest(manifest,{speciesIngredientCandidates=null,payload=null}={}){
  const structuralError=manifestIsStructurallyValid(manifest);
  if(structuralError)return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
    reason:structuralError,audits:Object.freeze([]),binding_conflicts:Object.freeze([]),generated_player_values:Object.freeze([]),
  });
  const refs=new Set();
  const audits=[];
  for(const [index,row] of manifest.observations.entries()){
    const observationRef=clean(row?.observation_ref)||`visual-observation-${index+1}`;
    if(refs.has(observationRef))return Object.freeze({
      schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
      version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
      status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
      reason:`VISUAL_EVIDENCE_OBSERVATION_REF_DUPLICATE:${observationRef}`,
      audits:Object.freeze(audits),binding_conflicts:Object.freeze([]),generated_player_values:Object.freeze([]),
    });
    refs.add(observationRef);
    const audit=evaluatePokemonVisualEvidence({
      species:row?.species||null,
      type:row?.type||null,
      berry:row?.berry||null,
      ingredients:Array.isArray(row?.ingredients)?row.ingredients:[],
      main_skill:row?.main_skill||null,
      subskills:Array.isArray(row?.subskills)?row.subskills:[],
    },{speciesIngredientCandidates});
    audits.push(Object.freeze({observation_ref:observationRef,pokemon_id:clean(row?.pokemon_id)||null,audit}));
  }
  const bindingConflicts=payload?operationBindingConflicts(payload,manifest):[];
  const status=aggregateStatus(audits,bindingConflicts);
  return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status,
    safe_for_sqlite_apply:status==='MATCH',
    reason:bindingConflicts.length?'VISUAL_EVIDENCE_OPERATION_BINDING_CONFLICT':status==='MATCH'?'ALL_DECLARED_VISUAL_EVIDENCE_MATCH':'DECLARED_VISUAL_EVIDENCE_NOT_SAFE_FOR_APPLY',
    audits:Object.freeze(audits),
    binding_conflicts:Object.freeze(bindingConflicts),
    generated_player_values:Object.freeze([]),
    public_relation_may_generate_player_observation:false,
  });
}

export function pokemonVisualManifestRequired(payload){
  if(payload?.pokemon_visual_evidence_required===true)return true;
  if(payload?.reaudit_contract?.contract==='pokemon-75-source-screenshot-reaudit/1.0')return true;
  return false;
}

export function evaluatePokemonVisualUpdatePackage(payload,options={}){
  const manifest=payload?.pokemon_visual_evidence_manifest;
  const required=pokemonVisualManifestRequired(payload);
  if(manifest==null){
    if(required)return Object.freeze({
      declared:false,required:true,legacy_compatible:false,
      schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
      status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
      reason:'REQUIRED_VISUAL_EVIDENCE_MANIFEST_MISSING',audits:Object.freeze([]),binding_conflicts:Object.freeze([]),generated_player_values:Object.freeze([]),
    });
    return Object.freeze({
      declared:false,required:false,legacy_compatible:true,
      schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
      status:'LEGACY_NOT_DECLARED',safe_for_sqlite_apply:null,
      reason:'LEGACY_UPDATE_PACKAGE_WITHOUT_VISUAL_MANIFEST',audits:Object.freeze([]),binding_conflicts:Object.freeze([]),generated_player_values:Object.freeze([]),
    });
  }
  const result=evaluatePokemonVisualUpdateManifest(manifest,{...options,payload});
  return Object.freeze({...result,declared:true,required,legacy_compatible:false});
}

export function assertPokemonVisualUpdatePackageSafe(payload,options={}){
  const result=evaluatePokemonVisualUpdatePackage(payload,options);
  if(!result.declared&&!result.required)return result;
  if(result.status!=='MATCH'||result.safe_for_sqlite_apply!==true)throw new Error(`POKEMON_VISUAL_UPDATE_PREFLIGHT_BLOCKED:${result.status}:${result.reason}`);
  if((result.generated_player_values||[]).length)throw new Error('PUBLIC_RELATION_GENERATED_PLAYER_OBSERVATION');
  return result;
}
