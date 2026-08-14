import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PUBLIC_SPECIES_FORM_ROSTER_ROWS,PUBLIC_SPECIES_FORM_ROSTER_VERSION} from '../assets/js/public-pokemon-species-form-roster.js';
import {evaluateIngredientProbabilityActivationRow,INGREDIENT_PROBABILITY_EVIDENCE_CLASS,INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT} from '../assets/js/ingredient-probability-activation-policy.js';

const PINNED_COMMIT=INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT;
const SOURCE_SPECS=Object.freeze({
  'common/src/types/pokemon/berry-pokemon.ts':Object.freeze({blob_sha:'c52f331fce50904e0246faa2a72346bc45b3e3e2'}),
  'common/src/types/pokemon/ingredient-pokemon.ts':Object.freeze({blob_sha:'ef3c631e11a86969db6b0febbb087612b7d4cb71'}),
  'common/src/types/pokemon/skill-pokemon.ts':Object.freeze({blob_sha:'5b718ecf8421ad0e9ed144fd928ab398c015b865'}),
  'common/src/types/pokemon/all-pokemon.ts':Object.freeze({blob_sha:'2cc625de693a0bdb7eeabd8f91e6ff6a50079dba'}),
});
const OUTPUT_ARG=process.argv.find(arg=>arg.startsWith('--output='));
const OUTPUT_PATH=OUTPUT_ARG?OUTPUT_ARG.slice('--output='.length):'artifacts/v0428_g75e3c3_probability_source_coverage.json';
if(process.env.ALLOW_PINNED_EVIDENCE_FETCH!=='1')throw new Error('PINNED_EVIDENCE_FETCH_DISABLED: set ALLOW_PINNED_EVIDENCE_FETCH=1 in evidence-acquisition CI only');

function gitBlobSha(bytes){
  const header=Buffer.from(`blob ${bytes.length}\0`,'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}
function rawUrl(path){return `https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/${PINNED_COMMIT}/${path}`;}
async function fetchPinnedSource(path,spec){
  const response=await fetch(rawUrl(path),{redirect:'follow',headers:{'user-agent':'pokemon-sleep-ai-manager-evidence-audit'}});
  if(!response.ok)throw new Error(`SOURCE_FETCH_FAILED:${path}:${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const actualBlob=gitBlobSha(bytes);
  assert.equal(actualBlob,spec.blob_sha,`PINNED_BLOB_SHA_MISMATCH:${path}`);
  return Object.freeze({path,blob_sha:actualBlob,text:bytes.toString('utf8'),byte_length:bytes.length});
}
function exportBlocks(text){
  const starts=[];
  const regex=/^export const\s+([A-Z0-9_]+):\s*Pokemon\s*=/gm;
  for(let match; (match=regex.exec(text)); )starts.push({source_key:match[1],index:match.index});
  const result=new Map();
  for(let i=0;i<starts.length;i++){
    const start=starts[i],end=i+1<starts.length?starts[i+1].index:text.length;
    result.set(start.source_key,text.slice(start.index,end));
  }
  return result;
}
function lineNumber(text,index){return text.slice(0,index).split('\n').length;}
function nearIngredientComment(block,fieldIndex){
  const before=block.slice(0,fieldIndex);
  const currentStart=before.lastIndexOf('\n')+1;
  const currentEnd=block.indexOf('\n',fieldIndex);
  const currentLine=block.slice(currentStart,currentEnd<0?block.length:currentEnd);
  const prevEnd=currentStart-1;
  const prevStart=prevEnd>0?block.lastIndexOf('\n',prevEnd-1)+1:0;
  const previousLine=block.slice(prevStart,Math.max(prevStart,prevEnd));
  const comments=[];
  const trailing=currentLine.match(/\/\/\s*(.*)$/)?.[1]?.trim();
  if(trailing)comments.push(trailing);
  const previousComment=previousLine.trim().match(/^\/\/\s*(.*)$/)?.[1]?.trim();
  if(previousComment)comments.push(previousComment);
  return comments.join(' | ');
}
function qualityMarkers(comment){
  const checks=[
    ['SUSPICIOUS',/\bsuspicious\b/i],['FAKE',/\bfake\b/i],['PLACEHOLDER',/\bplaceholder\b/i],
    ['MODEL_FIT',/\bmodel\b|\bformula\b.*\bwork/i],['GUESS',/\bguess(?:ed)?\b/i],['ESTIMATED',/\bestimat(?:e|ed|ion)\b/i],
    ['UNVERIFIED',/\bunverified\b/i],['TODO',/\bTODO\b/i],
  ];
  return checks.filter(([,pattern])=>pattern.test(comment)).map(([name])=>name);
}

const sources={};
for(const [path,spec] of Object.entries(SOURCE_SPECS))sources[path]=await fetchPinnedSource(path,spec);
const blocksByPath=Object.fromEntries(Object.entries(sources).map(([path,row])=>[path,exportBlocks(row.text)]));
const rosterKeys=new Set(PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.source_key));
assert.equal(rosterKeys.size,242,'ROSTER_KEY_COUNT_NOT_242');

const rows=[];
const missing=[];
for(const rosterRow of PUBLIC_SPECIES_FORM_ROSTER_ROWS){
  const source=sources[rosterRow.source_path];
  const block=blocksByPath[rosterRow.source_path]?.get(rosterRow.source_key)||null;
  if(!source||!block){missing.push({source_key:rosterRow.source_key,source_path:rosterRow.source_path,reason:source?'EXPORT_BLOCK_MISSING':'SOURCE_PATH_NOT_FETCHED'});continue;}
  const fieldMatch=/ingredientPercentage\s*:\s*([0-9]+(?:\.[0-9]+)?)/.exec(block);
  if(!fieldMatch){missing.push({source_key:rosterRow.source_key,source_path:rosterRow.source_path,reason:'INGREDIENT_PERCENTAGE_MISSING'});continue;}
  const percent=Number(fieldMatch[1]);
  const fieldIndex=fieldMatch.index;
  const blockStart=source.text.indexOf(block);
  const comment=nearIngredientComment(block,fieldIndex);
  const markers=qualityMarkers(comment);
  const sourceDeclaredSuspicious=markers.some(marker=>['SUSPICIOUS','FAKE','PLACEHOLDER','MODEL_FIT','GUESS','ESTIMATED'].includes(marker));
  const preliminaryEvidenceClass=sourceDeclaredSuspicious?INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.COMMUNITY_RESEARCH_DERIVED;
  const policyDecision=evaluateIngredientProbabilityActivationRow({
    source_key:rosterRow.source_key,
    base_ingredient_probability:percent/100,
    source_commit:PINNED_COMMIT,
    source_path:rosterRow.source_path,
    canonical_species_form_id:rosterRow.canonical_species_form_id,
    form_identity_ambiguous:false,
    evidence_class:preliminaryEvidenceClass,
    independent_current_crosscheck_count:0,
    unresolved_numeric_conflict:false,
  });
  rows.push(Object.freeze({
    canonical_species_form_id:rosterRow.canonical_species_form_id,
    source_key:rosterRow.source_key,
    specialty_group:rosterRow.specialty_group,
    source_commit:PINNED_COMMIT,
    source_path:rosterRow.source_path,
    source_blob_sha:source.blob_sha,
    source_line:lineNumber(source.text,blockStart+fieldIndex),
    ingredient_percentage:percent,
    base_ingredient_probability:percent/100,
    source_comment:comment||null,
    quality_markers:Object.freeze(markers),
    preliminary_evidence_class:preliminaryEvidenceClass,
    independent_current_crosscheck_count:0,
    unresolved_numeric_conflict:false,
    policy_status:policyDecision.status,
    policy_reason:policyDecision.reason,
    eligible_for_numeric_activation:policyDecision.eligible_for_numeric_activation,
  }));
}

const extractedKeys=new Set(rows.map(row=>row.source_key));
const duplicateKeys=rows.map(row=>row.source_key).filter((key,index,array)=>array.indexOf(key)!==index);
const unexpectedRows=rows.filter(row=>!rosterKeys.has(row.source_key));
const flagged=rows.filter(row=>row.quality_markers.length>0);
const excluded=rows.filter(row=>row.policy_status==='EXCLUDED_FROM_ACTIVATION');
const reviewRequired=rows.filter(row=>row.policy_status==='REVIEW_REQUIRED');
const ready=rows.filter(row=>row.policy_status==='ACTIVATION_ROW_EVIDENCE_READY');

const payload={
  schema:'pokemon-sleep-ingredient-probability-source-coverage-audit/1.0',
  generated_at:new Date().toISOString(),
  roster_version:PUBLIC_SPECIES_FORM_ROSTER_VERSION,
  roster_count:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,
  source_commit:PINNED_COMMIT,
  source_files:Object.freeze(Object.fromEntries(Object.entries(sources).map(([path,row])=>[path,{blob_sha:row.blob_sha,byte_length:row.byte_length,raw_url:rawUrl(path)}]))),
  summary:Object.freeze({
    expected_roster_count:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,
    extracted_value_count:rows.length,
    missing_value_count:missing.length,
    duplicate_source_key_count:new Set(duplicateKeys).size,
    unexpected_source_key_count:unexpectedRows.length,
    quality_flagged_row_count:flagged.length,
    excluded_from_activation_count:excluded.length,
    review_required_count:reviewRequired.length,
    activation_row_evidence_ready_count:ready.length,
    independent_crosschecked_row_count:rows.filter(row=>row.independent_current_crosscheck_count>0).length,
    source_value_coverage_ratio:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length?rows.length/PUBLIC_SPECIES_FORM_ROSTER_ROWS.length:null,
    activation_ready_coverage_ratio:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length?ready.length/PUBLIC_SPECIES_FORM_ROSTER_ROWS.length:null,
  }),
  missing:Object.freeze(missing),
  flagged_rows:Object.freeze(flagged.map(row=>({source_key:row.source_key,source_path:row.source_path,source_line:row.source_line,source_comment:row.source_comment,quality_markers:row.quality_markers,policy_status:row.policy_status,policy_reason:row.policy_reason}))),
  rows:Object.freeze(rows),
  activation_decision:'HOLD_SOURCE_VALUES_UNCROSSCHECKED',
  safety:Object.freeze({runtime_network_fetch:false,player_data_write:false,sqlite_write:false,ai_numeric_authority:false,artifact_values_activate_runtime:false}),
};

fs.mkdirSync(new URL(`../${OUTPUT_PATH.substring(0,OUTPUT_PATH.lastIndexOf('/')+1)}`,import.meta.url),{recursive:true});
fs.writeFileSync(new URL(`../${OUTPUT_PATH}`,import.meta.url),JSON.stringify(payload,null,2)+'\n','utf8');
console.log(JSON.stringify({status:missing.length||duplicateKeys.length||unexpectedRows.length?'FAIL_SOURCE_COVERAGE':'PASS_SOURCE_COVERAGE',gate:'V0428_G75E3C3_PINNED_SOURCE_EXTRACTION',output:OUTPUT_PATH,...payload.summary,flagged_rows:payload.flagged_rows},null,2));
if(missing.length||duplicateKeys.length||unexpectedRows.length)process.exitCode=1;
