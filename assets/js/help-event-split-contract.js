export const HELP_EVENT_SPLIT_CONTRACT_VERSION='help-event-split-contract-2026-08-13-a';
export const HELP_EVENT_SPLIT_CONTRACT_ID='pokemon-sleep-help-event-split-2026-08-13-a';
export const HELP_EVENT_SPLIT_AUTHORITY_STATUS='ACTIVE_VERIFIED_STRUCTURAL';
export const BASE_BERRY_OUTPUT_NUMERIC_STATUS='NOT_YET_VERIFIED';

export const HELP_EVENT_KIND=Object.freeze({
  REGULAR_HELP_BERRY_RESULT:'REGULAR_HELP_BERRY_RESULT',
  REGULAR_HELP_INGREDIENT_RESULT:'REGULAR_HELP_INGREDIENT_RESULT',
  DIRECT_MAIN_SKILL_BERRY_OUTPUT:'DIRECT_MAIN_SKILL_BERRY_OUTPUT',
  MAIN_SKILL_GENERATED_HELP:'MAIN_SKILL_GENERATED_HELP',
  EVENT_EXTRA_BERRY_MODIFIER:'EVENT_EXTRA_BERRY_MODIFIER',
  EXPERT_HELP_FREQUENCY_MODIFIER:'EXPERT_HELP_FREQUENCY_MODIFIER',
});

const OFFICIAL_SOURCE_REFS=Object.freeze({
  berry_week:'Pokémon Sleep official Buncha Berries Week Part 2: regular Berry helps can receive +1 Berry while Berry Burst is a separate main-skill effect',
  latias_event:'Pokémon Sleep official Latias Research: regular ingredient and Berry helps receive separate event modifiers',
  latias_skill:'Pokémon Sleep official Latias: Heal Pulse can instantly complete a number of usual helps',
  expert:'Pokémon Sleep official Expert Mode: main-favorite and non-favorite effects modify helping frequency separately',
});

const DEFINITIONS=Object.freeze([
  Object.freeze({
    kind:HELP_EVENT_KIND.REGULAR_HELP_BERRY_RESULT,
    base_berry_output_relation:'DIRECT_SCOPE',
    base_numeric_quantity_status:BASE_BERRY_OUTPUT_NUMERIC_STATUS,
    direct_main_skill_berry_output:false,
    modifier_only:false,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.berry_week,OFFICIAL_SOURCE_REFS.latias_event]),
  }),
  Object.freeze({
    kind:HELP_EVENT_KIND.REGULAR_HELP_INGREDIENT_RESULT,
    base_berry_output_relation:'OUT_OF_SCOPE_NON_BERRY_RESULT',
    base_numeric_quantity_status:'NOT_APPLICABLE',
    direct_main_skill_berry_output:false,
    modifier_only:false,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.latias_event]),
  }),
  Object.freeze({
    kind:HELP_EVENT_KIND.DIRECT_MAIN_SKILL_BERRY_OUTPUT,
    base_berry_output_relation:'OUT_OF_SCOPE_DIRECT_SKILL_EFFECT',
    base_numeric_quantity_status:'SEPARATE_MAIN_SKILL_EFFECT_RULE_REQUIRED',
    direct_main_skill_berry_output:true,
    modifier_only:false,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.berry_week]),
  }),
  Object.freeze({
    kind:HELP_EVENT_KIND.MAIN_SKILL_GENERATED_HELP,
    base_berry_output_relation:'APPLIES_ONLY_IF_GENERATED_HELP_RESOLVES_TO_BERRY_RESULT',
    base_numeric_quantity_status:BASE_BERRY_OUTPUT_NUMERIC_STATUS,
    direct_main_skill_berry_output:false,
    modifier_only:false,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.latias_skill]),
  }),
  Object.freeze({
    kind:HELP_EVENT_KIND.EVENT_EXTRA_BERRY_MODIFIER,
    base_berry_output_relation:'OUT_OF_SCOPE_EVENT_MODIFIER',
    base_numeric_quantity_status:'SEPARATE_EVENT_MODIFIER_RULE',
    direct_main_skill_berry_output:false,
    modifier_only:true,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.berry_week,OFFICIAL_SOURCE_REFS.latias_event]),
  }),
  Object.freeze({
    kind:HELP_EVENT_KIND.EXPERT_HELP_FREQUENCY_MODIFIER,
    base_berry_output_relation:'OUT_OF_SCOPE_FREQUENCY_MODIFIER',
    base_numeric_quantity_status:'SEPARATE_HELP_FREQUENCY_RULE',
    direct_main_skill_berry_output:false,
    modifier_only:true,
    source_refs:Object.freeze([OFFICIAL_SOURCE_REFS.expert]),
  }),
]);

const BY_KIND=new Map(DEFINITIONS.map(row=>[row.kind,row]));

export const HELP_EVENT_SPLIT_BOUNDARY=Object.freeze({
  structural_status:HELP_EVENT_SPLIT_AUTHORITY_STATUS,
  base_numeric_berry_output_status:BASE_BERRY_OUTPUT_NUMERIC_STATUS,
  regular_berry_help_is_direct_scope:true,
  regular_ingredient_help_is_non_berry_result:true,
  direct_main_skill_berry_output_is_separate:true,
  main_skill_generated_help_is_not_direct_berry_output:true,
  event_extra_berry_is_modifier_only:true,
  expert_help_frequency_is_modifier_only:true,
  missing_is_zero:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
});

export function helpEventSplitDefinition(kind){return BY_KIND.get(String(kind||''))||null;}
export function isBaseBerryOutputScopedHelp(kind){return helpEventSplitDefinition(kind)?.base_berry_output_relation==='DIRECT_SCOPE';}
export function currentHelpEventSplitContract(){
  return Object.freeze({
    schema:'pokemon-sleep-help-event-split-contract/1.0',
    contract_id:HELP_EVENT_SPLIT_CONTRACT_ID,
    contract_version:HELP_EVENT_SPLIT_CONTRACT_VERSION,
    authority_status:HELP_EVENT_SPLIT_AUTHORITY_STATUS,
    base_numeric_berry_output_status:BASE_BERRY_OUTPUT_NUMERIC_STATUS,
    definitions:DEFINITIONS,
    boundary:HELP_EVENT_SPLIT_BOUNDARY,
    source_refs:Object.freeze(Object.values(OFFICIAL_SOURCE_REFS)),
  });
}
