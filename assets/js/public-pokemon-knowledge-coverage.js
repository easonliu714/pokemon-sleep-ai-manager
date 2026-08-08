import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  PUBLIC_NATURE_MASTER,
  PUBLIC_MAIN_SKILL_MASTER,
  PUBLIC_EVOLUTION_MASTER,
} from './public-pokemon-knowledge-master.js';

const text=value=>String(value??'').normalize('NFKC').trim();
const uniqueSorted=values=>[...new Set(values.map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const duplicateValues=values=>{const seen=new Set(),duplicates=new Set();for(const value of values.map(text).filter(Boolean)){if(seen.has(value))duplicates.add(value);else seen.add(value);}return [...duplicates].sort();};
const skillKey=value=>text(value).replace(/\s+/g,'');

export const PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS=Object.freeze({
  nature:'COMPLETE_GAME_VISIBLE_EFFECT_AXES',
  main_skill:'PARTIAL_VERIFIED_ONLY',
  evolution:'PARTIAL_VERIFIED_ONLY_NON_TERMINAL',
  berry:'PUBLIC_TYPE_TO_BERRY_REFERENCE',
  no_verified_evolution_route:'UNKNOWN_OR_TERMINAL_NOT_CLASSIFIED',
});

export function auditPublicPokemonKnowledgeBundle(){
  const errors=[];
  const warnings=[];
  const natureNames=PUBLIC_NATURE_MASTER.map(row=>row.nature_name);
  const skillNames=PUBLIC_MAIN_SKILL_MASTER.map(row=>row.main_skill_name);
  const evolutionKeys=PUBLIC_EVOLUTION_MASTER.map(row=>`${row.from_species}→${row.to_species}`);

  if(PUBLIC_NATURE_MASTER.length!==25)errors.push(`nature_master 應有 25 種性格，目前為 ${PUBLIC_NATURE_MASTER.length}`);
  for(const value of duplicateValues(natureNames))errors.push(`nature_master 名稱重複：${value}`);
  for(const row of PUBLIC_NATURE_MASTER){
    if(!text(row.positive_effect)||!text(row.negative_effect))errors.push(`nature_master 缺少效果方向：${row.nature_name}`);
    if(!text(row.source_ref))errors.push(`nature_master 缺少 source_ref：${row.nature_name}`);
    if(row.data_version!==PUBLIC_POKEMON_KNOWLEDGE_VERSION)errors.push(`nature_master 版本不一致：${row.nature_name}`);
  }

  for(const value of duplicateValues(skillNames))errors.push(`main_skill_master 名稱重複：${value}`);
  for(const row of PUBLIC_MAIN_SKILL_MASTER){
    if(!text(row.description_zh_tw))errors.push(`main_skill_master 缺少說明：${row.main_skill_name}`);
    if(!text(row.source_ref))errors.push(`main_skill_master 缺少 source_ref：${row.main_skill_name}`);
    if(!text(row.verification_status))errors.push(`main_skill_master 缺少 verification_status：${row.main_skill_name}`);
    if(row.data_version!==PUBLIC_POKEMON_KNOWLEDGE_VERSION)errors.push(`main_skill_master 版本不一致：${row.main_skill_name}`);
  }

  for(const value of duplicateValues(evolutionKeys))errors.push(`pokemon_evolution_master route 重複：${value}`);
  for(const row of PUBLIC_EVOLUTION_MASTER){
    if(!text(row.from_species)||!text(row.to_species))errors.push('pokemon_evolution_master 存在空白 from/to species');
    if(text(row.from_species)===text(row.to_species))errors.push(`pokemon_evolution_master 不允許 self-loop：${row.from_species}`);
    if(!text(row.source_ref))errors.push(`pokemon_evolution_master 缺少 source_ref：${row.from_species}→${row.to_species}`);
    if(row.required_level!=null&&Number(row.required_level)<=0)errors.push(`pokemon_evolution_master 等級門檻不合法：${row.from_species}→${row.to_species}`);
    if(row.required_sleep_hours!=null&&Number(row.required_sleep_hours)<0)errors.push(`pokemon_evolution_master 共眠門檻不合法：${row.from_species}→${row.to_species}`);
    if(row.required_candy!=null&&Number(row.required_candy)<0)errors.push(`pokemon_evolution_master 糖果門檻不合法：${row.from_species}→${row.to_species}`);
    if(row.data_version!==PUBLIC_POKEMON_KNOWLEDGE_VERSION)errors.push(`pokemon_evolution_master 版本不一致：${row.from_species}→${row.to_species}`);
  }

  const canonicalSkillCount=PUBLIC_MAIN_SKILL_MASTER.filter(row=>row.verification_status!=='COMPATIBILITY_ALIAS').length;
  const compatibilityAliasCount=PUBLIC_MAIN_SKILL_MASTER.length-canonicalSkillCount;
  if(canonicalSkillCount===0)warnings.push('main_skill_master 尚無 canonical verified rows');
  if(PUBLIC_EVOLUTION_MASTER.length===0)warnings.push('pokemon_evolution_master 尚無 verified routes');

  return Object.freeze({
    version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
    ok:errors.length===0,
    errors:Object.freeze(errors),
    warnings:Object.freeze(warnings),
    manifest:Object.freeze({
      nature_rows:PUBLIC_NATURE_MASTER.length,
      nature_expected:25,
      main_skill_rows:PUBLIC_MAIN_SKILL_MASTER.length,
      main_skill_canonical_rows:canonicalSkillCount,
      main_skill_compatibility_alias_rows:compatibilityAliasCount,
      evolution_route_rows:PUBLIC_EVOLUTION_MASTER.length,
      evolution_from_species_rows:new Set(PUBLIC_EVOLUTION_MASTER.map(row=>text(row.from_species))).size,
      berry_type_rows:PUBLIC_BERRY_TYPES.length,
      nature_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.nature,
      main_skill_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.main_skill,
      evolution_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.evolution,
      berry_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.berry,
      projection_only:true,
      player_rows_may_be_mutated:false,
    }),
  });
}

function resolveSkill(value){
  const raw=text(value);
  if(!raw)return null;
  const exact=PUBLIC_MAIN_SKILL_MASTER.find(row=>skillKey(row.main_skill_name)===skillKey(raw));
  if(exact)return exact.main_skill_name;
  const base=raw.split('（')[0].trim();
  if(base&&base!==raw){
    const candidate=PUBLIC_MAIN_SKILL_MASTER.find(row=>skillKey(row.main_skill_name)===skillKey(base));
    if(candidate)return candidate.main_skill_name;
  }
  return null;
}

export function buildObservedProjectionCoverage(pokemonRows=[]){
  const pokemon=Array.isArray(pokemonRows)?pokemonRows:[];
  const observedNatures=uniqueSorted(pokemon.map(row=>row.nature));
  const observedSkills=uniqueSorted(pokemon.map(row=>row.main_skill));
  const observedTypes=uniqueSorted(pokemon.map(row=>row.type));
  const observedSpecies=uniqueSorted(pokemon.map(row=>row.current_species||row.species));

  const natureSet=new Set(PUBLIC_NATURE_MASTER.map(row=>text(row.nature_name)));
  const berryTypeSet=new Set(PUBLIC_BERRY_TYPES.map(row=>text(row.type_name)));
  const evolutionFromSet=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>text(row.from_species)));

  const resolvedNatures=observedNatures.filter(value=>natureSet.has(value));
  const unresolvedNatures=observedNatures.filter(value=>!natureSet.has(value));
  const resolvedSkills=observedSkills.filter(value=>Boolean(resolveSkill(value)));
  const unresolvedSkills=observedSkills.filter(value=>!resolveSkill(value));
  const resolvedTypes=observedTypes.filter(value=>berryTypeSet.has(value));
  const unresolvedTypes=observedTypes.filter(value=>!berryTypeSet.has(value));
  const knownOutgoing=observedSpecies.filter(value=>evolutionFromSet.has(value));
  const noVerifiedOutgoing=observedSpecies.filter(value=>!evolutionFromSet.has(value));

  const metric=(observed,resolved,unresolved)=>Object.freeze({observed:observed.length,resolved:resolved.length,unresolved:unresolved.length,resolved_values:Object.freeze(resolved),unresolved_values:Object.freeze(unresolved)});
  return Object.freeze({
    pokemon_rows:pokemon.length,
    nature:metric(observedNatures,resolvedNatures,unresolvedNatures),
    main_skill:metric(observedSkills,resolvedSkills,unresolvedSkills),
    berry_type:metric(observedTypes,resolvedTypes,unresolvedTypes),
    evolution:Object.freeze({
      observed_species:observedSpecies.length,
      verified_outgoing_route_species:knownOutgoing.length,
      no_verified_outgoing_route_species:noVerifiedOutgoing.length,
      verified_outgoing_values:Object.freeze(knownOutgoing),
      no_verified_outgoing_values:Object.freeze(noVerifiedOutgoing),
      semantics:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.no_verified_evolution_route,
    }),
  });
}

export function publicPokemonKnowledgeCoverageReport(pokemonRows=[]){
  return Object.freeze({bundle:auditPublicPokemonKnowledgeBundle(),observed:buildObservedProjectionCoverage(pokemonRows)});
}
