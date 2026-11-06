// G14.RATE.5 isolated, read-only source freshness guard. Not imported by the PWA.
// A caller-provided revision is NOT a trusted durable authority; production
// Apply remains HOLD until G265 all-writer admission and trusted reload exist.
import {POKEMON_PROVISIONAL_RATING_RULE_VERSION as RULE} from './pokemon-provisional-rating.js';

const result=(status,reason)=>Object.freeze({
  status,reason_codes:Object.freeze(reason?[reason]:[]),
  overwrite_allowed:false,player_data_write:false,
  production_apply:false,next_gate:'HOLD_PRODUCTION_ALL_WRITER_ADMISSION',
});
const validText=x=>typeof x==='string'&&x.length>0&&x===x.trim();
const validSha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype){
    const keys=Object.keys(value).sort();
    if(keys.some(k=>value[k]===undefined))throw new TypeError('UNKNOWN_SOURCE_FIELD');
    return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  }
  throw new TypeError('NON_JSON_SOURCE_FIELD');
}
const orderedRows=rows=>'['+rows.map(canonical).sort().join(',')+']';
/**
 * Capture an independent, immutable source comparison token. Full row facts
 * are compared, not merely a displayed grade or an unlocked-slot projection.
 * Revision fields must eventually come from independently trusted readers.
 */
export function capturePokemonRatingRefreshAuthority(input={}){
  const {rule_version,sqlite_generation,sqlite_sha256,import_revision,
    restore_revision,observation_revision,pokemon,ingredients,subskills}=input||{};
  if(rule_version!==RULE||!Number.isSafeInteger(sqlite_generation)||sqlite_generation<0
    ||!validSha(sqlite_sha256)||![import_revision,restore_revision,
      observation_revision].every(validText)
    ||![pokemon,ingredients,subskills].every(Array.isArray))
    return result('HOLD_SOURCE_UNVERIFIED','MISSING_OR_UNTRUSTED_AUTHORITY');
  const ids=new Set(),instances=new Set();
  for(const row of pokemon){
    if(!validText(row?.pokemon_id)||!validText(row?.pokemon_instance_id)
      ||ids.has(row.pokemon_id)||instances.has(row.pokemon_instance_id))
      return result('HOLD_SOURCE_UNVERIFIED','ROSTER_IDENTITY_AMBIGUOUS');
    ids.add(row.pokemon_id);instances.add(row.pokemon_instance_id);
  }
  for(const row of [...ingredients,...subskills]){
    if(!validText(row?.pokemon_id)||!ids.has(row.pokemon_id))
      return result('HOLD_SOURCE_UNVERIFIED','ORPHAN_OR_UNKNOWN_CHILD_IDENTITY');
  }
  try{
    const token=Object.freeze({
      rule_version,sqlite_generation,sqlite_sha256,import_revision,
      restore_revision,observation_revision,
      pokemon:orderedRows(pokemon),ingredients:orderedRows(ingredients),
      subskills:orderedRows(subskills),
    });
    return Object.freeze({...result('CAPTURED_READ_ONLY'),token});
  }catch{return result('HOLD_SOURCE_UNVERIFIED','NON_CANONICAL_SOURCE_FACTS');}
}
export function reviewPokemonRatingRefreshAuthority({captured,latest}={}){
  if(captured?.status!=='CAPTURED_READ_ONLY'||!captured.token)
    return result('HOLD_SOURCE_UNVERIFIED','CAPTURE_MISSING_OR_INVALID');
  const fresh=capturePokemonRatingRefreshAuthority(latest);
  if(fresh.status!=='CAPTURED_READ_ONLY')
    return result('HOLD_SOURCE_UNVERIFIED',fresh.reason_codes[0]);
  const old=captured.token,now=fresh.token;
  const fields=[
    ['rule_version','RULE_VERSION_STALE'],
    ['sqlite_generation','DURABLE_GENERATION_CHANGED'],
    ['sqlite_sha256','DURABLE_BYTES_CHANGED'],
    ['import_revision','IMPORT_REVISION_CHANGED'],
    ['restore_revision','RESTORE_REVISION_CHANGED'],
    ['observation_revision','OBSERVATION_REVISION_CHANGED'],
    ['pokemon','ROSTER_FACTS_CHANGED'],
    ['ingredients','INGREDIENT_FACTS_CHANGED'],
    ['subskills','SUBSKILL_FACTS_CHANGED'],
  ];
  for(const [key,reason] of fields)
    if(old[key]!==now[key])return result('STALE_REVIEW_REQUIRED',reason);
  return result('FRESH_READ_ONLY_SOURCE_TEST');
}
