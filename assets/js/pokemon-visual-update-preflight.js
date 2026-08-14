import {
  POKEMON_VISUAL_EVIDENCE_VERSION,
  evaluatePokemonVisualEvidence,
} from './pokemon-visual-evidence-contract.js';

export const POKEMON_VISUAL_UPDATE_MANIFEST_SCHEMA='pokemon-sleep-pokemon-visual-evidence-manifest/1.0';
export const POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA='pokemon-sleep-pokemon-visual-update-preflight/1.0';
export const POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION='pokemon-visual-update-preflight-2026-08-15-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

function aggregateStatus(audits){
  if(audits.some(row=>row.audit.status==='CONFLICT'))return 'CONFLICT';
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

export function evaluatePokemonVisualUpdateManifest(manifest,{speciesIngredientCandidates=null}={}){
  if(!isPokemonVisualEvidenceManifest(manifest))return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
    reason:'VISUAL_EVIDENCE_MANIFEST_INVALID',audits:Object.freeze([]),generated_player_values:Object.freeze([]),
  });
  if(manifest.contract_version!==POKEMON_VISUAL_EVIDENCE_VERSION)return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
    reason:'VISUAL_EVIDENCE_CONTRACT_VERSION_MISMATCH',audits:Object.freeze([]),generated_player_values:Object.freeze([]),
  });
  if(manifest.public_relation_may_generate_player_observation!==false)return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
    reason:'PUBLIC_RELATION_PLAYER_GENERATION_POLICY_INVALID',audits:Object.freeze([]),generated_player_values:Object.freeze([]),
  });
  if(!Array.isArray(manifest.observations)||!manifest.observations.length)return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'REVIEW_REQUIRED',safe_for_sqlite_apply:false,
    reason:'VISUAL_EVIDENCE_OBSERVATIONS_MISSING',audits:Object.freeze([]),generated_player_values:Object.freeze([]),
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
      audits:Object.freeze(audits),generated_player_values:Object.freeze([]),
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
  const status=aggregateStatus(audits);
  return Object.freeze({
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status,
    safe_for_sqlite_apply:status==='MATCH',
    reason:status==='MATCH'?'ALL_DECLARED_VISUAL_EVIDENCE_MATCH':'DECLARED_VISUAL_EVIDENCE_NOT_SAFE_FOR_APPLY',
    audits:Object.freeze(audits),
    generated_player_values:Object.freeze([]),
    public_relation_may_generate_player_observation:false,
  });
}

export function evaluatePokemonVisualUpdatePackage(payload,options={}){
  const manifest=payload?.pokemon_visual_evidence_manifest;
  if(manifest==null)return Object.freeze({
    declared:false,
    legacy_compatible:true,
    schema:POKEMON_VISUAL_UPDATE_PREFLIGHT_SCHEMA,
    version:POKEMON_VISUAL_UPDATE_PREFLIGHT_VERSION,
    status:'LEGACY_NOT_DECLARED',safe_for_sqlite_apply:null,
    reason:'LEGACY_UPDATE_PACKAGE_WITHOUT_VISUAL_MANIFEST',audits:Object.freeze([]),generated_player_values:Object.freeze([]),
  });
  const result=evaluatePokemonVisualUpdateManifest(manifest,options);
  return Object.freeze({...result,declared:true,legacy_compatible:false});
}

export function assertPokemonVisualUpdatePackageSafe(payload,options={}){
  const result=evaluatePokemonVisualUpdatePackage(payload,options);
  if(!result.declared)return result;
  if(result.status!=='MATCH'||result.safe_for_sqlite_apply!==true)throw new Error(`POKEMON_VISUAL_UPDATE_PREFLIGHT_BLOCKED:${result.status}:${result.reason}`);
  if((result.generated_player_values||[]).length)throw new Error('PUBLIC_RELATION_GENERATED_PLAYER_OBSERVATION');
  return result;
}
