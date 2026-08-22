import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const minimumPatch=24;
const isSupportedVersion=version=>{const match=/^v0\.4\.27\.(\d+)$/.exec(String(version||''));return Boolean(match)&&Number(match[1])>=minimumPatch;};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction((minimum)=>{const match=/^v0\.4\.27\.(\d+)$/.exec(String(globalThis.PokemonSleepVersionAuthority?.app_version||''));return Boolean(match)&&Number(match[1])>=minimum;},minimumPatch,{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000});
  await page.waitForFunction(()=>Boolean(document.getElementById('e3c6bFirstPartyPanel')),{timeout:30000});

  const result=await page.evaluate(async()=>{
    const panel=document.getElementById('e3c6bFirstPartyPanel');
    const completeness=panel?.querySelector('[name="berry_count_completeness_status"]');
    const contract=await import(`./assets/js/ingredient-probability-first-party-observation-contract.js?browser=v042724`);
    const eligibility=await import(`./assets/js/ingredient-probability-first-party-observation-ui-eligibility.js?browser=v042724`);
    const roster=await import(`./assets/js/public-pokemon-species-form-roster.js?browser=v042724`);
    const row=roster.PUBLIC_SPECIES_FORM_ROSTER_ROWS[0];
    const candidate=eligibility.resolveFirstPartyObservationUiCandidate({level:30,ingredient_slots:[
      {unlock_level:1,ingredient_name:'特選蘋果',quantity:1},
      {unlock_level:30,ingredient_name:'暖暖薑',quantity:2},
    ],individual_ingredient_rate_modifier_present:false});
    const partial=contract.evaluateFirstPartyIngredientHelpObservation({
      observation_id:'FPO-BROWSER-V042724',observation_series_id:'FPS-BROWSER-V042724',window_sequence:1,
      observation_source:contract.FIRST_PARTY_OBSERVATION_SOURCE,
      observation_mode:contract.FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY,
      source_key:row.source_key,canonical_species_form_id:row.canonical_species_form_id,
      species_form_identity_confirmed:true,player_private_identity_included:false,
      observation_evidence_refs:['browser-window'],level:30,
      ingredient_slots:[
        {unlock_level:1,ingredient_name:'特選蘋果',quantity:1,observed_item_count:2},
        {unlock_level:30,ingredient_name:'暖暖薑',quantity:2,observed_item_count:6},
      ],
      individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
      inventory_empty_at_window_start:true,collection_before_inventory_overflow_confirmed:true,
      sneaky_snacking_or_overflow_observed:false,helper_whistle_used:false,external_extra_help_effect_used:false,
      non_help_item_contamination:false,collection_counts_complete:true,external_rate_value_used_to_reconstruct_events:false,
      berry_items_collected:25,ingredient_items_collected:8,berry_items_per_help:2,berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',
      inventory_items_before_collection:33,inventory_capacity:40,
      berry_count_completeness_status:contract.BERRY_COUNT_COMPLETENESS.POSSIBLY_CENSORED_BY_SNORLAX,
    });
    return {
      version:globalThis.PokemonSleepVersionAuthority?.app_version,
      heading:panel?.querySelector('h3')?.textContent||'',
      notice:panel?.querySelector('p.notice')?.textContent||'',
      defaultCompleteness:completeness?.value||null,
      hasSeries:panel?.textContent?.includes('觀測 series')||false,
      hasRepeated:panel?.textContent?.includes('多次觀測')||false,
      candidate,
      partial,
    };
  });

  assert.equal(isSupportedVersion(result.version),true);
  assert.match(result.heading,/E3C-6F/);
  assert.match(result.notice,/卡比獸/);
  assert.equal(result.defaultCompleteness,'POSSIBLY_CENSORED_BY_SNORLAX');
  assert.equal(result.hasSeries,true);
  assert.equal(result.hasRepeated,true);
  assert.equal(result.candidate.visible,true);
  assert.equal(result.candidate.observation_mode,'DIRECT_MANUAL_COLLECTION_MULTI_SLOT_DISTINCT_QUANTITY_WINDOW');
  assert.equal(result.partial.status,'ACCEPTED_PARTIAL_OBSERVATION');
  assert.equal(result.partial.ingredient_help_event_count,5);
  assert.equal(result.partial.total_help_event_count,null);
  assert.equal(result.partial.eligible_for_statistical_aggregation,false);
  assert.equal(result.partial.safety.repeated_windows_do_not_rescue_censored_denominator,true);

  console.log(JSON.stringify({status:'PASS',gate:'V042724_BROWSER_E3C6F_CENSORED_SERIES_SUCCESSOR_AWARE',result,minimum_patch:minimumPatch},null,2));
}finally{await browser.close();}
