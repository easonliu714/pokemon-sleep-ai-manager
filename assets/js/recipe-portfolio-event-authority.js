export const RECIPE_PORTFOLIO_EVENT_AUTHORITY_VERSION='recipe-portfolio-event-authority-2026-08-17-a';

const positiveNumberOrNull=value=>{
  const n=Number(value);
  return value===null||value===undefined||value===''||!Number.isFinite(n)||n<=0?null:n;
};

export function resolveRecipePortfolioEnergyContext(week={}){
  const deterministic=week?.strategy_event_effects&&typeof week.strategy_event_effects==='object'
    ?week.strategy_event_effects
    :{};
  const verifiedMultiplier=positiveNumberOrNull(deterministic.recipe_final_energy_multiplier);
  const hasVerifiedMultiplier=verifiedMultiplier!==null;
  return Object.freeze({
    recipe_final_energy_multiplier:hasVerifiedMultiplier?verifiedMultiplier:1,
    deterministic_event_effect_available:hasVerifiedMultiplier,
    multiplier_source:hasVerifiedMultiplier?'PUBLIC_EVENT_MASTER_ACTIVE_VERIFIED':'DEFAULT_IDENTITY_NO_VERIFIED_EVENT_EFFECT',
    event_effect_registry_version:week?.event_effect_registry_version||null,
    event_effect_strategy_fingerprint:week?.event_effect_strategy_fingerprint||null,
    event_authority_source:week?.event_authority_source||'PUBLIC_EVENT_MASTER',
    public_event_master_version:week?.public_event_master_version||null,
    public_event_authority_version:week?.public_event_authority_version||null,
    public_event_authority_status:week?.public_event_authority_status||'PUBLIC_EVENT_MASTER_UNAVAILABLE',
    legacy_player_event_deterministic_authority:false,
    authority_version:RECIPE_PORTFOLIO_EVENT_AUTHORITY_VERSION,
  });
}
