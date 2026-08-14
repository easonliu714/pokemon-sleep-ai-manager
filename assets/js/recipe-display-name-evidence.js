import {rows,run,persist,isRescueReadonly} from './database.js';

export const RECIPE_DISPLAY_NAME_EVIDENCE_VERSION='recipe-display-name-evidence-2026-08-14-a';
const UC_IMG_STORAGE_KEY='pokemon-sleep-uc-img-a-session-v1';
const text=value=>String(value??'').normalize('NFKC').trim();
const nowIso=()=>new Date().toISOString();

function dbReady(){try{return !isRescueReadonly()&&Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}}

export function ensureRecipeDisplayNameEvidenceSchema(){
  if(!dbReady())return false;
  run(`CREATE TABLE IF NOT EXISTS recipe_display_name_evidence(
    evidence_id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    observed_name TEXT NOT NULL,
    canonical_name_at_confirmation TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    recognition_version TEXT,
    confirmed_at TEXT NOT NULL,
    update_id TEXT,
    recorded_at TEXT NOT NULL
  )`);
  run('CREATE INDEX IF NOT EXISTS idx_recipe_display_name_evidence_recipe ON recipe_display_name_evidence(recipe_id,confirmed_at DESC)');
  return true;
}

function latestEvidenceRows(){
  if(!dbReady())return [];
  ensureRecipeDisplayNameEvidenceSchema();
  return rows(`SELECT e.* FROM recipe_display_name_evidence e
    WHERE NOT EXISTS(
      SELECT 1 FROM recipe_display_name_evidence newer
      WHERE newer.recipe_id=e.recipe_id
        AND (newer.confirmed_at>e.confirmed_at OR (newer.confirmed_at=e.confirmed_at AND newer.recorded_at>e.recorded_at))
    )`);
}

export function preferredRecipeDisplayNames(){
  return new Map(latestEvidenceRows().map(row=>[String(row.recipe_id),row]));
}

export function applyConfirmedRecipeDisplayNames(root=document){
  if(!root||!dbReady())return 0;
  const evidenceById=preferredRecipeDisplayNames();let applied=0;
  root.querySelectorAll('tr[data-recipe-id]').forEach(tr=>{
    const evidence=evidenceById.get(String(tr.dataset.recipeId));if(!evidence?.observed_name)return;
    const label=tr.querySelector('td:nth-child(3) b');if(!label)return;
    const canonical=text(label.dataset.publicCanonicalName||label.textContent);
    if(!label.dataset.publicCanonicalName)label.dataset.publicCanonicalName=canonical;
    label.textContent=evidence.observed_name;
    label.dataset.displayNameAuthority='USER_CONFIRMED_MATCH';
    label.title=evidence.observed_name===canonical?'玩家已確認與公版名稱一致':`玩家已確認顯示名稱；公版名稱：${canonical}`;
    applied+=1;
  });
  return applied;
}

function parsedUcImgRecipeSession(){
  try{
    const session=JSON.parse(localStorage.getItem(UC_IMG_STORAGE_KEY)||'null');
    if(session?.schema!=='pokemon-sleep-uc-img-a-session/1.0')return null;
    const state=session?.scenario_state?.recipes;
    if(state?.last_apply_status!=='APPLIED'||!state?.raw_response)return null;
    const response=JSON.parse(state.raw_response);
    if(response?.schema!=='pokemon-sleep-public-master-recognition/1.0'||response?.scenario!=='recipe_status_update')return null;
    return {session,state,response};
  }catch{return null;}
}

export async function persistConfirmedRecipeDisplayNamesFromUcImg(){
  if(!dbReady())return {recorded_count:0};
  const parsed=parsedUcImgRecipeSession();if(!parsed)return {recorded_count:0};
  ensureRecipeDisplayNameEvidenceSchema();
  const {session,state,response}=parsed,confirmed=(response.observations||[]).filter(item=>
    item?.status==='MATCHED'&&item?.user_resolution?.action==='USER_CONFIRMED_MATCH'&&text(item?.canonical_key?.recipe_id)&&text(item?.observed_text)
  );
  let recorded=0;
  for(const item of confirmed){
    const recipeId=text(item.canonical_key.recipe_id),confirmedAt=text(item.user_resolution?.confirmed_at)||nowIso();
    const evidenceId=`ucimg-recipe-name:${session.session_id}:${item.observation_id}:${confirmedAt}`;
    const sourceRef=`${session.session_id}:${item.source_image_ref||'image-unknown'}:${recipeId}`;
    const before=Number(rows('SELECT COUNT(*) AS count FROM recipe_display_name_evidence WHERE evidence_id=?',[evidenceId])[0]?.count||0);
    run(`INSERT OR IGNORE INTO recipe_display_name_evidence(
      evidence_id,recipe_id,observed_name,canonical_name_at_confirmation,confidence,source_type,source_ref,
      recognition_version,confirmed_at,update_id,recorded_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[
      evidenceId,recipeId,text(item.observed_text),text(item.canonical_name)||text(item.user_resolution?.canonical_name)||null,
      Number(item.confidence||0),'uc_img_user_confirmed_match',sourceRef,response.recognition_version||null,
      confirmedAt,state.last_update_id||null,nowIso(),
    ]);
    run(`INSERT OR IGNORE INTO canonical_resolution_log(
      resolution_id,entity_type,raw_text,normalized_text,resolution_status,term_id,canonical_name_zh_tw,
      confidence,requires_review,source_type,source_ref,evidence_revision,observed_at,committed_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      `resolution:${evidenceId}`,'recipe',text(item.observed_text),text(item.observed_text),'USER_CONFIRMED_MATCH',null,
      text(item.canonical_name)||text(item.user_resolution?.canonical_name)||null,Number(item.confidence||0),0,
      'uc_img_user_confirmed_match',sourceRef,response.recognition_version||null,confirmedAt,nowIso(),
    ]);
    if(!before)recorded+=1;
  }
  if(confirmed.length)await persist();
  return {recorded_count:recorded,confirmed_count:confirmed.length,version:RECIPE_DISPLAY_NAME_EVIDENCE_VERSION};
}

async function onDataChanged(event){
  if(event?.detail?.source!=='uc-img-a'||event?.detail?.scenario!=='recipes')return;
  try{await persistConfirmedRecipeDisplayNamesFromUcImg();applyConfirmedRecipeDisplayNames();}catch(error){console.warn('recipe_display_name_evidence_failed',error);}
}

if(typeof window!=='undefined'){
  window.addEventListener('pokemon-sleep:data-changed',onDataChanged);
  window.addEventListener('pokemon-sleep:database-ready',()=>{try{ensureRecipeDisplayNameEvidenceSchema();applyConfirmedRecipeDisplayNames();}catch{}});
}
