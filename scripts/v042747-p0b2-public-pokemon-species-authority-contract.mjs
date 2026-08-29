import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
  PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS,
  PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY,
  PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS,
  currentPublicPokemonSpeciesAuthorityRows,
  resolvePublicPokemonSpeciesAuthority,
  publicPokemonNamesForLegacyCandyProjection,
} from '../assets/js/public-pokemon-species-authority.js';
import {currentPublicSpeciesFormZhTwIdentityRows} from '../assets/js/public-species-form-zh-tw-identity.js';
import {PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER} from '../assets/js/public-pokemon-knowledge-master.js';
import {
  PUBLIC_CANDY_MASTER_VERSION,
  buildPublicCandyMasterRows,
  publicPokemonNamesForCandy,
} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
const normalize=value=>String(value??'').trim().normalize('NFKC');
const tests=[];
const gate=(name,fn)=>{
  try{fn();tests.push({name,status:'PASS'});}catch(error){tests.push({name,status:'FAIL',error:String(error?.message||error)});}
};

function historicalCandyProjection(){
  const names=new Map();
  const add=value=>{
    const display=String(value??'').trim(),key=normalize(value);
    if(display&&key&&!names.has(key))names.set(key,display);
  };
  for(const row of PUBLIC_EVOLUTION_MASTER){add(row.from_species);add(row.to_species);}
  for(const row of PUBLIC_EVOLUTION_STATUS_MASTER)add(row.species_name);
  return [...names.values()].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}

gate('authority version and policy are explicit',()=>{
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,'public-pokemon-species-authority-2026-08-29-a');
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.exact_display_name_only,true);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.fuzzy_auto_match,false);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.ai_species_guess,false);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.player_write_authority,false);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.candy_family_authority,false);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.candy_display_name_authority,false);
});

gate('authority preserves pinned identity rows and adds exactly three official-live species',()=>{
  const base=currentPublicSpeciesFormZhTwIdentityRows();
  assert.equal(PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS.length,3);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS.length,base.length+3);
  assert.equal(currentPublicPokemonSpeciesAuthorityRows().length,base.length+3);
  const keys=PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS.map(row=>normalize(row.display_name_zh_tw));
  assert.equal(new Set(keys).size,keys.length,'authority display names must be unique after NFKC comparison');
});

gate('Tinkatink line is exact official-live public species authority',()=>{
  const expected=[['小鍛匠','TINKATINK'],['巧鍛匠','TINKATUFF'],['巨鍛匠','TINKATON']];
  for(const [name,sourceKey] of expected){
    const result=resolvePublicPokemonSpeciesAuthority(name);
    assert.equal(result.status,'MATCH',name);
    assert.deepEqual([...result.source_keys],[sourceKey],name);
    assert.equal(result.authority_class,'OFFICIAL_LIVE_RECENCY_ADDITION',name);
    assert.equal(result.appearing_from,'2026-08-17T15:00:00+08:00',name);
    assert.match(result.source_ref,/^https:\/\/www\.pokemonsleep\.net\/zh\/news\//u,name);
  }
});

gate('unknown or missing species fails closed',()=>{
  for(const value of ['',null,'小鍛匠X']){
    const result=resolvePublicPokemonSpeciesAuthority(value);
    assert.equal(result.status,'REVIEW_REQUIRED');
    assert.equal(result.player_species_generated,false);
  }
});

gate('legacy Candy projection is byte-for-byte behavior compatible',()=>{
  const before=historicalCandyProjection();
  const after=publicPokemonNamesForLegacyCandyProjection();
  assert.deepEqual(after,before);
  assert.deepEqual(publicPokemonNamesForCandy(),before);
});

gate('B2 does not fabricate Candy rows for newly live species',()=>{
  const forbidden=new Set(['小鍛匠','巧鍛匠','巨鍛匠']);
  for(const name of forbidden)assert.equal(publicPokemonNamesForLegacyCandyProjection().includes(name),false,`${name} must wait for Candy family/display-name authority`);
  const candyRows=buildPublicCandyMasterRows();
  assert.equal(candyRows.some(row=>forbidden.has(row.target_species_name)),false);
  assert.match(PUBLIC_CANDY_MASTER_VERSION,/^public-candy-master-2026-08-29-[a-z]$/u);
  for(const row of candyRows.filter(row=>row.candy_type==='species')){
    assert.equal(row.source_ref,PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION);
  }
});

gate('Candy no longer reconstructs the Pokémon species namespace itself',()=>{
  const candy=read('assets/js/public-candy-master.js');
  assert.equal(candy.includes('PUBLIC_EVOLUTION_MASTER'),false);
  assert.equal(candy.includes('PUBLIC_EVOLUTION_STATUS_MASTER'),false);
  assert.ok(candy.includes('publicPokemonNamesForLegacyCandyProjection'));
  assert.ok(candy.includes('PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION'));
});

gate('release and offline wiring are v0.4.27.47 exact',()=>{
  const version=read('assets/js/version-authority.js');
  const sw=read('service-worker.js');
  const workflow=read('.github/workflows/regression-gate.yml');
  assert.match(version,/app_version:\s*'v0\.4\.27\.47'/u);
  assert.match(version,/app_build:\s*'20260829-v042747-p0b2-public-species-authority'/u);
  assert.ok(sw.includes("'./assets/js/public-pokemon-species-authority.js'"));
  assert.ok(workflow.includes('node scripts/v042747-p0b2-public-pokemon-species-authority-contract.mjs'));
});

gate('authority module contains no player persistence or runtime network writes',()=>{
  const source=read('assets/js/public-pokemon-species-authority.js');
  for(const forbidden of ['db.run(','db.exec(','localStorage.','indexedDB.','fetch('])assert.equal(source.includes(forbidden),false,forbidden);
});

for(const result of tests)console.log(`- ${result.status} ${result.name}${result.error?` :: ${result.error}`:''}`);
const failed=tests.filter(row=>row.status!=='PASS');
console.log(JSON.stringify({
  gate:'V042747_P0B2_PUBLIC_POKEMON_SPECIES_AUTHORITY_CONTRACT',
  status:failed.length?'FAIL':'PASS',
  passed:tests.length-failed.length,
  total:tests.length,
  authority_version:PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
  authority_rows:PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS.length,
  official_live_additions:PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS.map(row=>row.display_name_zh_tw),
  candy_projection_unchanged:true,
  candy_family_authority:false,
  candy_display_name_authority:false,
  player_write_authority:false,
},null,2));
if(failed.length)process.exitCode=1;
