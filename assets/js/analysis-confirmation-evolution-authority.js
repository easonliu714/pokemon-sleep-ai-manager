import {PUBLIC_MAIN_SKILL_MASTER} from './public-pokemon-knowledge-master.js';
import {rows as dbRows,run,begin,commit,rollback,persist,snapshot} from './database.js';

export const V04278_EVOLUTION_REQUIREMENT_MASTER_VERSION='pokemon-evolution-requirement-2026-08-18-a';
export const PLAYER_EVOLUTION_OVERRIDE_VERSION='pokemon-sleep-player-evolution-override/1.0-v042721';

export const PLAYER_EVOLUTION_OVERRIDE_TABLE_SQL=`CREATE TABLE IF NOT EXISTS pokemon_evolution_override(
  pokemon_id TEXT PRIMARY KEY,
  authority_mode TEXT NOT NULL,
  override_status TEXT,
  target_override TEXT,
  override_reason TEXT,
  required_level INTEGER,
  required_sleep_hours REAL,
  required_candy INTEGER,
  required_item TEXT,
  other_requirement TEXT,
  source_analysis_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export const V04278_EVOLUTION_REQUIREMENT_MASTER=Object.freeze([
  Object.freeze({
    species_name:'小鍛匠',
    required_level:18,
    required_sleep_hours:null,
    required_candy:40,
    required_item:null,
    other_requirement:null,
    requirement_states:Object.freeze({
      required_level:'REQUIRED_VERIFIED',
      required_sleep_hours:'VERIFIED_NOT_REQUIRED',
      required_candy:'REQUIRED_VERIFIED',
      required_item:'VERIFIED_NOT_REQUIRED',
      other_requirement:'VERIFIED_NOT_REQUIRED',
    }),
    verification_status:'DIRECT_GAME_UI_REQUIREMENT_VERIFIED_TARGET_PENDING',
    source_type:'direct_game_ui_verified',
    source_name:'Pokémon Sleep in-game evolution requirement screen',
    source_ref:'DIRECT_GAME_UI_2026-08-18_TINKATINK_REQUIREMENT',
    verified_at:'2026-08-18',
    data_version:V04278_EVOLUTION_REQUIREMENT_MASTER_VERSION,
  }),
]);

const FIELD_MAP=Object.freeze([
  ['evolution_level_required','required_level'],
  ['evolution_sleep_hours_required','required_sleep_hours'],
  ['evolution_candy_required','required_candy'],
  ['evolution_item_required','required_item'],
  ['evolution_other_requirement','other_requirement'],
]);
const DISPLAY_NOT_REQUIRED='不需要（公版已驗證）';
const PUBLIC_MASTER='PUBLIC_MASTER';
const PLAYER_OVERRIDE='PLAYER_OVERRIDE';
const CUSTOM_REQUIREMENTS='CUSTOM_REQUIREMENTS';
const CANNOT_EVOLVE='CANNOT_EVOLVE';
const meaningful=value=>value!==null&&value!==undefined&&value!=='';
const comparable=value=>typeof value==='number'?String(value):String(value??'').trim();
const text=value=>String(value??'').trim();
const num=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nowIso=()=>new Date().toISOString();
const groupOverrideState=new Map();
const groupPublicRequirements=new Map();
let overrideTableReady=false;

function requirementHotfix(species){return V04278_EVOLUTION_REQUIREMENT_MASTER.find(row=>row.species_name===String(species||'').trim())||null;}
function safeRows(queryRows,sql,params){try{return typeof queryRows==='function'?(queryRows(sql,params)||[]):[];}catch{return [];}}
function routeRequirements(route){return Object.fromEntries(FIELD_MAP.map(([draftField,masterField])=>[draftField,route?.[masterField]??null]));}
function requirementConflicts(left,right){
  if(!left||!right)return [];
  return FIELD_MAP.flatMap(([draftField,masterField])=>meaningful(left?.[masterField])&&meaningful(right?.[masterField])&&comparable(left[masterField])!==comparable(right[masterField])?[{field:draftField,public_route_value:left[masterField],direct_requirement_value:right[masterField]}]:[]);
}
function publicSkill(name){const normalized=String(name||'').trim();return normalized?PUBLIC_MAIN_SKILL_MASTER.find(row=>row.main_skill_name===normalized)||null:null;}
function draftRequirementStates(authority){
  const source=authority?.direct_requirement?.requirement_states||{};
  return Object.fromEntries(FIELD_MAP.map(([draftField,masterField])=>[draftField,source[masterField]||'UNKNOWN']));
}
function decorateRequirementInputs(states={}){
  if(typeof document==='undefined')return;
  for(const [field,state] of Object.entries(states)){
    const nodes=document.querySelectorAll?.(`[data-field="${field}"],[name="${field}"],#${field}`)||[];
    for(const node of nodes){
      if(state==='VERIFIED_NOT_REQUIRED'&&!meaningful(node.value)){
        node.placeholder=DISPLAY_NOT_REQUIRED;
        node.title=DISPLAY_NOT_REQUIRED;
        node.dataset.publicRequirementState='VERIFIED_NOT_REQUIRED';
      }else if(node?.dataset?.publicRequirementState){
        delete node.dataset.publicRequirementState;
        if(node.placeholder===DISPLAY_NOT_REQUIRED)node.placeholder='';
      }
    }
  }
}
function scheduleRequirementDisplay(states){if(typeof queueMicrotask==='function')queueMicrotask(()=>decorateRequirementInputs(states));else if(typeof setTimeout==='function')setTimeout(()=>decorateRequirementInputs(states),0);}

function ensurePlayerOverrideTable(){
  if(overrideTableReady)return true;
  try{
    run(PLAYER_EVOLUTION_OVERRIDE_TABLE_SQL);
    overrideTableReady=true;
    Promise.resolve(persist()).catch(()=>{});
    return true;
  }catch{return false;}
}
function readOverrideRow(pokemonId){
  if(!text(pokemonId)||!ensurePlayerOverrideTable())return null;
  try{return dbRows('SELECT * FROM pokemon_evolution_override WHERE pokemon_id=?',[pokemonId])[0]||null;}catch{return null;}
}
function requirementFieldsFrom(source={}){
  return {
    evolution_level_required:num(source.evolution_level_required??source.required_level),
    evolution_sleep_hours_required:num(source.evolution_sleep_hours_required??source.required_sleep_hours),
    evolution_candy_required:num(source.evolution_candy_required??source.required_candy),
    evolution_item_required:text(source.evolution_item_required??source.required_item),
    evolution_other_requirement:text(source.evolution_other_requirement??source.other_requirement),
  };
}
function draftHasExplicitOverrideMode(draft){
  return Object.prototype.hasOwnProperty.call(draft||{},'evolution_authority_mode')&&[PUBLIC_MASTER,PLAYER_OVERRIDE].includes(text(draft?.evolution_authority_mode));
}
export function normalizePlayerEvolutionOverride(source={}){
  const mode=text(source.evolution_authority_mode??source.authority_mode);
  const authorityMode=mode===PLAYER_OVERRIDE?PLAYER_OVERRIDE:PUBLIC_MASTER;
  const rawStatus=text(source.evolution_override_status??source.override_status);
  const status=authorityMode===PLAYER_OVERRIDE?(rawStatus===CANNOT_EVOLVE?CANNOT_EVOLVE:CUSTOM_REQUIREMENTS):null;
  const requirements=status===CANNOT_EVOLVE?{
    evolution_level_required:null,
    evolution_sleep_hours_required:null,
    evolution_candy_required:null,
    evolution_item_required:'',
    evolution_other_requirement:'',
  }:requirementFieldsFrom(source);
  return {
    evolution_authority_mode:authorityMode,
    evolution_override_status:status,
    evolution_target_override:authorityMode===PLAYER_OVERRIDE?text(source.evolution_target_override??source.target_override):'',
    evolution_override_reason:authorityMode===PLAYER_OVERRIDE?text(source.evolution_override_reason??source.override_reason):'',
    ...requirements,
  };
}
export function getPersistedPlayerEvolutionOverride(pokemonId){
  const row=readOverrideRow(pokemonId);return row?normalizePlayerEvolutionOverride(row):null;
}
function overrideForDraft(draft={}){
  if(draftHasExplicitOverrideMode(draft))return normalizePlayerEvolutionOverride(draft);
  const pokemonId=text(draft?.analysis_target_context?.target_pokemon_id);
  const persisted=getPersistedPlayerEvolutionOverride(pokemonId);
  return persisted||normalizePlayerEvolutionOverride({evolution_authority_mode:PUBLIC_MASTER});
}

export function resolveEvolutionAuthority(species,queryRows){
  const normalized=String(species||'').trim();
  if(!normalized)return {status:'SPECIES_UNRESOLVED',species:null,requirements:{},conflicts:[]};
  const routes=safeRows(queryRows,'SELECT from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,other_requirement,verification_status,source_type,source_name,source_ref,verified_at,data_version FROM pokemon_evolution_master WHERE from_species=? ORDER BY to_species',[normalized]);
  const terminal=safeRows(queryRows,'SELECT species_name,evolution_status,verification_status,source_type,source_name,source_ref,verified_at,data_version FROM pokemon_evolution_status_master WHERE species_name=?',[normalized])[0]||null;
  const direct=requirementHotfix(normalized);
  if(routes.length>1)return {status:'MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED',species:normalized,routes,terminal,direct_requirement:direct,requirements:{},conflicts:[]};
  if(routes.length===1){
    const route=routes[0],conflicts=requirementConflicts(route,direct);
    if(conflicts.length)return {status:'REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT',species:normalized,routes,route,terminal,direct_requirement:direct,requirements:{},conflicts};
    const requirements=routeRequirements(route);
    if(direct)for(const [draftField,masterField] of FIELD_MAP)if(!meaningful(requirements[draftField])&&meaningful(direct[masterField]))requirements[draftField]=direct[masterField];
    return {status:direct?'PUBLIC_ROUTE_PLUS_DIRECT_REQUIREMENT_VERIFIED':'PUBLIC_ROUTE_VERIFIED',species:normalized,routes,route,terminal,direct_requirement:direct,requirements,conflicts:[]};
  }
  if(direct)return {status:'PUBLIC_REQUIREMENT_HOTFIX_VERIFIED_ROUTE_PENDING',species:normalized,routes:[],route:null,terminal,direct_requirement:direct,requirements:routeRequirements(direct),conflicts:[]};
  if(terminal?.evolution_status==='VERIFIED_TERMINAL_CURRENT_SLEEP')return {status:'VERIFIED_TERMINAL_CURRENT_SLEEP',species:normalized,routes:[],route:null,terminal,direct_requirement:null,requirements:{},conflicts:[]};
  return {status:'PUBLIC_MASTER_NOT_YET_VERIFIED',species:normalized,routes:[],route:null,terminal,direct_requirement:null,requirements:{},conflicts:[]};
}

export function hydrateEvolutionDraft(draft,authority){
  const next={...(draft||{}),field_evidence:{...(draft?.field_evidence||{})}};
  const skill=publicSkill(next.main_skill);
  if(skill&&!meaningful(next.main_skill_description)){
    next.main_skill_description=skill.description_zh_tw;
    next.field_evidence.main_skill_description={status:'PUBLIC_MASTER_HYDRATED',observation_basis:'PUBLIC_MASTER',inference_used:false,main_skill_name:skill.main_skill_name,verification_status:skill.verification_status,source_type:skill.source_type,source_name:skill.source_name,source_ref:skill.source_ref,verified_at:skill.verified_at,data_version:skill.data_version};
  }

  const playerOverride=overrideForDraft(next);
  const baseStatus=authority?.status||'PUBLIC_MASTER_NOT_YET_VERIFIED';
  if(playerOverride.evolution_authority_mode===PLAYER_OVERRIDE){
    Object.assign(next,playerOverride);
    const publicRequirements=clone(authority?.requirements||{});
    const status=playerOverride.evolution_override_status===CANNOT_EVOLVE?'PLAYER_OVERRIDE_CANNOT_EVOLVE':'PLAYER_OVERRIDE_CUSTOM_REQUIREMENTS';
    next.evolution_authority={
      status,
      base_status:baseStatus,
      species:authority?.species||next.species||null,
      to_species:null,
      public_to_species:authority?.route?.to_species||null,
      public_requirements:publicRequirements,
      verification_status:'PLAYER_CONFIRMED_INSTANCE_OVERRIDE',
      data_version:PLAYER_EVOLUTION_OVERRIDE_VERSION,
      requirement_states:{},
      display_not_required:DISPLAY_NOT_REQUIRED,
      conflicts:[],
      authority_mode:PLAYER_OVERRIDE,
      override_status:playerOverride.evolution_override_status,
      target_override:playerOverride.evolution_target_override||null,
      override_reason:playerOverride.evolution_override_reason||null,
      public_master_reference_only:true,
    };
    next.field_evidence.evolution_authority={...next.evolution_authority,source_type:'player_local_override',source_name:'Player confirmation',source_ref:'PLAYER_SQLITE_EVOLUTION_OVERRIDE',verified_at:null};
    return next;
  }

  next.evolution_authority_mode=PUBLIC_MASTER;
  next.evolution_override_status='';
  next.evolution_target_override='';
  next.evolution_override_reason='';
  const blocked=['MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED','REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT','SPECIES_UNRESOLVED'].includes(baseStatus);
  const observationConflicts=[];
  if(!blocked){
    for(const [field] of FIELD_MAP){
      const masterValue=authority?.requirements?.[field];if(!meaningful(masterValue))continue;
      if(!meaningful(next[field]))next[field]=masterValue;
      else if(comparable(next[field])!==comparable(masterValue))observationConflicts.push({field,observation_value:next[field],public_master_value:masterValue});
    }
  }
  let status=baseStatus;
  if(observationConflicts.length)status='REVIEW_REQUIRED_OBSERVATION_MASTER_CONFLICT';
  else if(!blocked&&FIELD_MAP.some(([field])=>meaningful(authority?.requirements?.[field])))status='MASTER_HYDRATED';
  const requirementStates=draftRequirementStates(authority);
  next.evolution_authority={status,base_status:baseStatus,species:authority?.species||next.species||null,to_species:authority?.route?.to_species||null,verification_status:authority?.route?.verification_status||authority?.direct_requirement?.verification_status||authority?.terminal?.verification_status||null,data_version:authority?.route?.data_version||authority?.direct_requirement?.data_version||authority?.terminal?.data_version||null,requirement_states:requirementStates,display_not_required:DISPLAY_NOT_REQUIRED,conflicts:[...(authority?.conflicts||[]),...observationConflicts],authority_mode:PUBLIC_MASTER,public_master_reference_only:false};
  next.field_evidence.evolution_authority={...next.evolution_authority,source_type:authority?.route?.source_type||authority?.direct_requirement?.source_type||authority?.terminal?.source_type||null,source_name:authority?.route?.source_name||authority?.direct_requirement?.source_name||authority?.terminal?.source_name||null,source_ref:authority?.route?.source_ref||authority?.direct_requirement?.source_ref||authority?.terminal?.source_ref||null,verified_at:authority?.route?.verified_at||authority?.direct_requirement?.verified_at||authority?.terminal?.verified_at||null};
  scheduleRequirementDisplay(requirementStates);
  return next;
}

export function evolutionAuthorityLabel(authority){
  const row=authority||{};
  if(row.status==='PLAYER_OVERRIDE_CANNOT_EVOLVE'){
    const reason=row.override_reason?` 原因：${row.override_reason}`:'';
    const publicRef=row.public_to_species?` 公版「${row.species} → ${row.public_to_species}」僅供參考，不會套用到此個體。`:' 公版進化 Master 僅供參考。';
    return `玩家個體人工覆寫生效：此特殊個體無法進化。${reason}${publicRef}`;
  }
  if(row.status==='PLAYER_OVERRIDE_CUSTOM_REQUIREMENTS'){
    const target=row.target_override?` 人工目標：${row.target_override}。`:'';
    return `玩家個體人工覆寫生效：自訂進化條件為有效 Authority。${target} 公版進化 Master 僅供參考，不會覆寫此個體。`;
  }
  const notRequired=Object.entries(row.requirement_states||{}).filter(([,state])=>state==='VERIFIED_NOT_REQUIRED').map(([field])=>field==='evolution_sleep_hours_required'?'一起睡覺時間':field==='evolution_item_required'?'進化道具':field==='evolution_other_requirement'?'其他條件':field).filter(Boolean);
  const suffix=notRequired.length?` ${notRequired.join('／')}：${DISPLAY_NOT_REQUIRED}。`:'';
  if(row.status==='MASTER_HYDRATED'){
    if(row.base_status==='PUBLIC_REQUIREMENT_HOTFIX_VERIFIED_ROUTE_PENDING')return `公版進化條件已帶入；進化目標 Route 尚待核對。${suffix}`;
    return (row.to_species?`公版進化 Master 已帶入（下一階段：${row.to_species}）。`:'公版進化 Master 已帶入。')+suffix;
  }
  if(row.status==='REVIEW_REQUIRED_OBSERVATION_MASTER_CONFLICT')return '圖片／AI Observation 與公版進化條件衝突，需人工確認；系統未覆寫 Observation。';
  if(row.status==='MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED')return '此物種有多條公版進化 Route，系統不自動猜測條件。';
  if(row.status==='REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT')return '公版進化 Evidence 彼此衝突，已停止自動帶入。';
  if(row.status==='VERIFIED_TERMINAL_CURRENT_SLEEP')return '公版目前確認為 Pokémon Sleep 最終進化型。';
  if(row.status==='SPECIES_UNRESOLVED')return '物種尚未確認，暫不查詢公版進化條件。';
  return '公版進化條件尚未收錄／待核對；系統不會自行猜測。';
}

function requirementInputs(form){return Object.fromEntries(FIELD_MAP.map(([field])=>[field,form?.querySelector?.(`[data-field="${field}"]`)||null]));}
function readRequirementsFromForm(form){
  const nodes=requirementInputs(form);
  return {
    evolution_level_required:num(nodes.evolution_level_required?.value),
    evolution_sleep_hours_required:num(nodes.evolution_sleep_hours_required?.value),
    evolution_candy_required:num(nodes.evolution_candy_required?.value),
    evolution_item_required:text(nodes.evolution_item_required?.value),
    evolution_other_requirement:text(nodes.evolution_other_requirement?.value),
  };
}
function writeRequirementsToForm(form,values={},disabled=false){
  const nodes=requirementInputs(form);
  for(const [field,node] of Object.entries(nodes)){
    if(!node)continue;
    const value=values?.[field];node.value=value===null||value===undefined?'':String(value);node.disabled=Boolean(disabled);
    if(disabled)node.dataset.playerEvolutionOverrideLocked='1';else delete node.dataset.playerEvolutionOverrideLocked;
  }
}
function publicRequirementsForSpecies(species){try{return requirementFieldsFrom(resolveEvolutionAuthority(species,dbRows).requirements||{});}catch{return requirementFieldsFrom({});}}
function currentForm(){return globalThis.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||null;}
function formGroupId(form,detail={}){return text(detail.group_id||form?.dataset?.v042718GroupId||'');}
function draftTargetPokemonId(draft={}){return text(draft?.analysis_target_context?.target_pokemon_id);}

function createOverridePanel(form,state,groupId){
  let panel=form.querySelector('#playerEvolutionOverridePanel');
  if(!panel){panel=document.createElement('section');panel.id='playerEvolutionOverridePanel';panel.className='panel';form.querySelector('[data-evolution-authority-status]')?.insertAdjacentElement('afterend',panel);}
  panel.dataset.groupId=groupId;
  panel.innerHTML=`<h4>此個體的進化 Authority</h4><div class="notice"><strong>玩家覆寫只作用於這一隻寶可夢。</strong><br>特殊造型、活動個體或其他例外可改用人工 Authority；不會修改公版 Master，也不會影響其他同物種寶可夢。</div><div class="edit-grid"><label class="edit-field"><span>進化條件來源</span><select data-field="evolution_authority_mode" id="evolutionAuthorityMode"><option value="${PUBLIC_MASTER}">使用公版進化條件</option><option value="${PLAYER_OVERRIDE}">使用玩家人工覆寫</option></select></label><label class="edit-field" data-override-only><span>人工覆寫狀態</span><select data-field="evolution_override_status" id="evolutionOverrideStatus"><option value="${CUSTOM_REQUIREMENTS}">自訂進化條件</option><option value="${CANNOT_EVOLVE}">此特殊個體無法進化</option></select></label><label class="edit-field" data-override-only><span>人工進化目標（選填）</span><input data-field="evolution_target_override" id="evolutionTargetOverride" value="${esc(state.evolution_target_override||'')}"></label><label class="edit-field" data-override-only><span>人工覆寫原因（選填）</span><input data-field="evolution_override_reason" id="evolutionOverrideReason" value="${esc(state.evolution_override_reason||'')}"></label></div><div class="notice success" id="playerEvolutionOverrideEffective"></div>`;
  panel.querySelector('#evolutionAuthorityMode').value=state.evolution_authority_mode||PUBLIC_MASTER;panel.querySelector('#evolutionOverrideStatus').value=state.evolution_override_status||CUSTOM_REQUIREMENTS;panel.querySelector('#evolutionTargetOverride').value=state.evolution_target_override||'';panel.querySelector('#evolutionOverrideReason').value=state.evolution_override_reason||'';return panel;
}
function updatePublicNotice(form,state){
  const notice=form.querySelector('[data-evolution-authority-status]');if(!notice)return;const title=notice.querySelector('strong');
  if(state.evolution_authority_mode===PLAYER_OVERRIDE){if(title)title.textContent='公版進化條件（僅參考）';notice.classList.remove('success','error');notice.classList.add('notice','pending');}else if(title)title.textContent='公版進化條件';
}
function applyOverrideUi(form,state,{transition=false}={}){
  const panel=form.querySelector('#playerEvolutionOverridePanel');if(!panel)return;const player=state.evolution_authority_mode===PLAYER_OVERRIDE;panel.querySelectorAll('[data-override-only]').forEach(node=>node.classList.toggle('hidden',!player));const status=state.evolution_override_status||CUSTOM_REQUIREMENTS,cannot=player&&status===CANNOT_EVOLVE,effective=panel.querySelector('#playerEvolutionOverrideEffective');
  if(!player){writeRequirementsToForm(form,state.public_requirements||requirementFieldsFrom({}),false);if(effective)effective.textContent='目前以公版進化 Master 為有效 Authority。';}
  else if(cannot){state.custom_requirements=state.custom_requirements||readRequirementsFromForm(form);writeRequirementsToForm(form,requirementFieldsFrom({}),true);if(effective)effective.textContent='玩家覆寫生效：此特殊個體無法進化；所有進化需求欄位將以空值寫入，公版 Route 不會回填。';}
  else{if(transition&&!state.custom_initialized){state.custom_requirements=requirementFieldsFrom({});state.custom_initialized=true;}writeRequirementsToForm(form,state.custom_requirements||requirementFieldsFrom({}),false);if(effective)effective.textContent='玩家覆寫生效：請直接輸入此個體的自訂進化條件。公版 Master 只供參考，不會覆寫。';}
  const target=panel.querySelector('#evolutionTargetOverride');if(target)target.disabled=cannot||!player;updatePublicNotice(form,state);
}
function stateFromDetail(detail,form,groupId){
  const draft=detail?.draft||{},explicit=draftHasExplicitOverrideMode(draft)?normalizePlayerEvolutionOverride(draft):null,persisted=!explicit?getPersistedPlayerEvolutionOverride(draftTargetPokemonId(draft)):null,normalized=explicit||persisted||normalizePlayerEvolutionOverride({evolution_authority_mode:PUBLIC_MASTER}),publicRequirements=publicRequirementsForSpecies(draft.species||form?.querySelector?.('[data-field="species"]')?.value);
  const state={...normalized,public_requirements:publicRequirements,custom_requirements:normalized.evolution_authority_mode===PLAYER_OVERRIDE&&normalized.evolution_override_status===CUSTOM_REQUIREMENTS?requirementFieldsFrom(normalized):requirementFieldsFrom({}),custom_initialized:normalized.evolution_authority_mode===PLAYER_OVERRIDE,target_pokemon_id:draftTargetPokemonId(draft)||null};groupPublicRequirements.set(groupId,clone(publicRequirements));return state;
}
function enhanceOverrideUi(detail={}){const form=currentForm();if(!form)return;const groupId=formGroupId(form,detail);if(!groupId)return;let state=groupOverrideState.get(groupId);if(!state){state=stateFromDetail(detail,form,groupId);groupOverrideState.set(groupId,state);}else state.public_requirements=groupPublicRequirements.get(groupId)||state.public_requirements||publicRequirementsForSpecies(form.querySelector('[data-field="species"]')?.value);createOverridePanel(form,state,groupId);applyOverrideUi(form,state);}
function scheduleEnhance(detail){setTimeout(()=>enhanceOverrideUi(detail||{}),0);}

function captureOverrideInteraction(event){
  const form=event.target?.closest?.('#analysisConfirmationWorkbench .analysis-confirmation');if(!form)return;const panel=event.target?.closest?.('#playerEvolutionOverridePanel'),groupId=text(form.dataset.v042718GroupId||panel?.dataset?.groupId||'');if(!groupId)return;const state=groupOverrideState.get(groupId);if(!state)return;const field=event.target?.dataset?.field;
  if(field==='evolution_authority_mode'){const previous=state.evolution_authority_mode;state.evolution_authority_mode=event.target.value===PLAYER_OVERRIDE?PLAYER_OVERRIDE:PUBLIC_MASTER;if(state.evolution_authority_mode===PLAYER_OVERRIDE&&previous!==PLAYER_OVERRIDE){state.evolution_override_status=CUSTOM_REQUIREMENTS;state.custom_requirements=requirementFieldsFrom({});state.custom_initialized=false;}applyOverrideUi(form,state,{transition:state.evolution_authority_mode===PLAYER_OVERRIDE&&previous!==PLAYER_OVERRIDE});}
  else if(field==='evolution_override_status'){state.evolution_override_status=event.target.value===CANNOT_EVOLVE?CANNOT_EVOLVE:CUSTOM_REQUIREMENTS;if(state.evolution_override_status===CUSTOM_REQUIREMENTS&&!state.custom_requirements)state.custom_requirements=requirementFieldsFrom({});applyOverrideUi(form,state);}
  else if(field==='evolution_target_override')state.evolution_target_override=text(event.target.value);
  else if(field==='evolution_override_reason')state.evolution_override_reason=text(event.target.value);
  else if(state.evolution_authority_mode===PLAYER_OVERRIDE&&state.evolution_override_status===CUSTOM_REQUIREMENTS&&FIELD_MAP.some(([name])=>name===field)){state.custom_requirements=readRequirementsFromForm(form);state.custom_initialized=true;}
}
async function persistAppliedOverride(event){
  const detail=event?.detail||{},groupId=text(detail.group_id),pokemonId=text(detail.pokemon_id);if(!groupId||!pokemonId)return;const state=groupOverrideState.get(groupId);if(!state)return;const statusNode=globalThis.document?.querySelector?.('#analysisConfirmationStatus');
  try{
    ensurePlayerOverrideTable();const before=readOverrideRow(pokemonId);
    if(state.evolution_authority_mode!==PLAYER_OVERRIDE){
      if(before){await snapshot(`before_player_evolution_override_clear_${pokemonId}`);begin();try{run('DELETE FROM pokemon_evolution_override WHERE pokemon_id=?',[pokemonId]);const now=nowIso(),source=`evolution-override-clear:${detail.analysis_id||now}`;run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[pokemonId,now,'player_evolution_override_cleared',JSON.stringify(before),null,'使用者恢復以公版進化 Master 為此個體 Authority',source]);commit();await persist();}catch(error){rollback();throw error;}}
      return;
    }
    const normalized=normalizePlayerEvolutionOverride({evolution_authority_mode:PLAYER_OVERRIDE,evolution_override_status:state.evolution_override_status,evolution_target_override:state.evolution_target_override,evolution_override_reason:state.evolution_override_reason,...(state.evolution_override_status===CANNOT_EVOLVE?{}:(state.custom_requirements||{}))});
    await snapshot(`before_player_evolution_override_${pokemonId}`);begin();
    try{
      const now=nowIso(),createdAt=before?.created_at||now;
      run(`INSERT INTO pokemon_evolution_override(pokemon_id,authority_mode,override_status,target_override,override_reason,required_level,required_sleep_hours,required_candy,required_item,other_requirement,source_analysis_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pokemon_id) DO UPDATE SET authority_mode=excluded.authority_mode,override_status=excluded.override_status,target_override=excluded.target_override,override_reason=excluded.override_reason,required_level=excluded.required_level,required_sleep_hours=excluded.required_sleep_hours,required_candy=excluded.required_candy,required_item=excluded.required_item,other_requirement=excluded.other_requirement,source_analysis_id=excluded.source_analysis_id,updated_at=excluded.updated_at`,[pokemonId,PLAYER_OVERRIDE,normalized.evolution_override_status,normalized.evolution_target_override||null,normalized.evolution_override_reason||null,normalized.evolution_level_required,normalized.evolution_sleep_hours_required,normalized.evolution_candy_required,normalized.evolution_item_required||null,normalized.evolution_other_requirement||null,detail.analysis_id||null,createdAt,now]);
      run(`UPDATE pokemon SET evolution_level_required=?,evolution_sleep_hours_required=?,evolution_candy_required=?,evolution_item_required=?,evolution_other_requirement=? WHERE pokemon_id=?`,[normalized.evolution_level_required,normalized.evolution_sleep_hours_required,normalized.evolution_candy_required,normalized.evolution_item_required||null,normalized.evolution_other_requirement||null,pokemonId]);
      const after={...normalized,pokemon_id:'<local-instance>'};run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[pokemonId,now,'player_evolution_override_applied',before?JSON.stringify(before):null,JSON.stringify(after),normalized.evolution_override_status===CANNOT_EVOLVE?'使用者確認此特殊個體無法進化；公版進化 Route 僅供參考':'使用者確認此個體採人工自訂進化條件；公版進化 Master 僅供參考',`evolution-override:${detail.analysis_id||now}`]);commit();await persist();
    }catch(error){rollback();throw error;}
    if(statusNode){statusNode.className='notice success';statusNode.textContent+=normalized.evolution_override_status===CANNOT_EVOLVE?'；玩家進化覆寫已保存：此特殊個體無法進化。':'；玩家自訂進化條件已保存。';}
    globalThis.DebugTrace?.record?.('ai_review','player_evolution_override_persisted',{status:'completed',details:{group_id:groupId,override_status:normalized.evolution_override_status,public_master_reference_only:true}});
  }catch(error){if(statusNode){statusNode.className='notice error';statusNode.textContent=`個體已寫入，但玩家進化覆寫保存失敗：${error?.message||error}`;}globalThis.DebugTrace?.record?.('ai_review','player_evolution_override_persist_failed',{status:'failed',details:{group_id:groupId},error:error?.message||String(error)});}
}

function installPlayerEvolutionOverrideUi(){
  if(typeof globalThis.addEventListener!=='function'||typeof globalThis.document==='undefined')return;
  globalThis.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>scheduleEnhance(event.detail||{}));
  globalThis.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>scheduleEnhance(event.detail||{}));
  globalThis.addEventListener('pokemon-sleep:analysis-confirmed-applied',event=>{void persistAppliedOverride(event);});
  globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>{const groupId=text(event?.detail?.group_id);if(groupId&&event?.detail?.reason!=='applied'){groupOverrideState.delete(groupId);groupPublicRequirements.delete(groupId);}});
  document.addEventListener('change',captureOverrideInteraction,true);document.addEventListener('input',captureOverrideInteraction,true);
  globalThis.PokemonSleepPlayerEvolutionOverrideV042721=Object.freeze({version:PLAYER_EVOLUTION_OVERRIDE_VERSION,getGroupState:groupId=>clone(groupOverrideState.get(text(groupId))||null),getPersistedOverride:getPersistedPlayerEvolutionOverride,normalize:normalizePlayerEvolutionOverride,ensureTable:ensurePlayerOverrideTable});
}
installPlayerEvolutionOverrideUi();

export {DISPLAY_NOT_REQUIRED,PUBLIC_MASTER,PLAYER_OVERRIDE,CUSTOM_REQUIREMENTS,CANNOT_EVOLVE};