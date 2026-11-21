import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {withPrimarySqliteMutationLock} from './storage.js';
import {beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation} from './sqlite-direct-write-window-guard.js';
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

// G265 #861: reserve same-page exclusivity before native admission; re-read
// the player's strong identity evidence ONLY under the loaded-primary lease.
// Identity flags + provenance evidence commit atomically, and the identical
// native lease is held through IndexedDB ACK. Unknown outcomes stick to reload.
let convergenceInFlight=false;
export async function convergeStrongIdentities(){
  if(convergenceInFlight)return 0;
  convergenceInFlight=true;
  let close=null,committed=false,acknowledged=false,failed=false;
  try{
    close=beginSqliteExclusiveWriteWindow();
    return await withPrimarySqliteMutationLock(async lease=>{
      let candidates=[];
      try{candidates=strongCandidates();}catch{return 0;}
      if(!candidates.length)return 0;
      await snapshot(`identity-auto-converge:${candidates.length}`);
      const now=localIso();
      let begun=false;
      try{
        withSqliteCoordinatedMutation(()=>{
          begin();begun=true;
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
          // A thrown COMMIT might already have applied. Fail closed.
          commit();committed=true;
        });
      }catch(cause){
        if(begun&&!committed){
          try{withSqliteCoordinatedMutation(rollback);}
          catch(rollbackError){
            throw Object.assign(new Error('IDENTITY_CONVERGENCE_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'),{
              code:'IDENTITY_CONVERGENCE_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED',cause:rollbackError,
            });
          }
        }
        throw cause;
      }
      try{
        await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
      }catch(cause){
        // SQLite COMMIT does not imply a durable IDB acknowledgment.
        throw Object.assign(new Error('IDENTITY_CONVERGENCE_DURABILITY_UNVERIFIED_RELOAD_REQUIRED'),{
          code:'IDENTITY_CONVERGENCE_DURABILITY_UNVERIFIED_RELOAD_REQUIRED',cause,
        });
      }
      acknowledged=true;
      // UI listener exceptions must not turn a durable ACK into a retry.
      try{if(typeof document!=='undefined')
        document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'));}catch{}
      return candidates.length;
    });
  }catch(error){failed=true;throw error;}
  finally{
    // Even a failed native admission quarantines further same-page SQL.
    close?.({uncertainOutcome:failed||(committed&&!acknowledged)});
    convergenceInFlight=false;
  }
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
  // The native lease may reject a stale page; prevent unhandled rejection.
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(()=>{
    convergeStrongIdentities().catch(error=>console.warn('[G265_IDENTITY_CONVERGENCE_HOLD]',error));
  },50));
}

boot();
