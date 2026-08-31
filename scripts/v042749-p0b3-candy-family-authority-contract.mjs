import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS,
  PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY,
  PUBLIC_CANDY_FAMILY_DIRECT_EVIDENCE_ROWS,
  currentPublicCandyFamilyAuthorityRows,
  resolvePublicCandyFamilyForSpecies,
} from '../assets/js/public-candy-family-authority.js';
import {PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY,resolvePublicPokemonSpeciesAuthority} from '../assets/js/public-pokemon-species-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const tests=[];
const gate=(name,fn)=>{
  try{fn();tests.push({name,status:'PASS'});}catch(error){tests.push({name,status:'FAIL',error:String(error?.message||error)});}
};

gate('B3 authority policy is explicit and display-name authority stays separate',()=>{
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,'public-candy-family-authority-2026-08-31-a');
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.family_membership_authority,true);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.exact_species_authority_required,true);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.candy_display_name_authority,false);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.candy_display_name_auto_generation,false);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.legacy_candy_master_migration_authority,false);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.professor_transfer_write_behavior_changed,false);
  assert.equal(PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY.player_write_authority,false);
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.candy_family_authority,false,'Species Authority must not become the Candy-family owner');
  assert.equal(PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY.candy_display_name_authority,false);
});

gate('authority rows are deterministic and member assignments are unique',()=>{
  assert.ok(PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.length>0);
  assert.equal(currentPublicCandyFamilyAuthorityRows().length,PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.length);
  const familyIds=PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.map(row=>row.family_id);
  assert.equal(new Set(familyIds).size,familyIds.length);
  const members=PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.flatMap(row=>row.member_species_names.map(name=>name.normalize('NFKC')));
  assert.equal(new Set(members).size,members.length,'one species/form must never belong to multiple governed Candy families');
  for(const row of PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS){
    assert.equal(row.family_membership_authority,true);
    assert.equal(row.candy_display_name,null);
    assert.equal(row.candy_display_name_authority,false);
    assert.ok(row.member_species_names.length>=2,'B3 must not silently invent singleton Candy families from missing evolution evidence');
  }
});

gate('Tinkatink line has direct official Candy-family evidence without display-name promotion',()=>{
  assert.equal(PUBLIC_CANDY_FAMILY_DIRECT_EVIDENCE_ROWS.length,1);
  const expected=['小鍛匠','巧鍛匠','巨鍛匠'];
  const results=expected.map(name=>resolvePublicCandyFamilyForSpecies(name));
  for(const result of results){
    assert.equal(result.status,'MATCH');
    assert.equal(result.family_id,'family_tinkatink_line');
    assert.equal(result.authority_class,'OFFICIAL_DIRECT_CANDY_FAMILY_EVIDENCE');
    assert.equal(result.direct_candy_family_evidence,true);
    assert.deepEqual([...result.member_species_names],expected);
    assert.equal(result.candy_display_name,null);
    assert.equal(result.candy_display_name_authority,false);
    assert.ok(result.source_refs.some(ref=>ref.includes('pokemonsleep.net/en/news/')));
  }
});

gate('evolution-connected Pokémon resolve to one structural family, not one Candy row per species',()=>{
  const pichu=resolvePublicCandyFamilyForSpecies('皮丘');
  const pikachu=resolvePublicCandyFamilyForSpecies('皮卡丘');
  const raichu=resolvePublicCandyFamilyForSpecies('雷丘');
  for(const result of [pichu,pikachu,raichu]){
    assert.equal(result.status,'MATCH');
    assert.equal(result.authority_class,'PUBLIC_EVOLUTION_CONNECTIVITY_GOVERNED');
    assert.equal(result.structural_root_species_name,'皮丘');
    assert.equal(result.candy_display_name,null);
  }
  assert.equal(pichu.family_id,pikachu.family_id);
  assert.equal(pikachu.family_id,raichu.family_id);
  assert.ok(pikachu.member_species_names.includes('皮丘'));
  assert.ok(pikachu.member_species_names.includes('皮卡丘'));
  assert.ok(pikachu.member_species_names.includes('雷丘'));
});

gate('branched evolution families converge to one governed structural family',()=>{
  const eevee=resolvePublicCandyFamilyForSpecies('伊布');
  const vaporeon=resolvePublicCandyFamilyForSpecies('水伊布');
  const sylveon=resolvePublicCandyFamilyForSpecies('仙子伊布');
  for(const result of [eevee,vaporeon,sylveon])assert.equal(result.status,'MATCH');
  assert.equal(eevee.family_id,vaporeon.family_id);
  assert.equal(vaporeon.family_id,sylveon.family_id);
  assert.equal(eevee.structural_root_species_name,'伊布');
  assert.ok(eevee.member_species_names.length>=8);
});

gate('known public forms without governed family evidence fail closed rather than inherit base-species family',()=>{
  const species=resolvePublicPokemonSpeciesAuthority('皮卡丘（佳節）');
  assert.equal(species.status,'MATCH');
  const family=resolvePublicCandyFamilyForSpecies('皮卡丘（佳節）');
  assert.equal(family.status,'REVIEW_REQUIRED');
  assert.equal(family.reason,'PUBLIC_CANDY_FAMILY_NOT_GOVERNED');
  assert.equal(family.family_id,null);
  assert.equal(family.candy_display_name_authority,false);
});

gate('unknown species fails closed before Candy-family resolution',()=>{
  for(const value of ['',null,'不存在寶可夢']){
    const result=resolvePublicCandyFamilyForSpecies(value);
    assert.equal(result.status,'REVIEW_REQUIRED');
    assert.equal(result.family_membership_authority,false);
    assert.equal(result.candy_display_name,null);
  }
});

gate('B3 introduces no circular Candy dependency, player persistence, or display-name synthesis',()=>{
  const source=read('assets/js/public-candy-family-authority.js');
  for(const forbidden of [
    "from './public-candy-master.js'",
    'speciesCandyName(',
    'candyNameCandidatesFromPokemonName(',
    'db.run(',
    'db.exec(',
    'localStorage.',
    'indexedDB.',
    'fetch(',
  ])assert.equal(source.includes(forbidden),false,forbidden);
});

gate('B3 does not migrate legacy Candy Master or Professor observed-delta behavior',()=>{
  const candy=read('assets/js/public-candy-master.js');
  const professor=read('assets/js/pokemon-professor-transfer.js');
  assert.ok(candy.includes('publicPokemonNamesForLegacyCandyProjection'));
  assert.ok(candy.includes('speciesCandyName(species)'));
  assert.ok(professor.includes("PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-08-27-p0b1'"));
  assert.ok(professor.includes("import {speciesCandyName} from './public-candy-master.js'"));
  assert.equal(professor.includes('public-candy-family-authority.js'),false);
});

for(const result of tests)console.log(`- ${result.status} ${result.name}${result.error?` :: ${result.error}`:''}`);
const failed=tests.filter(row=>row.status!=='PASS');
console.log(JSON.stringify({
  gate:'V042749_P0B3_PUBLIC_CANDY_FAMILY_AUTHORITY_CONTRACT',
  status:failed.length?'FAIL':'PASS',
  passed:tests.length-failed.length,
  total:tests.length,
  family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  governed_family_count:PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.length,
  direct_evidence_family_count:PUBLIC_CANDY_FAMILY_DIRECT_EVIDENCE_ROWS.length,
  candy_display_name_authority:false,
  legacy_candy_master_migration:false,
  professor_transfer_write_behavior_changed:false,
  player_write_authority:false,
},null,2));
if(failed.length)process.exitCode=1;
