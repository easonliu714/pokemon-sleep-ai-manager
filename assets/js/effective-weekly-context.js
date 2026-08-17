import {currentWeeklyContext,weeklyContextForEpoch} from './weekly-context-store.js';
import {resolveCachedPublicEventProjection} from './public-event-master-store.js';

export const EFFECTIVE_WEEKLY_CONTEXT_VERSION='effective-weekly-context-2026-08-17-a';

const numberOrNull=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const frozen=value=>Object.freeze(stable(value));

export function buildEffectiveWeeklyContext({playerContext={},publicEventProjection=null}={}){
  const publicProjection=publicEventProjection||null;
  const publicEffects=publicProjection?.event_effects||{};
  const deterministic=publicProjection?.strategy_event_effects||{};
  const featureOnly=publicProjection?.feature_only_event_effects||{};
  const fieldSources={...(playerContext.field_sources||{})};
  fieldSources.event_name='PUBLIC_EVENT_MASTER';
  fieldSources.event_effects='PUBLIC_EVENT_MASTER';
  for(const key of Object.keys(publicEffects))fieldSources[`event_effects.${key}`]='PUBLIC_EVENT_MASTER';

  const legacyObservation=Object.freeze({
    event_name:playerContext.event_name||null,
    event_effects:playerContext.event_effects||null,
    event_effects_parsed:playerContext.event_effects_parsed||{},
    field_source_event_name:playerContext.field_sources?.event_name||null,
    field_source_event_effects:playerContext.field_sources?.event_effects||null,
    semantics:'LEGACY_PLAYER_OBSERVATION_AUDIT_ONLY',
    deterministic_authority:false,
  });

  return Object.freeze({
    ...playerContext,
    event_name:publicProjection?.event_name||null,
    event_effects:publicProjection?.event_effects_serialized||null,
    event_effects_parsed:frozen(publicEffects),
    event_effect_registry_version:publicProjection?.event_effect_registry_version||null,
    event_effect_states:publicProjection?.event_effect_states||Object.freeze([]),
    strategy_event_effects:frozen(deterministic),
    feature_only_event_effects:frozen(featureOnly),
    review_event_effects:publicProjection?.review_event_effects||Object.freeze([]),
    event_effect_strategy_fingerprint:publicProjection?.event_effect_strategy_fingerprint||null,
    event_effect_review_required:Boolean(publicProjection?.event_effect_review_required),
    recipe_final_energy_multiplier:numberOrNull(deterministic.recipe_final_energy_multiplier),
    extra_tasty_multiplier:numberOrNull(publicEffects.extra_tasty_multiplier),
    sunday_extra_tasty_multiplier:numberOrNull(publicEffects.sunday_extra_tasty_multiplier),
    sunday_pot_multiplier:numberOrNull(deterministic.sunday_pot_multiplier),
    public_event_master_version:publicProjection?.master_version||null,
    public_event_authority_version:publicProjection?.authority_version||null,
    public_event_authority_status:publicProjection?.event_authority_status||'PUBLIC_EVENT_MASTER_UNAVAILABLE',
    public_event_active_count:Number(publicProjection?.active_event_count||0),
    public_event_active_events:publicProjection?.active_events||Object.freeze([]),
    public_event_effect_conflicts:publicProjection?.effect_conflicts||Object.freeze([]),
    event_authority_source:'PUBLIC_EVENT_MASTER',
    player_weekly_authority_source:playerContext.authority_source||'MISSING',
    effective_context_version:EFFECTIVE_WEEKLY_CONTEXT_VERSION,
    effective_context_provenance:Object.freeze({
      player_weekly_context:'PLAYER_WEEKLY_CONTEXT',
      camp_projection:'PUBLIC_CAMP_MASTER',
      event_projection:'PUBLIC_EVENT_MASTER',
    }),
    legacy_player_event_observation:legacyObservation,
    field_sources:Object.freeze(fieldSources),
  });
}

export function currentEffectiveWeeklyContext({date=new Date()}={}){
  const playerContext=currentWeeklyContext({date});
  const publicEventProjection=resolveCachedPublicEventProjection({date,camp:playerContext.camp});
  return buildEffectiveWeeklyContext({playerContext,publicEventProjection});
}

export function effectiveWeeklyContextForEpoch(weekStart,{date=new Date()}={}){
  const playerContext=weeklyContextForEpoch(weekStart);
  if(!playerContext)return null;
  const publicEventProjection=resolveCachedPublicEventProjection({date,camp:playerContext.camp});
  return buildEffectiveWeeklyContext({playerContext,publicEventProjection});
}
