import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  PUBLIC_NATURE_MASTER,
  PUBLIC_MAIN_SKILL_MASTER,
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_EVOLUTION_STATUS_MASTER,
} from './public-pokemon-knowledge-master.js';

const text=value=>String(value??'').normalize('NFKC').trim();
const uniqueSorted=values=>[...new Set(values.map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const duplicateValues=values=>{const seen=new Set(),duplicates=new Set();for(const value of values.map(text).filter(Boolean)){if(seen.has(value))duplicates.add(value);else seen.add(value);}return [...duplicates].sort();};
// Game/OCR/AI JSON can contain invisible format code points that render identically
// to the canonical skill label. Strip only format/variation characters from the
// comparison key; the original player value remains untouched in SQLite/UI.
const SKILL_INVISIBLE_FORMAT_RE=/[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF]/g;
const normalizeSkillPunctuation=value=>text(value).replace(SKILL_INVISIBLE_FORMAT_RE,'').replaceAll('(','（').replaceAll(')','）');
const skillKey=value=>normalizeSkillPunctuation(value).replace(/\s+/g,'');

// Resolver-only compatibility aliases. These strings came from older OCR/AI update
// payloads and are not canonical game labels. They are used only to project public
// knowledge and calculate coverage; player SQLite values are never rewritten here.
const LEGACY_SKILL_CANONICAL_ALIASES=new Map([
  [skillKey('樹果遞增'),'樹果遽增'],
  [skillKey('樹果速增'),'樹果遽增'],
  [skillKey('流星群（樹果遞增）'),'流星群（樹果遽增）'],
  [skillKey('流星群（樹果速增）'),'流星群（樹果遽增）'],
]);

export const PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS=Object.freeze({
  nature:'COMPLETE_GAME_VISIBLE_EFFECT_AXES',
  main_skill:'PARTIAL_VERIFIED_ONLY',
  evolution:'PARTIAL_VERIFIED_ONLY_NON_TERMINAL',
  evolution_triage:'VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN',
  verified_terminal:'VERIFIED_TERMINAL_CURRENT_SLEEP',
  unknown_evolution_status:'UNKNOWN_NOT_YET_VERIFIED',
  berry:'PUBLIC_TYPE_TO_BERRY_REFERENCE',
  no_verified_evolution_route:'UNKNOWN_OR_TERMINAL_NOT_CLASSIFIED',
});

export const EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA='pokemon-sleep-evolution-coverage-diagnostic/1.0';
export const EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION='data-evo1-evolution-coverage-diagnostic-2026-08-10-a';

export function auditPublicPokemonKnowledgeBundle(){
  const errors=[];
  const warnings=[];
  const natureNames=PUBLIC_NATURE_MASTER.map(row=>row.nature_name);
  const skillNames=PUBLIC_MAIN_SKILL_MASTER.map(row=>row.main_skill_name);
  const evolutionKeys=PUBLIC_EVOLUTION_MASTER.map(row=>`${row.from_species}→${row.to_species}`);
  const terminalNames=PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name);

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

  for(const value of duplicateValues(terminalNames))errors.push(`pokemon_evolution_status_master 名稱重複：${value}`);
  const outgoingSet=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>text(row.from_species)));
  for(const row of PUBLIC_EVOLUTION_STATUS_MASTER){
    if(!text(row.species_name))errors.push('pokemon_evolution_status_master 存在空白 species_name');
    if(row.evolution_status!==PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.verified_terminal)errors.push(`pokemon_evolution_status_master status 不支援：${row.species_name}`);
    if(outgoingSet.has(text(row.species_name)))errors.push(`終階物種不可同時存在 outgoing route：${row.species_name}`);
    if(!text(row.source_ref))errors.push(`pokemon_evolution_status_master 缺少 source_ref：${row.species_name}`);
    if(!text(row.verification_status))errors.push(`pokemon_evolution_status_master 缺少 verification_status：${row.species_name}`);
    if(row.data_version!==PUBLIC_POKEMON_KNOWLEDGE_VERSION)errors.push(`pokemon_evolution_status_master 版本不一致：${row.species_name}`);
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
      evolution_verified_terminal_rows:PUBLIC_EVOLUTION_STATUS_MASTER.length,
      berry_type_rows:PUBLIC_BERRY_TYPES.length,
      nature_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.nature,
      main_skill_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.main_skill,
      evolution_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.evolution,
      evolution_triage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.evolution_triage,
      berry_coverage_status:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.berry,
      projection_only:true,
      player_rows_may_be_mutated:false,
    }),
  });
}

export function resolvePublicMainSkillName(value){
  const raw=normalizeSkillPunctuation(value);
  if(!raw)return null;
  const alias=LEGACY_SKILL_CANONICAL_ALIASES.get(skillKey(raw));
  if(alias)return alias;
  const exact=PUBLIC_MAIN_SKILL_MASTER.find(row=>skillKey(row.main_skill_name)===skillKey(raw));
  if(exact)return exact.main_skill_name;
  const base=raw.split('（')[0].trim();
  if(base&&base!==raw){
    const baseAlias=LEGACY_SKILL_CANONICAL_ALIASES.get(skillKey(base));
    if(baseAlias)return baseAlias;
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
  const verifiedTerminalSet=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.filter(row=>row.evolution_status===PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.verified_terminal).map(row=>text(row.species_name)));

  const resolvedNatures=observedNatures.filter(value=>natureSet.has(value));
  const unresolvedNatures=observedNatures.filter(value=>!natureSet.has(value));
  const resolvedSkills=observedSkills.filter(value=>Boolean(resolvePublicMainSkillName(value)));
  const unresolvedSkills=observedSkills.filter(value=>!resolvePublicMainSkillName(value));
  const resolvedTypes=observedTypes.filter(value=>berryTypeSet.has(value));
  const unresolvedTypes=observedTypes.filter(value=>!berryTypeSet.has(value));
  const knownOutgoing=observedSpecies.filter(value=>evolutionFromSet.has(value));
  const verifiedTerminal=observedSpecies.filter(value=>verifiedTerminalSet.has(value));
  const unknownEvolution=observedSpecies.filter(value=>!evolutionFromSet.has(value)&&!verifiedTerminalSet.has(value));
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
      verified_terminal_species:verifiedTerminal.length,
      unknown_evolution_status_species:unknownEvolution.length,
      no_verified_outgoing_route_species:noVerifiedOutgoing.length,
      verified_outgoing_values:Object.freeze(knownOutgoing),
      verified_terminal_values:Object.freeze(verifiedTerminal),
      unknown_evolution_status_values:Object.freeze(unknownEvolution),
      no_verified_outgoing_values:Object.freeze(noVerifiedOutgoing),
      semantics:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.no_verified_evolution_route,
      triage_semantics:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.evolution_triage,
      terminal_semantics:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.verified_terminal,
      unknown_semantics:PUBLIC_POKEMON_KNOWLEDGE_COVERAGE_SEMANTICS.unknown_evolution_status,
    }),
  });
}

export function buildEvolutionCoverageDiagnostic(pokemonRows=[]){
  const observed=buildObservedProjectionCoverage(pokemonRows);
  const evolution=observed.evolution;
  const outgoing=[...evolution.verified_outgoing_values];
  const terminal=[...evolution.verified_terminal_values];
  const unknown=[...evolution.unknown_evolution_status_values];
  const partitionCount=outgoing.length+terminal.length+unknown.length;
  return Object.freeze({
    schema:EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
    version:EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,
    public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
    semantics:evolution.triage_semantics,
    observed_species_count:evolution.observed_species,
    verified_outgoing_count:evolution.verified_outgoing_route_species,
    verified_terminal_count:evolution.verified_terminal_species,
    unknown_count:evolution.unknown_evolution_status_species,
    unknown_values_count:unknown.length,
    count_list_parity:evolution.unknown_evolution_status_species===unknown.length,
    partition_count:partitionCount,
    partition_parity:partitionCount===evolution.observed_species,
    verified_outgoing_species:Object.freeze(outgoing),
    verified_terminal_species:Object.freeze(terminal),
    unknown_species:Object.freeze(unknown),
    privacy:Object.freeze({species_names_only:true,player_ids_exported:false,quantities_exported:false,notes_exported:false}),
  });
}

export function publicPokemonKnowledgeCoverageReport(pokemonRows=[]){
  return Object.freeze({bundle:auditPublicPokemonKnowledgeBundle(),observed:buildObservedProjectionCoverage(pokemonRows)});
}
