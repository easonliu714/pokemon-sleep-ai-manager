export const EVALUATION_REFRESH_PLAN_VERSION='evaluation-refresh-plan-2026-08-09-a';

const text=value=>String(value??'').trim();
const uniqueRows=(rows,keyFn)=>{
  const map=new Map();
  for(const row of rows||[]){const key=keyFn(row);if(key&&!map.has(key))map.set(key,row);}
  return [...map.values()];
};

export function planSnapshotLifecycle({targets=[],currentSnapshots=[],force=false}={}){
  const normalizedTargets=uniqueRows(targets,row=>text(row?.pokemon_id)).filter(row=>text(row?.pokemon_id)&&text(row?.input_fingerprint));
  const normalizedCurrent=uniqueRows(currentSnapshots,row=>text(row?.evaluation_id)||`${text(row?.pokemon_id)}|${text(row?.input_fingerprint)}`)
    .filter(row=>text(row?.pokemon_id)&&text(row?.input_fingerprint));
  const targetIds=new Set(normalizedTargets.map(row=>text(row.pokemon_id)));
  const currentByPokemon=new Map();
  for(const row of normalizedCurrent){
    const pokemonId=text(row.pokemon_id);
    if(!currentByPokemon.has(pokemonId))currentByPokemon.set(pokemonId,[]);
    currentByPokemon.get(pokemonId).push(row);
  }

  const refreshTargets=[];
  const reusedTargets=[];
  const staleSnapshotIds=new Set();

  for(const target of normalizedTargets){
    const pokemonId=text(target.pokemon_id),fingerprint=text(target.input_fingerprint);
    const current=currentByPokemon.get(pokemonId)||[];
    const same=current.find(row=>text(row.input_fingerprint)===fingerprint)||null;
    if(same&&!force)reusedTargets.push({pokemon_id:pokemonId,input_fingerprint:fingerprint,evaluation_id:text(same.evaluation_id)||null});
    else refreshTargets.push({pokemon_id:pokemonId,input_fingerprint:fingerprint});
    for(const row of current){
      if(text(row.input_fingerprint)!==fingerprint&&text(row.evaluation_id))staleSnapshotIds.add(text(row.evaluation_id));
    }
  }

  for(const row of normalizedCurrent){
    if(!targetIds.has(text(row.pokemon_id))&&text(row.evaluation_id))staleSnapshotIds.add(text(row.evaluation_id));
  }

  const staleIds=[...staleSnapshotIds].sort();
  return Object.freeze({
    plan_version:EVALUATION_REFRESH_PLAN_VERSION,
    target_count:normalizedTargets.length,
    current_snapshot_count:normalizedCurrent.length,
    refresh_count:refreshTargets.length,
    reused_count:reusedTargets.length,
    stale_count:staleIds.length,
    refresh_required:refreshTargets.length>0||staleIds.length>0,
    write_required:refreshTargets.length>0||staleIds.length>0||Boolean(force&&normalizedTargets.length),
    force:Boolean(force),
    refresh_targets:Object.freeze(refreshTargets),
    reused_targets:Object.freeze(reusedTargets),
    stale_snapshot_ids:Object.freeze(staleIds),
  });
}
