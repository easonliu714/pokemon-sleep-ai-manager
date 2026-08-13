export const BASE_BERRY_OUTPUT_CONTRACT_VERSION='base-berry-output-contract-2026-08-13-a';
export const BASE_BERRY_OUTPUT_CONTRACT_ID='pokemon-sleep-base-berry-output-2026-08-13-a';
export const BASE_BERRY_OUTPUT_AUTHORITY_STATUS='ACTIVE_VERIFIED';
export const BASE_BERRY_OUTPUT_SCOPE='REGULAR_BERRY_RESULT_HELP_PRE_EVENT_PRE_EXPERT';
export const BERRY_FINDING_S_BONUS=1;
export const BERRY_SPECIALTY_BASE_OUTPUT=2;
export const OTHER_SPECIALTY_BASE_OUTPUT=1;

const text=value=>String(value??'').normalize('NFKC').trim();
const lower=value=>text(value).toLocaleLowerCase('en-US');
const BERRY_SPECIALTY_ALIASES=new Set(['樹果','樹果型','berries','berry','berries specialty','berry specialty'].map(lower));
const KNOWN_NON_BERRY_SPECIALTY_ALIASES=new Set(['食材','食材型','ingredients','ingredient','ingredients specialty','ingredient specialty','技能','技能型','skills','skill','skills specialty','skill specialty'].map(lower));
const BERRY_FINDING_S_ALIASES=new Set(['樹果數量S','Berry Finding S','きのみの数S','きのみの數S'].map(lower));
const UNLOCK_LEVELS=Object.freeze([10,25,50,75,100]);

export const BASE_BERRY_OUTPUT_BOUNDARY=Object.freeze({
  applies_to:'REGULAR_HELP_BERRY_RESULT_ONLY',
  berry_specialty_base_output:BERRY_SPECIALTY_BASE_OUTPUT,
  other_specialty_base_output:OTHER_SPECIALTY_BASE_OUTPUT,
  berry_finding_s_bonus:BERRY_FINDING_S_BONUS,
  excluded_modifiers:Object.freeze([
    'EVENT_EXTRA_BERRY_MODIFIER',
    'EXPERT_MODE_MAIN_FAVORITE_EXTRA_BERRY',
    'DIRECT_MAIN_SKILL_BERRY_OUTPUT',
    'BERRY_BURST_OR_EQUIVALENT_MAIN_SKILL_OUTPUT',
    'GENERATED_HELP_OUTCOME_PROBABILITY',
    'INGREDIENT_RESULT_HELP',
  ]),
  missing_is_zero:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
});

export function expectedUnlockedSubskillSlotCount(level){
  const n=Number(level);
  if(!Number.isInteger(n)||n<1)return null;
  return UNLOCK_LEVELS.filter(threshold=>threshold<=n).length;
}

export function hasUnlockedBerryFindingS(unlockedSubskills=[]){
  return (Array.isArray(unlockedSubskills)?unlockedSubskills:[]).some(row=>BERRY_FINDING_S_ALIASES.has(lower(row?.subskill_name??row)));
}

export function isBerrySpecialty(specialty){return BERRY_SPECIALTY_ALIASES.has(lower(specialty));}
export function isKnownNonBerrySpecialty(specialty){return KNOWN_NON_BERRY_SPECIALTY_ALIASES.has(lower(specialty));}

export function hasCompleteUnlockedSubskillEvidence(candidate={}){
  const expected=expectedUnlockedSubskillSlotCount(candidate?.level);
  if(expected===null)return false;
  if(expected===0)return true;
  const observed=Number(candidate?.unlocked_subskill_slot_count);
  return Number.isInteger(observed)&&observed>=expected;
}

export function resolveBaseBerryOutputPerRegularBerryResultHelp({specialty,unlockedSubskills=[],subskillEvidenceComplete=true}={}){
  if(!subskillEvidenceComplete)return Object.freeze({
    status:'SUBSKILL_EVIDENCE_INCOMPLETE',base_output:null,berry_finding_s_bonus:null,total_output:null,scope:BASE_BERRY_OUTPUT_SCOPE,
  });
  const berrySpecialty=isBerrySpecialty(specialty),knownOther=isKnownNonBerrySpecialty(specialty);
  if(!berrySpecialty&&!knownOther)return Object.freeze({
    status:'SPECIALTY_NOT_VERIFIED',base_output:null,berry_finding_s_bonus:null,total_output:null,scope:BASE_BERRY_OUTPUT_SCOPE,
  });
  const baseOutput=berrySpecialty?BERRY_SPECIALTY_BASE_OUTPUT:OTHER_SPECIALTY_BASE_OUTPUT;
  const berryFindingBonus=hasUnlockedBerryFindingS(unlockedSubskills)?BERRY_FINDING_S_BONUS:0;
  return Object.freeze({
    status:'ACTIVE_VERIFIED',base_output:baseOutput,berry_finding_s_bonus:berryFindingBonus,total_output:baseOutput+berryFindingBonus,scope:BASE_BERRY_OUTPUT_SCOPE,
  });
}

export function resolveCandidateBaseBerryOutput(candidate={}){
  return resolveBaseBerryOutputPerRegularBerryResultHelp({
    specialty:candidate?.specialty,
    unlockedSubskills:candidate?.unlocked_subskills||[],
    subskillEvidenceComplete:hasCompleteUnlockedSubskillEvidence(candidate),
  });
}

export function currentBaseBerryOutputContract(){
  return Object.freeze({
    schema:'pokemon-sleep-base-berry-output-contract/1.0',
    contract_version:BASE_BERRY_OUTPUT_CONTRACT_VERSION,
    contract_id:BASE_BERRY_OUTPUT_CONTRACT_ID,
    authority_status:BASE_BERRY_OUTPUT_AUTHORITY_STATUS,
    scope:BASE_BERRY_OUTPUT_SCOPE,
    formula:Object.freeze({
      berry_specialty_base_output:BERRY_SPECIALTY_BASE_OUTPUT,
      other_specialty_base_output:OTHER_SPECIALTY_BASE_OUTPUT,
      unlocked_berry_finding_s_additive_bonus:BERRY_FINDING_S_BONUS,
      expression:'base_regular_berry_result_output + unlocked_berry_finding_s_bonus',
    }),
    boundary:BASE_BERRY_OUTPUT_BOUNDARY,
    source_refs:Object.freeze([
      'Serebii Pokémon Sleep berry producer tables: Berries specialty Quantity 2; other specialties Quantity 1',
      'Serebii Pokémon Sleep Skills: Berry Finding S increases Berries found at one time by 1',
      'Pokémon Sleep official Buncha Berries Week Part 2: event +1 Berry is a separate event modifier on regular Berry helps',
      'Pokémon Sleep official Expert Mode: helping-related main-favorite effects are separate modifiers',
    ]),
  });
}
