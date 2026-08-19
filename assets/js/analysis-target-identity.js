import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';

export const ANALYSIS_TARGET_IDENTITY_VERSION='analysis-target-identity-2026-08-19-a';
export const ANALYSIS_TARGET_CONTEXT_SCHEMA='pokemon-sleep-analysis-target-context/1.0';

const TABLE_SQL=`CREATE TABLE IF NOT EXISTS image_analysis_target_binding(
  analysis_id TEXT PRIMARY KEY,
  target_mode TEXT NOT NULL,
  target_pokemon_id TEXT,
  target_pokemon_instance_id TEXT,
  capture_group_id TEXT,
  target_species_snapshot TEXT,
  target_label_snapshot TEXT,
  created_at TEXT NOT NULL
)`;
let bindingReady=false;
let activeContext=null;

const uuid=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now=()=>localIso();
const clone=value=>value?JSON.parse(JSON.stringify(value)):null;
const text=value=>String(value??'').trim();
const trace=(event,detail={})=>{
  const safe={...detail};
  delete safe.target_pokemon_id;
  delete safe.target_pokemon_instance_id;
  delete safe.capture_group_id;
  globalThis.UpdateCenterLiveDebug?.record?.(event,safe);
  globalThis.DebugTrace?.record?.('analysis_target',event,{status:'completed',details:safe});
};

function ensureBindingTable(){
  if(bindingReady)return;
  run(TABLE_SQL);
  run('CREATE INDEX IF NOT EXISTS idx_image_analysis_target_binding_instance ON image_analysis_target_binding(target_pokemon_instance_id,target_mode)');
  run('CREATE INDEX IF NOT EXISTS idx_image_analysis_target_binding_capture ON image_analysis_target_binding(capture_group_id,target_mode)');
  bindingReady=true;
}

export function listActivePokemonAnalysisTargets(){
  return rows(`SELECT pokemon_id,pokemon_instance_id,species,current_species,original_label,nickname,level,sp
    FROM pokemon WHERE status='active'
    ORDER BY CASE rating WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 WHEN 'B' THEN 4 ELSE 9 END,level DESC,species`)
    .map(row=>({
      ...row,
      target_species:row.current_species||row.species,
      target_label:row.original_label||row.nickname||row.current_species||row.species||'未命名',
    }));
}

async function ensurePokemonInstanceId(pokemonId){
  const before=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
  if(!before)throw new Error('找不到指定的既有寶可夢');
  if(before.status!=='active')throw new Error('只能將圖片綁定到目前 active 的寶可夢');
  if(text(before.pokemon_instance_id))return before;
  const instanceId=uuid('pkm');
  await snapshot(`analysis_target_identity:${pokemonId}`);
  begin();
  try{
    const at=now(),sourceUpdateId=`platform-identity:${instanceId}`;
    run('UPDATE pokemon SET pokemon_instance_id=?,last_updated_at=?,source_update_id=? WHERE pokemon_id=?',[instanceId,at,sourceUpdateId,pokemonId]);
    const after=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0];
    run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[
      pokemonId,at,'platform_identity_assigned',JSON.stringify(before),JSON.stringify(after),'v0.4.27.15：為既有寶可夢建立穩定 pokemon_instance_id，供圖片更新綁定。',sourceUpdateId,
    ]);
    commit();await persist();
    trace('analysis_target_instance_id_assigned',{mode:'existing',has_target_instance_id:true});
    return after;
  }catch(error){rollback();throw error;}
}

export async function createExistingPokemonAnalysisContext(pokemonId){
  const row=await ensurePokemonInstanceId(pokemonId);
  const context={
    schema:ANALYSIS_TARGET_CONTEXT_SCHEMA,
    version:ANALYSIS_TARGET_IDENTITY_VERSION,
    mode:'existing',
    target_pokemon_id:row.pokemon_id,
    target_pokemon_instance_id:row.pokemon_instance_id,
    capture_group_id:null,
    target_species_snapshot:row.current_species||row.species||null,
    target_label_snapshot:row.original_label||row.nickname||row.current_species||row.species||null,
    created_at:now(),
    provider_visible:false,
  };
  trace('analysis_target_context_created',{mode:'existing',has_target_instance_id:true,provider_visible:false});
  return Object.freeze(context);
}

export function createNewPokemonAnalysisContext(){
  const context={
    schema:ANALYSIS_TARGET_CONTEXT_SCHEMA,
    version:ANALYSIS_TARGET_IDENTITY_VERSION,
    mode:'new',
    target_pokemon_id:null,
    target_pokemon_instance_id:null,
    capture_group_id:uuid('capture'),
    target_species_snapshot:null,
    target_label_snapshot:null,
    created_at:now(),
    provider_visible:false,
  };
  trace('analysis_target_context_created',{mode:'new',has_capture_group:true,provider_visible:false});
  return Object.freeze(context);
}

export function setActiveAnalysisTargetContext(context){
  activeContext=context?clone(context):null;
  globalThis.PokemonSleepAnalysisTargetContext=activeContext?Object.freeze(clone(activeContext)):null;
  trace('analysis_target_context_activated',{mode:activeContext?.mode||null,active:Boolean(activeContext),provider_visible:false});
  return getActiveAnalysisTargetContext();
}

export function clearActiveAnalysisTargetContext(){
  const previous=activeContext?.mode||null;
  activeContext=null;
  globalThis.PokemonSleepAnalysisTargetContext=null;
  trace('analysis_target_context_cleared',{previous_mode:previous});
}

export function getActiveAnalysisTargetContext(){return clone(activeContext);}

export function analysisTargetIdentityKey(context){
  if(!context)return null;
  if(context.mode==='existing'&&text(context.target_pokemon_instance_id))return `existing:${context.target_pokemon_instance_id}`;
  if(context.mode==='new'&&text(context.capture_group_id))return `new:${context.capture_group_id}`;
  return null;
}

export function resolveRevisionAnalysisTarget(revision){
  if(revision?.identity_context)return clone(revision.identity_context);
  if(!revision?.analysis_id)return null;
  ensureBindingTable();
  const row=rows('SELECT * FROM image_analysis_target_binding WHERE analysis_id=?',[revision.analysis_id])[0]||null;
  if(!row)return null;
  return {
    schema:ANALYSIS_TARGET_CONTEXT_SCHEMA,
    version:ANALYSIS_TARGET_IDENTITY_VERSION,
    mode:row.target_mode,
    target_pokemon_id:row.target_pokemon_id||null,
    target_pokemon_instance_id:row.target_pokemon_instance_id||null,
    capture_group_id:row.capture_group_id||null,
    target_species_snapshot:row.target_species_snapshot||null,
    target_label_snapshot:row.target_label_snapshot||null,
    created_at:row.created_at,
    provider_visible:false,
  };
}

function bindRevisionToActiveContext(revision){
  if(!revision||!activeContext)return;
  ensureBindingTable();
  const context=clone(activeContext);
  revision.identity_context=context;
  run(`INSERT OR REPLACE INTO image_analysis_target_binding(
    analysis_id,target_mode,target_pokemon_id,target_pokemon_instance_id,capture_group_id,target_species_snapshot,target_label_snapshot,created_at
  ) VALUES(?,?,?,?,?,?,?,?)`,[
    revision.analysis_id,context.mode,context.target_pokemon_id,context.target_pokemon_instance_id,context.capture_group_id,
    context.target_species_snapshot,context.target_label_snapshot,context.created_at||now(),
  ]);
  persist().catch(()=>{});
  trace('analysis_revision_platform_identity_bound',{mode:context.mode,analysis_type:revision.analysis_type||null,has_target_instance_id:Boolean(context.target_pokemon_instance_id),has_capture_group:Boolean(context.capture_group_id)});
}

globalThis.addEventListener?.('pokemon-sleep:analysis-revision-saved',event=>bindRevisionToActiveContext(event.detail?.revision||event.detail||null));
globalThis.PokemonSleepAnalysisTargetIdentity={
  version:ANALYSIS_TARGET_IDENTITY_VERSION,
  listActivePokemonAnalysisTargets,
  createExistingPokemonAnalysisContext,
  createNewPokemonAnalysisContext,
  setActiveAnalysisTargetContext,
  clearActiveAnalysisTargetContext,
  getActiveAnalysisTargetContext,
  analysisTargetIdentityKey,
  resolveRevisionAnalysisTarget,
};

export {TABLE_SQL};
