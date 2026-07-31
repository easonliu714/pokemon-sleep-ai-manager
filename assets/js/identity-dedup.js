import {rows,run,persist,snapshot} from './database.js';
import {localIso} from './time-utils.js';

const text=(value)=>String(value??'').trim();
const active=()=>rows("SELECT * FROM pokemon WHERE status='active'");

function displayKey(item){
  return [
    text(item.original_label||item.species),
    Number(item.level||0),
    text(item.specialty),
    text(item.type),
    text(item.nickname),
    text(item.rating),
    text(item.core_role),
  ].join('|');
}

function strong(item){
  return Number(item.identity_confidence||0)>=0.95
    && text(item.registered_at)
    && text(item.identity_fingerprint)
    && Number(item.identity_review_required||0)===0;
}

function weakPlaceholder(item){
  return Number(item.identity_review_required||0)===1
    && Number(item.identity_confidence||0)<0.95
    && !text(item.registered_at)
    && !text(item.identity_fingerprint);
}

function score(item){
  let value=0;
  if(!text(item.pokemon_id).startsWith('pkm_private_'))value+=20;
  if(strong(item))value+=50;
  if(text(item.pokemon_instance_id))value+=5;
  if(text(item.registered_at))value+=5;
  if(text(item.identity_fingerprint))value+=5;
  for(const key of ['main_skill','nature','helper_seconds','carry_limit','sp'])if(text(item[key]))value+=1;
  return value;
}

export function planPokemonMerges(items){
  const planned=[];
  const used=new Set();
  const groups=new Map();
  for(const item of items){
    const key=displayKey(item);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  }
  for(const group of groups.values()){
    if(group.length<2)continue;
    const hasPrivate=group.some(item=>text(item.pokemon_id).startsWith('pkm_private_'));
    const hasCanonical=group.some(item=>!text(item.pokemon_id).startsWith('pkm_private_'));
    if(!hasPrivate||!hasCanonical)continue;
    const ordered=[...group].sort((a,b)=>score(b)-score(a));
    const winner=ordered[0];
    for(const loser of ordered.slice(1)){
      if(used.has(loser.pokemon_id))continue;
      planned.push({winner,loser,reason:'exact canonical/private duplicate'});
      used.add(loser.pokemon_id);
    }
  }

  const strongItems=items.filter(item=>strong(item)&&!used.has(item.pokemon_id));
  const weakItems=items.filter(item=>weakPlaceholder(item)&&!used.has(item.pokemon_id));
  for(const candidate of strongItems){
    const matches=weakItems.filter(item=>
      !used.has(item.pokemon_id)
      && text(item.original_label||item.species)===text(candidate.original_label||candidate.species)
      && Number(item.level||0)===Number(candidate.level||0)
      && text(item.specialty)===text(candidate.specialty)
      && text(item.type)===text(candidate.type));
    if(matches.length!==1)continue;
    const loser=matches[0];
    planned.push({winner:candidate,loser,reason:'unique strong identity replaces weak placeholder'});
    used.add(loser.pokemon_id);
  }
  return planned;
}

function mergeChildren(winnerId,loserId){
  run(`INSERT OR IGNORE INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity)
    SELECT ?,unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id=?`,[winnerId,loserId]);
  run(`INSERT OR IGNORE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked)
    SELECT ?,unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id=?`,[winnerId,loserId]);
  run('DELETE FROM pokemon_ingredients WHERE pokemon_id=?',[loserId]);
  run('DELETE FROM pokemon_subskills WHERE pokemon_id=?',[loserId]);
}

function mergeOne({winner,loser,reason},now){
  mergeChildren(winner.pokemon_id,loser.pokemon_id);
  if(text(loser.pokemon_instance_id)&&text(winner.pokemon_instance_id)){
    run('UPDATE pokemon_identity_evidence SET pokemon_instance_id=? WHERE pokemon_instance_id=?',[
      winner.pokemon_instance_id,loser.pokemon_instance_id,
    ]);
  }
  run("UPDATE pokemon SET status='archived',last_updated_at=? WHERE pokemon_id=?",[now,loser.pokemon_id]);
  run(`INSERT OR REPLACE INTO pokemon_identity_evidence
    (evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id)
    VALUES(?,?,?,?,?,?,?)`,[
    `auto-dedup-${loser.pokemon_id}`,
    winner.pokemon_instance_id||winner.pokemon_id,
    'automatic_duplicate_convergence',
    JSON.stringify({winner_pokemon_id:winner.pokemon_id,archived_pokemon_id:loser.pokemon_id,reason}),
    1,now,'SYSTEM-IDENTITY-DEDUP-v0.3.24',
  ]);
}

export async function repairPokemonDuplicates(){
  let items;
  try{items=active();}catch{return 0;}
  const merges=planPokemonMerges(items);
  if(!merges.length)return 0;
  await snapshot(`identity-dedup:${merges.length}`);
  const now=localIso();
  for(const merge of merges)mergeOne(merge,now);
  await persist();
  if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'));
  return merges.length;
}

function boot(){
  let attempts=0;
  const timer=setInterval(async()=>{
    attempts+=1;
    try{
      rows('SELECT 1');
      clearInterval(timer);
      await repairPokemonDuplicates();
    }catch{
      if(attempts>=60)clearInterval(timer);
    }
  },500);
}

if(typeof document!=='undefined')boot();
