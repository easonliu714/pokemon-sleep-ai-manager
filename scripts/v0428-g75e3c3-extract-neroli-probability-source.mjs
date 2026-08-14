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

function findExpressionEnd(text,start){
  let paren=0,brace=0,bracket=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i],next=text[i+1]||'';
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='(')paren++;
    else if(ch===')')paren--;
    else if(ch==='{')brace++;
    else if(ch==='}')brace--;
    else if(ch==='[')bracket++;
    else if(ch===']')bracket--;
    else if(ch===';'&&paren===0&&brace===0&&bracket===0)return i;
    if(paren<0||brace<0||bracket<0)throw new Error(`SOURCE_EXPRESSION_UNBALANCED_AT:${i}`);
  }
  throw new Error(`SOURCE_EXPRESSION_TERMINATOR_MISSING:${start}`);
}
function indexDeclarations(text,regex){
  const result=new Map();
  for(let match; (match=regex.exec(text)); ){
    const name=match[1],exprStart=regex.lastIndex,exprEnd=findExpressionEnd(text,exprStart);
    result.set(name,Object.freeze({name,index:match.index,expr_start:exprStart,expr_end:exprEnd,expression:text.slice(exprStart,exprEnd)}));
    regex.lastIndex=exprEnd+1;
  }
  return result;
}
function exportBlocks(text){
  return indexDeclarations(text,/^export const\s+([A-Z0-9_]+):\s*Pokemon\s*=\s*/gm);
}
function sharedConstants(text){
  return indexDeclarations(text,/^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/gm);
}
function lineNumber(text,index){return text.slice(0,index).split('\n').length;}
function nearIngredientComment(expression,fieldIndex){
  const before=expression.slice(0,fieldIndex);
  const currentStart=before.lastIndexOf('\n')+1;
  const currentEnd=expression.indexOf('\n',fieldIndex);
  const currentLine=expression.slice(currentStart,currentEnd<0?expression.length:currentEnd);
  const prevEnd=currentStart-1;
  const prevStart=prevEnd>0?expression.lastIndexOf('\n',prevEnd-1)+1:0;
  const previousLine=expression.slice(prevStart,Math.max(prevStart,prevEnd));
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
function ingredientPercentageField(expression){
  const match=/ingredientPercentage\s*:\s*([0-9]+(?:\.[0-9]+)?)/.exec(expression);
  return match?Object.freeze({percent:Number(match[1]),index:match.index}):null;
}
function spreadNames(expression){
  const names=[];
  const regex=/\.\.\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for(let match;(match=regex.exec(expression));)names.push(match[1]);
  return names;
}
function constructorParent(expression){
  return /\b(?:evolvedPokemon|preEvolvedPokemon)\(\s*([A-Z0-9_]+)\s*,/.exec(expression)?.[1]||null;
}

const sources={};
for(const [path,spec] of Object.entries(SOURCE_SPECS))sources[path]=await fetchPinnedSource(path,spec);
const blocksByPath=Object.fromEntries(Object.entries(sources).map(([path,row])=>[path,exportBlocks(row.text)]));
const sharedByPath=Object.fromEntries(Object.entries(sources).map(([path,row])=>[path,sharedConstants(row.text)]));
const blockIndex=new Map();
for(const [path,blocks] of Object.entries(blocksByPath)){
  for(const [sourceKey,entry] of blocks){
    if(blockIndex.has(sourceKey))throw new Error(`DUPLICATE_SOURCE_EXPORT_KEY:${sourceKey}`);
    blockIndex.set(sourceKey,Object.freeze({path,...entry}));
  }
}
const rosterKeys=new Set(PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.source_key));
assert.equal(rosterKeys.size,242,'ROSTER_KEY_COUNT_NOT_242');

const resolutionCache=new Map();
function resolveSharedIngredientPercentage(path,name){
  const entry=sharedByPath[path]?.get(name)||null;
  if(!entry)return null;
  const field=ingredientPercentageField(entry.expression);
  if(!field)return null;
  const source=sources[path];
  const comment=nearIngredientComment(entry.expression,field.index);
  return Object.freeze({
    percent:field.percent,
    shared_object_name:name,
    source_path:path,
    source_blob_sha:source.blob_sha,
    source_line:lineNumber(source.text,entry.expr_start+field.index),
    source_comment:comment||null,
    quality_markers:Object.freeze(qualityMarkers(comment)),
  });
}
function resolveSourceIngredientPercentage(sourceKey,stack=[]){
  if(resolutionCache.has(sourceKey))return resolutionCache.get(sourceKey);
  if(stack.includes(sourceKey))return Object.freeze({ok:false,reason:'INHERITANCE_CYCLE',lineage:Object.freeze([...stack,sourceKey])});
  const entry=blockIndex.get(sourceKey);
  if(!entry)return Object.freeze({ok:false,reason:'EXPORT_BLOCK_MISSING',lineage:Object.freeze([...stack,sourceKey])});
  const source=sources[entry.path];
  const explicit=ingredientPercentageField(entry.expression);
  const parentKey=constructorParent(entry.expression);
  if(explicit){
    const comment=nearIngredientComment(entry.expression,explicit.index);
    const result=Object.freeze({
      ok:true,percent:explicit.percent,value_origin:'EXPLICIT',immediate_parent_source_key:parentKey,
      value_origin_source_key:sourceKey,value_origin_shared_object_name:null,value_origin_source_path:entry.path,value_origin_source_blob_sha:source.blob_sha,
      value_source_line:lineNumber(source.text,entry.expr_start+explicit.index),declaration_source_path:entry.path,declaration_line:lineNumber(source.text,entry.index),
      source_comment:comment||null,quality_markers:Object.freeze(qualityMarkers(comment)),inheritance_lineage:Object.freeze([sourceKey]),
    });
    resolutionCache.set(sourceKey,result);return result;
  }

  const sharedCandidates=spreadNames(entry.expression).map(name=>resolveSharedIngredientPercentage(entry.path,name)).filter(Boolean);
  if(sharedCandidates.length){
    const shared=sharedCandidates.at(-1);
    const result=Object.freeze({
      ok:true,percent:shared.percent,value_origin:'SHARED_OBJECT_SPREAD',immediate_parent_source_key:parentKey,
      value_origin_source_key:null,value_origin_shared_object_name:shared.shared_object_name,value_origin_source_path:shared.source_path,value_origin_source_blob_sha:shared.source_blob_sha,
      value_source_line:shared.source_line,declaration_source_path:entry.path,declaration_line:lineNumber(source.text,entry.index),source_comment:shared.source_comment,
      quality_markers:shared.quality_markers,inheritance_lineage:Object.freeze([sourceKey]),
    });
    resolutionCache.set(sourceKey,result);return result;
  }

  if(!parentKey){
    const result=Object.freeze({ok:false,reason:'INGREDIENT_PERCENTAGE_MISSING_NO_EXPLICIT_SHARED_OR_PARENT_LINEAGE',lineage:Object.freeze([...stack,sourceKey])});
    resolutionCache.set(sourceKey,result);return result;
  }
  const parent=resolveSourceIngredientPercentage(parentKey,[...stack,sourceKey]);
  if(!parent.ok){
    const result=Object.freeze({ok:false,reason:`PARENT_${parent.reason}`,parent_source_key:parentKey,lineage:Object.freeze([sourceKey,...(parent.lineage||[])])});
    resolutionCache.set(sourceKey,result);return result;
  }
  const result=Object.freeze({
    ok:true,percent:parent.percent,value_origin:'INHERITED',immediate_parent_source_key:parentKey,
    value_origin_source_key:parent.value_origin_source_key,value_origin_shared_object_name:parent.value_origin_shared_object_name,
    value_origin_source_path:parent.value_origin_source_path,value_origin_source_blob_sha:parent.value_origin_source_blob_sha,value_source_line:parent.value_source_line,
    declaration_source_path:entry.path,declaration_line:lineNumber(source.text,entry.index),source_comment:parent.source_comment,quality_markers:parent.quality_markers,
    inheritance_lineage:Object.freeze([sourceKey,...parent.inheritance_lineage]),
  });
  resolutionCache.set(sourceKey,result);return result;
}

const rows=[];
const missing=[];
for(const rosterRow of PUBLIC_SPECIES_FORM_ROSTER_ROWS){
  const declaration=blockIndex.get(rosterRow.source_key)||null;
  if(!declaration){missing.push({source_key:rosterRow.source_key,source_path:rosterRow.source_path,reason:'EXPORT_BLOCK_MISSING'});continue;}
  if(declaration.path!==rosterRow.source_path){missing.push({source_key:rosterRow.source_key,source_path:rosterRow.source_path,actual_source_path:declaration.path,reason:'ROSTER_SOURCE_PATH_MISMATCH'});continue;}
  const resolved=resolveSourceIngredientPercentage(rosterRow.source_key);
  if(!resolved.ok){missing.push({source_key:rosterRow.source_key,source_path:rosterRow.source_path,reason:resolved.reason,parent_source_key:resolved.parent_source_key||null,lineage:resolved.lineage||[]});continue;}
  const percent=resolved.percent;
  const markers=[...resolved.quality_markers];
  const sourceDeclaredSuspicious=markers.some(marker=>['SUSPICIOUS','FAKE','PLACEHOLDER','MODEL_FIT','GUESS','ESTIMATED'].includes(marker));
  const preliminaryEvidenceClass=sourceDeclaredSuspicious?INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.COMMUNITY_RESEARCH_DERIVED;
  const policyDecision=evaluateIngredientProbabilityActivationRow({
    source_key:rosterRow.source_key,base_ingredient_probability:percent/100,source_commit:PINNED_COMMIT,source_path:rosterRow.source_path,
    canonical_species_form_id:rosterRow.canonical_species_form_id,form_identity_ambiguous:false,evidence_class:preliminaryEvidenceClass,
    independent_current_crosscheck_count:0,unresolved_numeric_conflict:false,
  });
  rows.push(Object.freeze({
    canonical_species_form_id:rosterRow.canonical_species_form_id,source_key:rosterRow.source_key,specialty_group:rosterRow.specialty_group,
    source_commit:PINNED_COMMIT,source_path:rosterRow.source_path,source_blob_sha:sources[rosterRow.source_path].blob_sha,declaration_line:resolved.declaration_line,
    value_origin:resolved.value_origin,immediate_parent_source_key:resolved.immediate_parent_source_key,value_origin_source_key:resolved.value_origin_source_key,
    value_origin_shared_object_name:resolved.value_origin_shared_object_name,value_origin_source_path:resolved.value_origin_source_path,
    value_origin_source_blob_sha:resolved.value_origin_source_blob_sha,source_line:resolved.value_source_line,inheritance_lineage:resolved.inheritance_lineage,
    ingredient_percentage:percent,base_ingredient_probability:percent/100,source_comment:resolved.source_comment,quality_markers:Object.freeze(markers),
    preliminary_evidence_class:preliminaryEvidenceClass,independent_current_crosscheck_count:0,unresolved_numeric_conflict:false,
    policy_status:policyDecision.status,policy_reason:policyDecision.reason,eligible_for_numeric_activation:policyDecision.eligible_for_numeric_activation,
  }));
}

const duplicateKeys=rows.map(row=>row.source_key).filter((key,index,array)=>array.indexOf(key)!==index);
const unexpectedRows=rows.filter(row=>!rosterKeys.has(row.source_key));
const flagged=rows.filter(row=>row.quality_markers.length>0);
const inherited=rows.filter(row=>row.value_origin==='INHERITED');
const sharedSpread=rows.filter(row=>row.value_origin==='SHARED_OBJECT_SPREAD');
const excluded=rows.filter(row=>row.policy_status==='EXCLUDED_FROM_ACTIVATION');
const reviewRequired=rows.filter(row=>row.policy_status==='REVIEW_REQUIRED');
const ready=rows.filter(row=>row.policy_status==='ACTIVATION_ROW_EVIDENCE_READY');

const payload={
  schema:'pokemon-sleep-ingredient-probability-source-coverage-audit/1.2',generated_at:new Date().toISOString(),roster_version:PUBLIC_SPECIES_FORM_ROSTER_VERSION,
  roster_count:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,source_commit:PINNED_COMMIT,
  source_files:Object.freeze(Object.fromEntries(Object.entries(sources).map(([path,row])=>[path,{blob_sha:row.blob_sha,byte_length:row.byte_length,raw_url:rawUrl(path)}]))),
  summary:Object.freeze({
    expected_roster_count:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,extracted_value_count:rows.length,
    explicit_value_count:rows.filter(row=>row.value_origin==='EXPLICIT').length,inherited_value_count:inherited.length,shared_spread_value_count:sharedSpread.length,
    missing_value_count:missing.length,duplicate_source_key_count:new Set(duplicateKeys).size,unexpected_source_key_count:unexpectedRows.length,
    quality_flagged_row_count:flagged.length,excluded_from_activation_count:excluded.length,review_required_count:reviewRequired.length,
    activation_row_evidence_ready_count:ready.length,independent_crosschecked_row_count:rows.filter(row=>row.independent_current_crosscheck_count>0).length,
    source_value_coverage_ratio:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length?rows.length/PUBLIC_SPECIES_FORM_ROSTER_ROWS.length:null,
    activation_ready_coverage_ratio:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length?ready.length/PUBLIC_SPECIES_FORM_ROSTER_ROWS.length:null,
  }),
  missing:Object.freeze(missing),
  inherited_rows:Object.freeze(inherited.map(row=>({source_key:row.source_key,immediate_parent_source_key:row.immediate_parent_source_key,value_origin_source_key:row.value_origin_source_key,value_origin_shared_object_name:row.value_origin_shared_object_name,inheritance_lineage:row.inheritance_lineage,ingredient_percentage:row.ingredient_percentage}))),
  shared_spread_rows:Object.freeze(sharedSpread.map(row=>({source_key:row.source_key,value_origin_shared_object_name:row.value_origin_shared_object_name,value_origin_source_path:row.value_origin_source_path,source_line:row.source_line,ingredient_percentage:row.ingredient_percentage}))),
  flagged_rows:Object.freeze(flagged.map(row=>({source_key:row.source_key,source_path:row.source_path,source_line:row.source_line,source_comment:row.source_comment,quality_markers:row.quality_markers,policy_status:row.policy_status,policy_reason:row.policy_reason}))),
  rows:Object.freeze(rows),activation_decision:'HOLD_SOURCE_VALUES_UNCROSSCHECKED',
  safety:Object.freeze({runtime_network_fetch:false,player_data_write:false,sqlite_write:false,ai_numeric_authority:false,artifact_values_activate_runtime:false,inherited_values_require_explicit_source_lineage:true,shared_spread_values_require_explicit_source_lineage:true,cross_export_field_bleed_allowed:false}),
};

fs.mkdirSync(new URL(`../${OUTPUT_PATH.substring(0,OUTPUT_PATH.lastIndexOf('/')+1)}`,import.meta.url),{recursive:true});
fs.writeFileSync(new URL(`../${OUTPUT_PATH}`,import.meta.url),JSON.stringify(payload,null,2)+'\n','utf8');
console.log(JSON.stringify({status:missing.length||duplicateKeys.length||unexpectedRows.length?'FAIL_SOURCE_COVERAGE':'PASS_SOURCE_COVERAGE',gate:'V0428_G75E3C3_PINNED_SOURCE_EXTRACTION',output:OUTPUT_PATH,...payload.summary,missing:payload.missing,inherited_rows:payload.inherited_rows,shared_spread_rows:payload.shared_spread_rows,flagged_rows:payload.flagged_rows},null,2));
if(missing.length||duplicateKeys.length||unexpectedRows.length)process.exitCode=1;
