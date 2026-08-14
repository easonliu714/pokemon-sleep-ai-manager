import {canonicalPublishedDecimal} from './ingredient-probability-independent-crosscheck-contract.js';
import {evaluateIndependentIngredientProbabilitySourceAdmission,INDEPENDENT_SOURCE_ADMISSION_STATUS} from './ingredient-probability-independent-source-admission.js';

export const INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA='pokemon-sleep-independent-ingredient-probability-snapshot/1.0';
export const INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_ID='independent-ingredient-probability-snapshot-intake-2026-08-14-a';
export const INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_VERSION='independent-ingredient-probability-snapshot-intake-v1';

const text=value=>String(value??'').normalize('NFKC').trim();
const freeze=value=>Object.freeze(value);

export const INDEPENDENT_SNAPSHOT_INTAKE_STATUS=Object.freeze({
  ADMITTED_PARTIAL_CROSSCHECK_SNAPSHOT:'ADMITTED_PARTIAL_CROSSCHECK_SNAPSHOT',
  ADMITTED_COMPLETE_CROSSCHECK_SNAPSHOT:'ADMITTED_COMPLETE_CROSSCHECK_SNAPSHOT',
  SOURCE_ADMISSION_NOT_READY:'SOURCE_ADMISSION_NOT_READY',
  SNAPSHOT_REVIEW_REQUIRED:'SNAPSHOT_REVIEW_REQUIRED',
});

function duplicateValues(values){
  const seen=new Set(),dupes=new Set();
  for(const value of values){if(seen.has(value))dupes.add(value);else seen.add(value);}
  return [...dupes].sort();
}

export function validateIndependentIngredientProbabilitySnapshot({snapshot={},rosterKeys=[]}={}){
  const roster=[...new Set((Array.isArray(rosterKeys)?rosterKeys:[]).map(value=>text(value).toUpperCase()).filter(Boolean))];
  const rosterSet=new Set(roster);
  const admission=evaluateIndependentIngredientProbabilitySourceAdmission(snapshot?.source||{});
  if(admission.status!==INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK)return freeze({
    schema:'pokemon-sleep-independent-ingredient-probability-snapshot-intake-result/1.0',
    contract_id:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_ID,
    contract_version:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_VERSION,
    status:INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SOURCE_ADMISSION_NOT_READY,
    reason:admission.reason,
    source_admission:admission,
    roster_count:roster.length,
    row_count:Array.isArray(snapshot?.rows)?snapshot.rows.length:0,
    activation_authority_granted:false,
  });
  if(snapshot?.schema!==INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA)return freeze({
    schema:'pokemon-sleep-independent-ingredient-probability-snapshot-intake-result/1.0',contract_id:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_ID,contract_version:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_VERSION,
    status:INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED,reason:'SNAPSHOT_SCHEMA_NOT_ACCEPTED',source_admission:admission,roster_count:roster.length,row_count:Array.isArray(snapshot?.rows)?snapshot.rows.length:0,activation_authority_granted:false,
  });
  const rows=Array.isArray(snapshot?.rows)?snapshot.rows:[];
  const sourceKeys=rows.map(row=>text(row?.source_key).toUpperCase());
  const duplicateSourceKeys=duplicateValues(sourceKeys.filter(Boolean));
  const unknownSourceKeys=[...new Set(sourceKeys.filter(key=>key&&!rosterSet.has(key)))].sort();
  const problems=[];
  if(roster.length===0)problems.push('ROSTER_KEYS_MISSING');
  if(rows.length===0)problems.push('SNAPSHOT_ROWS_EMPTY');
  if(duplicateSourceKeys.length)problems.push('DUPLICATE_SOURCE_KEYS');
  if(unknownSourceKeys.length)problems.push('UNKNOWN_ROSTER_KEYS');
  const normalizedRows=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||{},sourceKey=sourceKeys[i];
    const publishedDecimal=canonicalPublishedDecimal(row.ingredient_percentage);
    const rowProblems=[];
    if(!sourceKey)rowProblems.push('SOURCE_KEY_MISSING');
    if(!text(row.source_row_ref))rowProblems.push('SOURCE_ROW_REF_MISSING');
    if(publishedDecimal===null)rowProblems.push('PUBLISHED_NUMERIC_VALUE_INVALID');
    if(text(row.unit)!=='PERCENT')rowProblems.push('UNIT_MUST_BE_PERCENT');
    if(rowProblems.length)problems.push(`${sourceKey||`ROW_${i}`}:${rowProblems.join('+')}`);
    normalizedRows.push(freeze({
      source_key:sourceKey||null,
      ingredient_percentage_published:text(row.ingredient_percentage)||null,
      ingredient_percentage_normalized:publishedDecimal,
      source_row_ref:text(row.source_row_ref)||null,
      unit:text(row.unit)||null,
    }));
  }
  const validMappedCount=normalizedRows.filter(row=>row.source_key&&rosterSet.has(row.source_key)&&row.ingredient_percentage_normalized!==null&&row.source_row_ref&&row.unit==='PERCENT').length;
  if(validMappedCount!==admission.mapped_row_count)problems.push('ADMISSION_MAPPED_ROW_COUNT_MISMATCH');
  if(admission.roster_row_count!==roster.length)problems.push('ADMISSION_ROSTER_ROW_COUNT_MISMATCH');
  const uniqueMappedCount=new Set(normalizedRows.filter(row=>row.source_key&&rosterSet.has(row.source_key)).map(row=>row.source_key)).size;
  const complete=problems.length===0&&uniqueMappedCount===roster.length&&rows.length===roster.length;
  const admitted=problems.length===0;
  return freeze({
    schema:'pokemon-sleep-independent-ingredient-probability-snapshot-intake-result/1.0',
    contract_id:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_ID,
    contract_version:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_VERSION,
    status:!admitted?INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED:complete?INDEPENDENT_SNAPSHOT_INTAKE_STATUS.ADMITTED_COMPLETE_CROSSCHECK_SNAPSHOT:INDEPENDENT_SNAPSHOT_INTAKE_STATUS.ADMITTED_PARTIAL_CROSSCHECK_SNAPSHOT,
    reason:problems.length?problems[0]:null,
    problems:freeze([...problems]),
    source_admission:admission,
    source_id:admission.source_id,
    roster_count:roster.length,
    row_count:rows.length,
    valid_mapped_row_count:validMappedCount,
    unique_mapped_row_count:uniqueMappedCount,
    duplicate_source_keys:freeze(duplicateSourceKeys),
    unknown_source_keys:freeze(unknownSourceKeys),
    coverage_ratio:roster.length?uniqueMappedCount/roster.length:null,
    complete_coverage:complete,
    normalized_rows:freeze(normalizedRows),
    activation_authority_granted:false,
    safety:freeze({
      partial_coverage_implies_complete:false,
      admitted_snapshot_implies_activation:false,
      published_precision_rewritten:false,
      unknown_roster_keys_accepted:false,
      duplicate_source_keys_accepted:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}

export function currentIndependentIngredientProbabilitySnapshotContract(){
  return freeze({
    schema:'pokemon-sleep-independent-ingredient-probability-snapshot-contract/1.0',
    contract_id:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_ID,
    contract_version:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_CONTRACT_VERSION,
    accepted_snapshot_schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,
    source_admission_required:true,
    form_safe_roster_mapping_required:true,
    source_row_ref_required:true,
    unit:'PERCENT',
    published_precision_preserved:true,
    activation_authority_granted:false,
  });
}
