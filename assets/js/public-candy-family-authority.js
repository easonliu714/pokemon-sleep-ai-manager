import {PUBLIC_EVOLUTION_MASTER} from './public-pokemon-knowledge-master.js';
import {
  PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
  resolvePublicPokemonSpeciesAuthority,
} from './public-pokemon-species-authority.js';

export const PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION='public-candy-family-authority-2026-08-31-a';
export const PUBLIC_CANDY_FAMILY_AUTHORITY_STATUS='ACTIVE_GOVERNED_CANDY_FAMILY_MEMBERSHIP_AUTHORITY';

const TINKATINK_BUNDLE_SOURCE='https://www.pokemonsleep.net/en/news/343238373339373232383036383230383732/';
const TINKATINK_DEBUT_SOURCE='https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/';
const displayText=value=>String(value??'').trim();
const normalizeKey=value=>displayText(value).normalize('NFKC');
const idPart=value=>encodeURIComponent(normalizeKey(value)).replace(/%/g,'_').toLowerCase();
const unique=value=>[...new Set(value)];
const sortZh=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b),'zh-Hant'));

function freezeFamilyRow(row){
  return Object.freeze({
    ...row,
    member_species_names:Object.freeze([...(row.member_species_names||[])]),
    source_refs:Object.freeze([...(row.source_refs||[])]),
  });
}

// Direct family evidence is kept explicit. This source states that the
// Tinkatink-specific Main Skill Seed can be used on Tinkatink, Tinkatuff and
// Tinkaton, and can be exchanged for Tinkatink Candy. That is direct evidence
// that the three species share one Candy family. It does NOT grant authority
// to synthesize a zh-TW Candy display string.
export const PUBLIC_CANDY_FAMILY_DIRECT_EVIDENCE_ROWS=Object.freeze([
  freezeFamilyRow({
    family_id:'family_tinkatink_line',
    structural_root_species_name:'小鍛匠',
    member_species_names:['小鍛匠','巧鍛匠','巨鍛匠'],
    authority_class:'OFFICIAL_DIRECT_CANDY_FAMILY_EVIDENCE',
    verification_status:'OFFICIAL_CANDY_FAMILY_VERIFIED',
    direct_candy_family_evidence:true,
    family_membership_authority:true,
    candy_display_name:null,
    candy_display_name_authority:false,
    source_refs:[TINKATINK_BUNDLE_SOURCE,TINKATINK_DEBUT_SOURCE],
  }),
]);

function buildEvolutionComponents(){
  const names=new Map();
  const adjacency=new Map();
  const indegree=new Map();
  const edgeSources=[];
  const addName=value=>{
    const display=displayText(value),key=normalizeKey(value);
    if(!display||!key)return null;
    if(!names.has(key))names.set(key,display);
    if(!adjacency.has(key))adjacency.set(key,new Set());
    if(!indegree.has(key))indegree.set(key,0);
    return key;
  };

  for(const edge of PUBLIC_EVOLUTION_MASTER){
    const from=addName(edge?.from_species),to=addName(edge?.to_species);
    if(!from||!to||from===to)continue;
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
    indegree.set(to,(indegree.get(to)||0)+1);
    edgeSources.push(Object.freeze({from,to,source_ref:displayText(edge?.source_ref)||null}));
  }

  const visited=new Set(),components=[];
  for(const start of sortZh(names.keys())){
    if(visited.has(start))continue;
    const stack=[start],component=[];
    visited.add(start);
    while(stack.length){
      const key=stack.pop();
      component.push(key);
      for(const next of adjacency.get(key)||[]){
        if(visited.has(next))continue;
        visited.add(next);stack.push(next);
      }
    }
    const memberKeys=sortZh(component);
    const roots=memberKeys.filter(key=>(indegree.get(key)||0)===0);
    const memberSet=new Set(memberKeys);
    const sourceRefs=unique(edgeSources.filter(edge=>memberSet.has(edge.from)&&memberSet.has(edge.to)).map(edge=>edge.source_ref).filter(Boolean));
    components.push(Object.freeze({memberKeys:Object.freeze(memberKeys),roots:Object.freeze(roots),sourceRefs:Object.freeze(sourceRefs)}));
  }
  return Object.freeze(components);
}

export const PUBLIC_CANDY_FAMILY_EVOLUTION_COMPONENTS=buildEvolutionComponents();

function structuralFamilyRow(component){
  if(component.roots.length!==1)return null;
  const memberSpecies=component.memberKeys.map(key=>displayText(key));
  const resolved=memberSpecies.map(name=>resolvePublicPokemonSpeciesAuthority(name));
  if(resolved.some(result=>result.status!=='MATCH'))return null;
  const rootName=displayText(component.roots[0]);
  const rootAuthority=resolvePublicPokemonSpeciesAuthority(rootName);
  if(rootAuthority.status!=='MATCH')return null;
  const rootSourceKey=displayText(rootAuthority.source_keys?.[0])||rootName;
  return freezeFamilyRow({
    family_id:`family_${idPart(rootSourceKey)}`,
    structural_root_species_name:rootName,
    member_species_names:sortZh(resolved.map(result=>result.display_name_zh_tw)),
    authority_class:'PUBLIC_EVOLUTION_CONNECTIVITY_GOVERNED',
    verification_status:'STRUCTURAL_FAMILY_VERIFIED',
    direct_candy_family_evidence:false,
    family_membership_authority:true,
    candy_display_name:null,
    candy_display_name_authority:false,
    source_refs:component.sourceRefs,
  });
}

function buildAuthorityRows(){
  const rows=[],assigned=new Map();
  const add=row=>{
    for(const member of row.member_species_names){
      const key=normalizeKey(member);
      const existing=assigned.get(key);
      if(existing&&existing!==row.family_id)throw new Error(`public_candy_family_member_conflict:${member}:${existing}:${row.family_id}`);
    }
    if(rows.some(existing=>existing.family_id===row.family_id))throw new Error(`public_candy_family_id_conflict:${row.family_id}`);
    rows.push(row);
    for(const member of row.member_species_names)assigned.set(normalizeKey(member),row.family_id);
  };

  // Direct evidence wins over the older public evolution graph. This makes the
  // overlay deterministic when a newly live family is later added to that graph.
  for(const row of PUBLIC_CANDY_FAMILY_DIRECT_EVIDENCE_ROWS)add(row);
  for(const component of PUBLIC_CANDY_FAMILY_EVOLUTION_COMPONENTS){
    const row=structuralFamilyRow(component);
    if(!row)continue;
    if(row.member_species_names.some(member=>assigned.has(normalizeKey(member))))continue;
    add(row);
  }
  return Object.freeze(rows.sort((a,b)=>a.family_id.localeCompare(b.family_id)));
}

export const PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS=buildAuthorityRows();
const FAMILY_BY_MEMBER=new Map();
for(const row of PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS){
  for(const member of row.member_species_names)FAMILY_BY_MEMBER.set(normalizeKey(member),row);
}

export const PUBLIC_CANDY_FAMILY_AUTHORITY_POLICY=Object.freeze({
  exact_species_authority_required:true,
  pokemon_species_authority_version:PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
  family_membership_authority:true,
  direct_candy_family_evidence_supported:true,
  evolution_connectivity_structural_family_supported:true,
  evolution_root_is_not_candy_display_name_anchor:true,
  candy_display_name_authority:false,
  candy_display_name_auto_generation:false,
  legacy_candy_master_migration_authority:false,
  professor_transfer_write_behavior_changed:false,
  player_write_authority:false,
  unknown_or_ungoverned_family_fail_closed:true,
});

export function currentPublicCandyFamilyAuthorityRows(){
  return Object.freeze(PUBLIC_CANDY_FAMILY_AUTHORITY_ROWS.map(row=>freezeFamilyRow(row)));
}

export function resolvePublicCandyFamilyForSpecies(speciesName){
  const species=resolvePublicPokemonSpeciesAuthority(speciesName);
  if(species.status!=='MATCH'){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'PUBLIC_SPECIES_AUTHORITY_REQUIRED_FOR_CANDY_FAMILY',
      observed_species_name:displayText(speciesName),
      species_authority_status:species.status,
      family_id:null,
      family_membership_authority:false,
      candy_display_name:null,
      candy_display_name_authority:false,
    });
  }
  const family=FAMILY_BY_MEMBER.get(normalizeKey(species.display_name_zh_tw));
  if(!family){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'PUBLIC_CANDY_FAMILY_NOT_GOVERNED',
      observed_species_name:displayText(speciesName),
      canonical_species_name:species.display_name_zh_tw,
      family_id:null,
      family_membership_authority:false,
      candy_display_name:null,
      candy_display_name_authority:false,
    });
  }
  return Object.freeze({
    status:'MATCH',
    reason:'EXACT_GOVERNED_PUBLIC_CANDY_FAMILY',
    observed_species_name:displayText(speciesName),
    canonical_species_name:species.display_name_zh_tw,
    family_id:family.family_id,
    structural_root_species_name:family.structural_root_species_name,
    member_species_names:family.member_species_names,
    authority_class:family.authority_class,
    verification_status:family.verification_status,
    direct_candy_family_evidence:family.direct_candy_family_evidence,
    family_membership_authority:true,
    candy_display_name:null,
    candy_display_name_authority:false,
    source_refs:family.source_refs,
  });
}
