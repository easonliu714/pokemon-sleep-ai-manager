import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';

const text=value=>String(value??'').trim();

function fnv1a(value){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i+=1){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,0x01000193);
  }
  return `ability-${(hash>>>0).toString(16).padStart(8,'0')}`;
}

function childRows(table,pokemonId){
  return rows(`SELECT * FROM ${table} WHERE pokemon_id=? ORDER BY unlock_level`,[pokemonId]);
}

export function buildAbilitySignature(pokemon,ingredients,subskills){
  return JSON.stringify({
    species:text(pokemon.current_species||pokemon.species),
    level:Number(pokemon.level||0),
    specialty:text(pokemon.specialty),
    type:text(pokemon.type),
    sp:Number(pokemon.sp||0),
    main_skill:text(pokemon.main_skill),
    main_skill_level:Number(pokemon.main_skill_level||0),
    nature:text(pokemon.nature),
    nature_bonus:text(pokemon.nature_bonus),
    nature_penalty:text(pokemon.nature_penalty),
    helper_seconds:Number(pokemon.helper_seconds||0),
    carry_limit:Number(pokemon.carry_limit||0),
    favorite_berry:text(pokemon.favorite_berry),
    ingredients:ingredients.map(item=>[Number(item.unlock_level),text(item.ingredient_name),Number(item.quantity||0)]),
    subskills:subskills.map(item=>[Number(item.unlock_level),text(item.subskill_name),Number(item.is_unlocked||0)]),
  });
}

function isComplete(pokemon,ingredients,subskills){
  const required=['species','level','specialty','type','main_skill','main_skill_level','nature','helper_seconds','carry_limit'];
  if(required.some(key=>!text(pokemon[key])))return false;
  const ingredientLevels=new Set(ingredients.map(item=>Number(item.unlock_level)));
  const subskillLevels=new Set(subskills.map(item=>Number(item.unlock_level)));
  return [1,30,60].every(level=>ingredientLevels.has(level))
    && [10,25,50,70,80].every(level=>subskillLevels.has(level));
}

export function planAbilityEvidence(items){
  const complete=[];
  for(const pokemon of items){
    const ingredients=childRows('pokemon_ingredients',pokemon.pokemon_id);
    const subskills=childRows('pokemon_subskills',pokemon.pokemon_id);
    if(!isComplete(pokemon,ingredients,subskills))continue;
    const signature=buildAbilitySignature(pokemon,ingredients,subskills);
    complete.push({pokemon,signature,fingerprint:fnv1a(signature)});
  }
  const counts=new Map();
  for(const item of complete)counts.set(item.fingerprint,(counts.get(item.fingerprint)||0)+1);
  return complete.filter(item=>counts.get(item.fingerprint)===1);
}

export async function completeIdentityEvidence(){
  let active=[];
  try{active=rows("SELECT * FROM pokemon WHERE status='active'");}catch{return 0;}
  const planned=planAbilityEvidence(active).filter(item=>
    Number(item.pokemon.identity_review_required||0)===1
    || !text(item.pokemon.identity_fingerprint)
    || Number(item.pokemon.identity_confidence||0)<0.95);
  if(!planned.length)return 0;
  await snapshot(`identity-evidence-builder:${planned.length}`);
  const now=localIso();
  begin();
  try{
    for(const item of planned){
      const instanceId=text(item.pokemon.pokemon_instance_id)||item.pokemon.pokemon_id;
      run(`UPDATE pokemon SET pokemon_instance_id=?,identity_fingerprint=?,identity_confidence=0.96,
        identity_review_required=0,last_updated_at=? WHERE pokemon_id=?`,[
        instanceId,item.fingerprint,now,item.pokemon.pokemon_id,
      ]);
      run(`INSERT OR REPLACE INTO pokemon_identity_evidence
        (evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id)
        VALUES(?,?,?,?,?,?,?)`,[
        `ability-fingerprint-${item.pokemon.pokemon_id}`,
        instanceId,
        'ability_fingerprint',
        item.fingerprint,
        0.96,
        now,
        'SYSTEM-IDENTITY-EVIDENCE-BUILDER-v0.3.27',
      ]);
    }
    commit();
  }catch(error){rollback();throw error;}
  await persist();
  if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'));
  return planned.length;
}

function boot(){
  let attempts=0;
  const timer=setInterval(async()=>{
    attempts+=1;
    try{
      rows('SELECT 1');
      clearInterval(timer);
      await completeIdentityEvidence();
    }catch{
      if(attempts>=60)clearInterval(timer);
    }
  },500);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(completeIdentityEvidence,100));
}

if(typeof document!=='undefined')boot();
