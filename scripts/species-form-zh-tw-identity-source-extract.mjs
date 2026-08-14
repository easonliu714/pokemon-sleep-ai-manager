import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLIC_SPECIES_FORM_ROSTER_ROWS} from '../assets/js/public-pokemon-species-form-roster.js';
import {equivalentCandidateSetAcrossSourceKeys} from '../assets/js/public-species-ingredient-candidate-authority.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const OUT_PATH=process.env.SPECIES_ZH_TW_IDENTITY_ARTIFACT||path.join(root,'artifacts/public-species-form-zh-tw-identity-source.json');
const ALLOW_FETCH=process.env.ALLOW_PINNED_EVIDENCE_FETCH==='1';
const NEROLI_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831';
const POKEAPI_COMMIT='c0a9bc75af3a455cdfa27dde21e4ec95aedd3f25';
const NEROLI_FILES=Object.freeze({
  'common/src/types/pokemon/berry-pokemon.ts':'c52f331fce50904e0246faa2a72346bc45b3e3e2',
  'common/src/types/pokemon/ingredient-pokemon.ts':'ef3c631e11a86969db6b0febbb087612b7d4cb71',
  'common/src/types/pokemon/skill-pokemon.ts':'5b718ecf8421ad0e9ed144fd928ab398c015b865',
  'common/src/types/pokemon/all-pokemon.ts':'2cc625de693a0bdb7eeabd8f91e6ff6a50079dba',
});
const POKEAPI_FILES=Object.freeze({
  'data/v2/csv/pokemon_species_names.csv':'44954a1248493d8cc336f121ce5cce394cee9ac0',
  'data/v2/csv/languages.csv':'6d2b8684061ed2fe7c9359317b8067757a068222',
});

const OFFICIAL_SLEEP_FORM_OVERRIDES=Object.freeze([
  Object.freeze({display_name_zh_tw:'六尾（阿羅拉的樣子）',source_keys:Object.freeze(['VULPIX_ALOLAN']),source_ref:'https://www.pokemonsleep.net/zh/news/333432383533383734343936383331343930/'}),
  Object.freeze({display_name_zh_tw:'九尾（阿羅拉的樣子）',source_keys:Object.freeze(['NINETALES_ALOLAN']),source_ref:'https://www.pokemonsleep.net/zh/news/333432383533383734343936383331343930/'}),
  Object.freeze({display_name_zh_tw:'皮卡丘（萬聖節）',source_keys:Object.freeze(['PIKACHU_HALLOWEEN']),source_ref:'https://www.pokemonsleep.net/zh/news/333234393733393633373438383335333239/'}),
  Object.freeze({display_name_zh_tw:'伊布（萬聖節）',source_keys:Object.freeze(['EEVEE_HALLOWEEN']),source_ref:'https://www.pokemonsleep.net/zh/news/333234393733393633373438383335333239/'}),
  Object.freeze({display_name_zh_tw:'皮卡丘（佳節）',source_keys:Object.freeze(['PIKACHU_HOLIDAY']),source_ref:'https://www.pokemonsleep.net/zh/news/333432383533383734343936383331343930/'}),
  Object.freeze({display_name_zh_tw:'伊布（佳節）',source_keys:Object.freeze(['EEVEE_HOLIDAY']),source_ref:'https://www.pokemonsleep.net/zh/news/323039303336363938383838313735363137/'}),
  Object.freeze({display_name_zh_tw:'海豹球（佳節）',source_keys:Object.freeze(['SPHEAL_HOLIDAY']),source_ref:'https://www.pokemonsleep.net/zh/news/333432383533383734343936383331343930/'}),
  Object.freeze({display_name_zh_tw:'烏波（帕底亞的樣子）',source_keys:Object.freeze(['WOOPER_PALDEAN']),source_ref:'https://www.pokemonsleep.net/zh/news/323239343431363435333837343438333231/'}),
  Object.freeze({display_name_zh_tw:'顫弦蠑螈（高調的樣子）',source_keys:Object.freeze(['TOXTRICITY_AMPED']),source_ref:'https://www.pokemonsleep.net/zh/news/323934363035343938303437353238393631/'}),
  Object.freeze({display_name_zh_tw:'顫弦蠑螈（低調的樣子）',source_keys:Object.freeze(['TOXTRICITY_LOW_KEY']),source_ref:'https://www.pokemonsleep.net/zh/news/323934363035343938303437353238393631/'}),
]);

const gitBlobSha=text=>{const body=Buffer.from(text,'utf8'),header=Buffer.from(`blob ${body.length}\0`,'utf8');return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');};
async function fetchPinned(repo,commit,files){
  if(!ALLOW_FETCH)throw new Error('PINNED_EVIDENCE_FETCH_DISABLED');
  const out=new Map();
  for(const [file,expected] of Object.entries(files)){
    const response=await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${file}`,{headers:{'user-agent':'pokemon-sleep-ai-manager-evidence-audit'}});
    if(!response.ok)throw new Error(`PINNED_SOURCE_FETCH_FAILED:${repo}:${file}:${response.status}`);
    const text=await response.text(),actual=gitBlobSha(text);
    if(actual!==expected)throw new Error(`PINNED_SOURCE_BLOB_SHA_MISMATCH:${repo}:${file}:${expected}:${actual}`);
    out.set(file,Object.freeze({file,blob_sha:actual,text}));
  }
  return out;
}
function skipStringOrComment(source,index){const c=source[index],next=source[index+1];if(c==='/'&&next==='/'){const end=source.indexOf('\n',index+2);return end<0?source.length:end;}if(c==='/'&&next==='*'){const end=source.indexOf('*/',index+2);return end<0?source.length:end+2;}if(c==='"'||c==="'"||c==='`'){const quote=c;let i=index+1,escaped=false;for(;i<source.length;i+=1){const ch=source[i];if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)return i+1;}return source.length;}return index;}
function findExpressionEnd(source,start){let paren=0,brace=0,bracket=0;for(let i=start;i<source.length;){const jumped=skipStringOrComment(source,i);if(jumped!==i){i=jumped;continue;}const c=source[i];if(c==='(')paren+=1;else if(c===')')paren-=1;else if(c==='{')brace+=1;else if(c==='}')brace-=1;else if(c==='[')bracket+=1;else if(c===']')bracket-=1;else if(c===';'&&paren===0&&brace===0&&bracket===0)return i;i+=1;}throw new Error(`expression_end_not_found:${start}`);}
function exportExpressions(source){const map=new Map(),regex=/(?:^|\n)\s*export\s+const\s+([A-Z][A-Z0-9_]*)\b[^=]*=/g;let match;while((match=regex.exec(source))){const start=regex.lastIndex,end=findExpressionEnd(source,start);map.set(match[1],source.slice(start,end).trim());regex.lastIndex=end+1;}return map;}
function pokedexNumber(expression){const match=String(expression||'').match(/\bpokedexNumber\s*:\s*(\d+)\b/);return match?Number(match[1]):null;}
function parseCsv(text){const rows=[],row=[];let field='',quoted=false;for(let i=0;i<text.length;i+=1){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i+=1;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push([...row]);row.length=0;field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}return rows;}
const normalizeEnglishSourceKey=value=>String(value??'').normalize('NFKD').replace(/[’'`.]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
const exactCandidateEquivalent=(keys)=>[1,30,60].every(level=>equivalentCandidateSetAcrossSourceKeys(keys,level).status==='MATCHABLE_EQUIVALENT_FORM_SET');

const neroli=await fetchPinned('nerolis-lab/nerolis-lab',NEROLI_COMMIT,NEROLI_FILES);
const pokeapi=await fetchPinned('PokeAPI/pokeapi',POKEAPI_COMMIT,POKEAPI_FILES);
const declarations=new Map();
for(const source of neroli.values())for(const [key,expression] of exportExpressions(source.text)){if(declarations.has(key))throw new Error(`DUPLICATE_NEROLI_EXPORT:${key}`);declarations.set(key,{expression,source_path:source.file,blob_sha:source.blob_sha});}
const sourceRows=[];const failures=[];
for(const roster of PUBLIC_SPECIES_FORM_ROSTER_ROWS){const declaration=declarations.get(roster.source_key);if(!declaration){failures.push(`${roster.source_key}:EXPORT_MISSING`);continue;}const dex=pokedexNumber(declaration.expression);if(!Number.isInteger(dex)||dex<=0){failures.push(`${roster.source_key}:POKEDEX_NUMBER_MISSING`);continue;}sourceRows.push({...roster,pokedex_number:dex,source_blob_sha:declaration.blob_sha});}

const languages=parseCsv(pokeapi.get('data/v2/csv/languages.csv').text);const languageHeader=languages.shift();const li=Object.fromEntries(languageHeader.map((value,index)=>[value,index]));
const zhRow=languages.find(row=>row[li.identifier]==='zh-hant');const enRow=languages.find(row=>row[li.identifier]==='en');
assert.equal(zhRow?.[li.id],'4','PokeAPI zh-hant language id drift');assert.equal(enRow?.[li.id],'9','PokeAPI English language id drift');
const names=parseCsv(pokeapi.get('data/v2/csv/pokemon_species_names.csv').text);const nameHeader=names.shift();const ni=Object.fromEntries(nameHeader.map((value,index)=>[value,index]));
const byDex=new Map();for(const row of names){const lang=row[ni.local_language_id];if(lang!=='4'&&lang!=='9')continue;const dex=Number(row[ni.pokemon_species_id]);const current=byDex.get(dex)||{};if(lang==='4')current.zh_tw=row[ni.name];if(lang==='9')current.en=row[ni.name];byDex.set(dex,current);}

const sourceRowsByDex=new Map();for(const row of sourceRows){const arr=sourceRowsByDex.get(row.pokedex_number)||[];arr.push(row);sourceRowsByDex.set(row.pokedex_number,arr);}
const identities=[];const unresolved=[];
for(const [dex,rows] of [...sourceRowsByDex].sort((a,b)=>a[0]-b[0])){
  const namesForDex=byDex.get(dex);if(!namesForDex?.zh_tw||!namesForDex?.en){unresolved.push({pokedex_number:dex,source_keys:rows.map(row=>row.source_key),reason:'POKEAPI_ZH_TW_OR_EN_NAME_MISSING'});continue;}
  const expectedBase=normalizeEnglishSourceKey(namesForDex.en);
  const exactBaseRows=rows.filter(row=>row.source_key===expectedBase);
  let baseKeys,status;
  if(exactBaseRows.length===1){baseKeys=[expectedBase];status='EXACT_BASE_SOURCE_KEY';}
  else if(exactBaseRows.length===0&&exactCandidateEquivalent(rows.map(row=>row.source_key))){baseKeys=rows.map(row=>row.source_key).sort();status='NO_SINGLE_BASE_KEY_EQUIVALENT_CANDIDATE_SET';}
  else {unresolved.push({pokedex_number:dex,display_name_zh_tw:namesForDex.zh_tw,english_name:namesForDex.en,expected_base_source_key:expectedBase,source_keys:rows.map(row=>row.source_key),reason:exactBaseRows.length>1?'MULTIPLE_EXACT_BASE_KEYS':'BASE_SOURCE_KEY_NOT_FOUND_AND_VARIANTS_NOT_EQUIVALENT'});continue;}
  identities.push(Object.freeze({display_name_zh_tw:namesForDex.zh_tw,pokedex_number:dex,source_keys:Object.freeze(baseKeys),identity_status:status,source_type:'POKEAPI_PINNED_ZH_HANT_BASE_SPECIES',source_ref:`PokeAPI/pokeapi@${POKEAPI_COMMIT}:data/v2/csv/pokemon_species_names.csv`,form_override:false}));
}

const rosterKeySet=new Set(PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.source_key));
for(const override of OFFICIAL_SLEEP_FORM_OVERRIDES){const unknown=override.source_keys.filter(key=>!rosterKeySet.has(key));if(unknown.length){failures.push(`${override.display_name_zh_tw}:OFFICIAL_OVERRIDE_UNKNOWN_KEYS:${unknown.join(',')}`);continue;}identities.push(Object.freeze({...override,pokedex_number:sourceRows.find(row=>row.source_key===override.source_keys[0])?.pokedex_number??null,identity_status:'OFFICIAL_SLEEP_FORM_EXACT',source_type:'POKEMON_SLEEP_OFFICIAL_ZH_TW_FORM_NAME',form_override:true}));}
const normalizedName=value=>String(value??'').normalize('NFKC').trim();const nameIndex=new Map();for(const row of identities){const key=normalizedName(row.display_name_zh_tw);const list=nameIndex.get(key)||[];list.push(row);nameIndex.set(key,list);}const duplicateIdentityNames=[...nameIndex].filter(([,rows])=>rows.length>1).map(([name,rows])=>({name,rows}));

const artifact={schema:'pokemon-sleep-public-species-form-zh-tw-identity-source-audit/1.0',generated_at:new Date().toISOString(),neroli_commit:NEROLI_COMMIT,pokeapi_commit:POKEAPI_COMMIT,roster_row_count:242,source_key_pokedex_mapped_count:sourceRows.length,base_identity_count:identities.filter(row=>!row.form_override).length,form_override_count:identities.filter(row=>row.form_override).length,unresolved_base_groups:unresolved,extraction_failures:failures,duplicate_identity_names:duplicateIdentityNames,policy:{exact_display_name_only:true,fuzzy_auto_match:false,private_player_data_used:false,ingredient_candidate_generation:false,source_key_guess_from_ai:false,ambiguous_non_equivalent_forms_review_required:true},source_files:{neroli:Object.fromEntries([...neroli].map(([file,row])=>[file,row.blob_sha])),pokeapi:Object.fromEntries([...pokeapi].map(([file,row])=>[file,row.blob_sha]))},source_key_rows:sourceRows.map(row=>({source_key:row.source_key,pokedex_number:row.pokedex_number,canonical_species_form_id:row.canonical_species_form_id})),identities};
assert.equal(failures.length,0,`identity extraction failures:\n${failures.join('\n')}`);assert.equal(sourceRows.length,242);assert.equal(unresolved.length,0,`unresolved base identity groups:\n${JSON.stringify(unresolved,null,2)}`);assert.equal(duplicateIdentityNames.length,0,`duplicate exact display identities:\n${JSON.stringify(duplicateIdentityNames,null,2)}`);
fs.mkdirSync(path.dirname(OUT_PATH),{recursive:true});fs.writeFileSync(OUT_PATH,`${JSON.stringify(artifact,null,2)}\n`,'utf8');
console.log(JSON.stringify({status:'PASS',gate:'PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_SOURCE_AUDIT',roster_rows:242,pokedex_mapped:sourceRows.length,base_identity_count:artifact.base_identity_count,form_override_count:artifact.form_override_count,unresolved_base_groups:unresolved.length,duplicate_identity_names:duplicateIdentityNames.length,private_player_data_used:false,fuzzy_auto_match:false,artifact_path:path.relative(root,OUT_PATH)},null,2));
