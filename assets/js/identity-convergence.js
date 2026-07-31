import {rows,run,persist,snapshot} from './database.js';
import {localIso} from './time-utils.js';

function strongCandidates(){
  return rows(`SELECT p.pokemon_id,p.pokemon_instance_id
    FROM pokemon p
    WHERE p.status<>'archived'
      AND p.identity_review_required=1
      AND COALESCE(p.pokemon_instance_id,'')<>''
      AND COALESCE(p.registered_at,'')<>''
      AND COALESCE(p.identity_fingerprint,'')<>''
      AND COALESCE(p.identity_confidence,0)>=0.95
      AND EXISTS(SELECT 1 FROM pokemon_identity_evidence e
        WHERE e.pokemon_instance_id=p.pokemon_instance_id
          AND e.evidence_type='registered_at' AND COALESCE(e.confidence,0)>=0.95)
      AND EXISTS(SELECT 1 FROM pokemon_identity_evidence e
        WHERE e.pokemon_instance_id=p.pokemon_instance_id
          AND e.evidence_type='identity_fingerprint' AND COALESCE(e.confidence,0)>=0.95)`);
}

export async function convergeStrongIdentities(){
  let candidates=[];
  try{candidates=strongCandidates();}catch{return 0;}
  if(!candidates.length)return 0;
  await snapshot(`identity-auto-converge:${candidates.length}`);
  const now=localIso();
  for(const item of candidates){
    run('UPDATE pokemon SET identity_review_required=0,last_updated_at=? WHERE pokemon_id=?',[now,item.pokemon_id]);
    run(`INSERT OR REPLACE INTO pokemon_identity_evidence
      (evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id)
      VALUES(?,?,?,?,?,?,?)`,[
      `auto-converged-${item.pokemon_id}`,
      item.pokemon_instance_id,
      'automatic_strong_evidence_confirmation',
      JSON.stringify({pokemon_id:item.pokemon_id,rule:'registered_at+identity_fingerprint+confidence>=0.95'}),
      1,now,'SYSTEM-IDENTITY-CONVERGENCE'
    ]);
  }
  await persist();
  document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'));
  return candidates.length;
}

function boot(){
  let attempts=0;
  const timer=setInterval(async()=>{
    attempts+=1;
    try{
      rows('SELECT 1');
      clearInterval(timer);
      await convergeStrongIdentities();
    }catch{
      if(attempts>=60)clearInterval(timer);
    }
  },500);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(convergeStrongIdentities,50));
}

boot();
