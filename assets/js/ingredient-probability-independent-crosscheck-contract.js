export const INGREDIENT_PROBABILITY_INDEPENDENT_CROSSCHECK_ID='ingredient-probability-independent-crosscheck-2026-08-14-a';
export const INGREDIENT_PROBABILITY_INDEPENDENT_CROSSCHECK_VERSION='ingredient-probability-independent-crosscheck-v1';

export const INDEPENDENT_CROSSCHECK_SOURCE_STATUS=Object.freeze({
  INDEPENDENCE_ACCEPTED:'INDEPENDENCE_ACCEPTED',
  INDEPENDENCE_NOT_YET_ESTABLISHED:'INDEPENDENCE_NOT_YET_ESTABLISHED',
  DERIVED_OR_MIRROR_OF_PRIMARY:'DERIVED_OR_MIRROR_OF_PRIMARY',
  AI_OR_UNTRACEABLE_SUMMARY:'AI_OR_UNTRACEABLE_SUMMARY',
});

export const INDEPENDENT_CROSSCHECK_RESULT=Object.freeze({
  EXACT_MATCH:'EXACT_MATCH',
  NUMERIC_CONFLICT:'NUMERIC_CONFLICT',
  INDEPENDENT_VALUE_MISSING:'INDEPENDENT_VALUE_MISSING',
  PRIMARY_VALUE_MISSING:'PRIMARY_VALUE_MISSING',
  INDEPENDENCE_NOT_ACCEPTED:'INDEPENDENCE_NOT_ACCEPTED',
});

const text=value=>String(value??'').normalize('NFKC').trim();
const freeze=value=>Object.freeze(value);

export function canonicalPublishedDecimal(value){
  const raw=text(value);
  if(!/^[+]?(?:\d+\.?\d*|\.\d+)$/.test(raw))return null;
  const [wholeRaw,fractionRaw='']=raw.replace(/^\+/,'').split('.');
  const whole=String(Number(wholeRaw||'0'));
  const fraction=fractionRaw.replace(/0+$/,'');
  return fraction?`${whole}.${fraction}`:whole;
}

export function compareIndependentIngredientProbability({primary=null,independent=null}={}){
  if(!primary||primary.ingredient_percentage===null||primary.ingredient_percentage===undefined)return freeze({status:INDEPENDENT_CROSSCHECK_RESULT.PRIMARY_VALUE_MISSING,crosscheck_accepted:false,activation_authority_granted:false});
  if(!independent||independent.ingredient_percentage===null||independent.ingredient_percentage===undefined)return freeze({status:INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENT_VALUE_MISSING,crosscheck_accepted:false,activation_authority_granted:false});
  if(independent.independence_status!==INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED)return freeze({status:INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENCE_NOT_ACCEPTED,crosscheck_accepted:false,activation_authority_granted:false});
  const primaryDecimal=canonicalPublishedDecimal(primary.ingredient_percentage);
  const independentDecimal=canonicalPublishedDecimal(independent.ingredient_percentage);
  if(primaryDecimal===null||independentDecimal===null)return freeze({status:INDEPENDENT_CROSSCHECK_RESULT.NUMERIC_CONFLICT,crosscheck_accepted:false,activation_authority_granted:false,primary_decimal:primaryDecimal,independent_decimal:independentDecimal,comparison_policy:'EXACT_NORMALIZED_PUBLISHED_DECIMAL'});
  const exact=primaryDecimal===independentDecimal;
  return freeze({
    status:exact?INDEPENDENT_CROSSCHECK_RESULT.EXACT_MATCH:INDEPENDENT_CROSSCHECK_RESULT.NUMERIC_CONFLICT,
    crosscheck_accepted:exact,
    activation_authority_granted:false,
    primary_decimal:primaryDecimal,
    independent_decimal:independentDecimal,
    comparison_policy:'EXACT_NORMALIZED_PUBLISHED_DECIMAL',
  });
}

export function buildIndependentIngredientProbabilityCrosscheckAudit({rosterKeys=[],primaryRows=[],independentRows=[],independentSource={}}={}){
  const roster=[...new Set((Array.isArray(rosterKeys)?rosterKeys:[]).map(value=>text(value).toUpperCase()).filter(Boolean))];
  const primaryMap=new Map((Array.isArray(primaryRows)?primaryRows:[]).map(row=>[text(row?.source_key).toUpperCase(),row]));
  const independentMap=new Map((Array.isArray(independentRows)?independentRows:[]).map(row=>[text(row?.source_key).toUpperCase(),row]));
  const independenceStatus=independentSource?.independence_status||INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED;
  const rows=roster.map(sourceKey=>{
    const independent=independentMap.get(sourceKey);
    // Source-level admission is authoritative. Individual rows may never self-assert
    // independence and bypass the reviewed/pinned source-admission contract.
    const mergedIndependent=independent?{...independent,independence_status:independenceStatus}:null;
    const result=compareIndependentIngredientProbability({primary:primaryMap.get(sourceKey)||null,independent:mergedIndependent});
    return freeze({source_key:sourceKey,status:result.status,crosscheck_accepted:result.crosscheck_accepted,activation_authority_granted:false,primary_decimal:result.primary_decimal??null,independent_decimal:result.independent_decimal??null});
  });
  const count=status=>rows.filter(row=>row.status===status).length;
  const accepted=rows.filter(row=>row.crosscheck_accepted).length;
  const conflicts=count(INDEPENDENT_CROSSCHECK_RESULT.NUMERIC_CONFLICT);
  const missing=count(INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENT_VALUE_MISSING)+count(INDEPENDENT_CROSSCHECK_RESULT.PRIMARY_VALUE_MISSING);
  const independenceRejected=count(INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENCE_NOT_ACCEPTED);
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-crosscheck-audit/1.0',
    contract_id:INGREDIENT_PROBABILITY_INDEPENDENT_CROSSCHECK_ID,
    contract_version:INGREDIENT_PROBABILITY_INDEPENDENT_CROSSCHECK_VERSION,
    independent_source:freeze({
      source_id:text(independentSource?.source_id)||null,
      source_version:text(independentSource?.source_version)||null,
      source_ref:text(independentSource?.source_ref)||null,
      independence_status:independenceStatus,
    }),
    comparison_policy:'EXACT_NORMALIZED_PUBLISHED_DECIMAL',
    tolerance:null,
    roster_count:roster.length,
    primary_row_count:primaryMap.size,
    independent_row_count:independentMap.size,
    exact_match_count:accepted,
    numeric_conflict_count:conflicts,
    missing_count:missing,
    independence_not_accepted_count:independenceRejected,
    crosscheck_complete:roster.length>0&&accepted===roster.length&&conflicts===0&&missing===0&&independenceRejected===0,
    activation_authority_granted:false,
    rows:freeze(rows),
    safety:freeze({
      tolerance_invented:false,
      partial_coverage_implies_complete:false,
      exact_match_implies_activation:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
