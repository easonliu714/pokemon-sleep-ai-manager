import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PUBLIC_SPECIES_FORM_ROSTER_ROWS,
  PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT,
} from '../assets/js/public-pokemon-species-form-roster.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from '../assets/js/public-ingredient-identity.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const OUT_PATH=process.env.SPECIES_INGREDIENT_CANDIDATE_ARTIFACT||path.join(root,'artifacts/public-species-ingredient-candidate-source.json');
const ALLOW_FETCH=process.env.ALLOW_PINNED_EVIDENCE_FETCH==='1';
const PINNED_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831';

assert.equal(PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT,PINNED_COMMIT,'roster/source commit drift');
assert.equal(PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,242,'governed roster must remain 242 rows');

const SOURCE_FILES=Object.freeze({
  'common/src/types/pokemon/berry-pokemon.ts':Object.freeze({blob_sha:'c52f331fce50904e0246faa2a72346bc45b3e3e2'}),
  'common/src/types/pokemon/ingredient-pokemon.ts':Object.freeze({blob_sha:'ef3c631e11a86969db6b0febbb087612b7d4cb71'}),
  'common/src/types/pokemon/skill-pokemon.ts':Object.freeze({blob_sha:'5b718ecf8421ad0e9ed144fd928ab398c015b865'}),
  'common/src/types/pokemon/all-pokemon.ts':Object.freeze({blob_sha:'2cc625de693a0bdb7eeabd8f91e6ff6a50079dba'}),
});

const INGREDIENT_CONSTANT_TO_ZH_TW=Object.freeze({
  BEAN_SAUSAGE:'豆製肉',
  FANCY_APPLE:'特選蘋果',
  FANCY_EGG:'特選蛋',
  FIERY_HERB:'火辣香草',
  GLOSSY_AVOCADO:'嫩亮酪梨',
  GREENGRASS_CORN:'萌綠玉米',
  GREENGRASS_SOYBEANS:'萌綠大豆',
  HONEY:'甜甜蜜',
  LARGE_LEEK:'粗枝大蔥',
  MOOMOO_MILK:'哞哞鮮奶',
  PLUMP_PUMPKIN:'沉甸甸南瓜',
  PURE_OIL:'純粹油',
  ROUSING_COFFEE:'醒腦咖啡豆',
  SLOWPOKE_TAIL:'美味尾巴',
  SNOOZY_TOMATO:'好眠番茄',
  SOFT_POTATO:'窩心洋芋',
  SOOTHING_CACAO:'放鬆可可',
  TASTY_MUSHROOM:'品鮮蘑菇',
  WARMING_GINGER:'暖暖薑',
});

const canonicalIngredientSet=new Set(PUBLIC_INGREDIENT_CANONICAL_NAMES);
assert.deepEqual(new Set(Object.values(INGREDIENT_CONSTANT_TO_ZH_TW)),canonicalIngredientSet,'ingredient constant map must exactly equal current canonical ingredient authority');

function gitBlobSha(text){
  const body=Buffer.from(text,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

function skipStringOrComment(source,index){
  const c=source[index],next=source[index+1];
  if(c==='/'&&next==='/'){
    const end=source.indexOf('\n',index+2);
    return end<0?source.length:end;
  }
  if(c==='/'&&next==='*'){
    const end=source.indexOf('*/',index+2);
    return end<0?source.length:end+2;
  }
  if(c==='"'||c==="'"||c==='`'){
    const quote=c; let i=index+1,escaped=false,templateDepth=0;
    for(;i<source.length;i+=1){
      const ch=source[i];
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(quote==='`'&&ch==='$'&&source[i+1]==='{'){templateDepth+=1;i+=1;continue;}
      if(quote==='`'&&templateDepth>0){
        if(ch==='{')templateDepth+=1;
        else if(ch==='}')templateDepth-=1;
        continue;
      }
      if(ch===quote)return i+1;
    }
    return source.length;
  }
  return index;
}

function findExpressionEnd(source,start){
  let paren=0,brace=0,bracket=0;
  for(let i=start;i<source.length;){
    const jumped=skipStringOrComment(source,i);
    if(jumped!==i){i=jumped;continue;}
    const c=source[i];
    if(c==='(')paren+=1;else if(c===')')paren-=1;
    else if(c==='{')brace+=1;else if(c==='}')brace-=1;
    else if(c==='[')bracket+=1;else if(c===']')bracket-=1;
    else if(c===';'&&paren===0&&brace===0&&bracket===0)return i;
    i+=1;
  }
  throw new Error(`expression_end_not_found_at_${start}`);
}

function declarationsFromSource(source,sourcePath){
  const declarations=new Map();
  const regex=/(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z0-9_]+)\b/g;
  let match;
  while((match=regex.exec(source))){
    const name=match[1];
    let i=regex.lastIndex,paren=0,brace=0,bracket=0,equals=-1;
    for(;i<source.length;i+=1){
      const jumped=skipStringOrComment(source,i);
      if(jumped!==i){i=jumped-1;continue;}
      const c=source[i];
      if(c==='(')paren+=1;else if(c===')')paren-=1;
      else if(c==='{')brace+=1;else if(c==='}')brace-=1;
      else if(c==='[')bracket+=1;else if(c===']')bracket-=1;
      else if(c==='='&&paren===0&&brace===0&&bracket===0){equals=i;break;}
      else if(c===';'||c==='\n'&&i-match.index>300)break;
    }
    if(equals<0)continue;
    const end=findExpressionEnd(source,equals+1);
    declarations.set(name,Object.freeze({name,source_path:sourcePath,expression:source.slice(equals+1,end).trim()}));
    regex.lastIndex=end+1;
  }
  return declarations;
}

function findMatching(source,start,open,close){
  let depth=0;
  for(let i=start;i<source.length;){
    const jumped=skipStringOrComment(source,i);
    if(jumped!==i){i=jumped;continue;}
    if(source[i]===open)depth+=1;
    else if(source[i]===close){depth-=1;if(depth===0)return i;}
    i+=1;
  }
  return -1;
}

function findPropertyValue(objectExpression,property){
  const start=objectExpression.indexOf('{');
  if(start<0)return null;
  const end=findMatching(objectExpression,start,'{','}');
  if(end<0)return null;
  const body=objectExpression.slice(start+1,end);
  let paren=0,brace=0,bracket=0;
  for(let i=0;i<body.length;){
    const jumped=skipStringOrComment(body,i);
    if(jumped!==i){i=jumped;continue;}
    const c=body[i];
    if(c==='(')paren+=1;else if(c===')')paren-=1;
    else if(c==='{')brace+=1;else if(c==='}')brace-=1;
    else if(c==='[')bracket+=1;else if(c===']')bracket-=1;
    if(paren===0&&brace===0&&bracket===0){
      const tail=body.slice(i);
      const m=tail.match(new RegExp(`^\\s*${property}\\s*:`));
      if(m){
        const valueStart=i+m[0].length;
        let p=0,b=0,q=0;
        for(let j=valueStart;j<body.length;){
          const jumpedValue=skipStringOrComment(body,j);
          if(jumpedValue!==j){j=jumpedValue;continue;}
          const ch=body[j];
          if(ch==='(')p+=1;else if(ch===')')p-=1;
          else if(ch==='{')b+=1;else if(ch==='}')b-=1;
          else if(ch==='[')q+=1;else if(ch===']')q-=1;
          else if(ch===','&&p===0&&b===0&&q===0)return body.slice(valueStart,j).trim();
          j+=1;
        }
        return body.slice(valueStart).trim();
      }
    }
    i+=1;
  }
  return null;
}

function topLevelSpreadIdentifiers(objectExpression){
  const start=objectExpression.indexOf('{');
  if(start<0)return [];
  const end=findMatching(objectExpression,start,'{','}');
  if(end<0)return [];
  const body=objectExpression.slice(start+1,end);
  const result=[];
  let paren=0,brace=0,bracket=0;
  for(let i=0;i<body.length;){
    const jumped=skipStringOrComment(body,i);
    if(jumped!==i){i=jumped;continue;}
    const c=body[i];
    if(c==='(')paren+=1;else if(c===')')paren-=1;
    else if(c==='{')brace+=1;else if(c==='}')brace-=1;
    else if(c==='[')bracket+=1;else if(c===']')bracket-=1;
    if(paren===0&&brace===0&&bracket===0&&body.startsWith('...',i)){
      const m=body.slice(i+3).match(/^\s*([A-Za-z0-9_]+)/);
      if(m)result.push(m[1]);
    }
    i+=1;
  }
  return result;
}

function callArgs(expression,functionName){
  const match=expression.match(new RegExp(`^\\s*${functionName}\\s*\\(`));
  if(!match)return null;
  const open=expression.indexOf('(',match.index);
  const close=findMatching(expression,open,'(',')');
  if(close<0)return null;
  const body=expression.slice(open+1,close);
  const args=[];let start=0,paren=0,brace=0,bracket=0;
  for(let i=0;i<body.length;){
    const jumped=skipStringOrComment(body,i);
    if(jumped!==i){i=jumped;continue;}
    const c=body[i];
    if(c==='(')paren+=1;else if(c===')')paren-=1;
    else if(c==='{')brace+=1;else if(c==='}')brace-=1;
    else if(c==='[')bracket+=1;else if(c===']')bracket-=1;
    else if(c===','&&paren===0&&brace===0&&bracket===0){args.push(body.slice(start,i).trim());start=i+1;}
    i+=1;
  }
  args.push(body.slice(start).trim());
  return args;
}

function uniq(values){return [...new Set(values)];}
function constantsInIngredientSetArray(value){
  return uniq([...String(value||'').matchAll(/\bingredient\s*:\s*([A-Z][A-Z0-9_]*)\b/g)].map(match=>match[1]).filter(value=>value!=='LOCKED_INGREDIENT'));
}
function constantProperty(value,key){
  const property=findPropertyValue(value,key);
  if(!property)return null;
  const match=property.match(/^([A-Z][A-Z0-9_]*)$/);
  return match?.[1]||null;
}

function candidateDefinitionFromIngredientValue(value){
  const trimmed=String(value||'').trim();
  if(!trimmed)return null;
  if(trimmed.startsWith('{')){
    const set0=findPropertyValue(trimmed,'ingredient0');
    const set30=findPropertyValue(trimmed,'ingredient30');
    const set60=findPropertyValue(trimmed,'ingredient60');
    if(set0||set30||set60){
      if(!set0||!set30||!set60)return {error:'PARTIAL_INGREDIENT_SET_DEFINITION'};
      const level1=constantsInIngredientSetArray(set0);
      const level30=constantsInIngredientSetArray(set30);
      const level60=constantsInIngredientSetArray(set60);
      if(!level1.length||!level30.length)return {error:'EMPTY_REQUIRED_INGREDIENT_SET'};
      return {mode:'DIRECT_SET',level1,level30,level60};
    }
    const a=constantProperty(trimmed,'a');
    const b=constantProperty(trimmed,'b');
    const c=constantProperty(trimmed,'c');
    if(!a||!b)return {error:'STANDARD_INGREDIENT_DEFINITION_MISSING_A_OR_B'};
    return {mode:'DIRECT_ABC',level1:[a],level30:uniq([a,b]),level60:uniq([a,b,...(c?[c]:[])])};
  }
  const identifier=trimmed.match(/^([A-Za-z0-9_]+)$/)?.[1]||null;
  return identifier?{reference:identifier}:{error:`UNSUPPORTED_INGREDIENT_VALUE:${trimmed.slice(0,80)}`};
}

async function fetchPinnedSources(){
  if(!ALLOW_FETCH)throw new Error('PINNED_EVIDENCE_FETCH_DISABLED: set ALLOW_PINNED_EVIDENCE_FETCH=1 only in governed CI/source-audit execution');
  const result=new Map();
  for(const [sourcePath,metadata] of Object.entries(SOURCE_FILES)){
    const url=`https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/${PINNED_COMMIT}/${sourcePath}`;
    const response=await fetch(url,{headers:{'user-agent':'pokemon-sleep-ai-manager-evidence-audit'}});
    if(!response.ok)throw new Error(`PINNED_SOURCE_FETCH_FAILED:${sourcePath}:${response.status}`);
    const text=await response.text();
    const actual=gitBlobSha(text);
    if(actual!==metadata.blob_sha)throw new Error(`PINNED_SOURCE_BLOB_SHA_MISMATCH:${sourcePath}:${metadata.blob_sha}:${actual}`);
    result.set(sourcePath,Object.freeze({source_path:sourcePath,blob_sha:actual,text,declarations:declarationsFromSource(text,sourcePath)}));
  }
  return result;
}

function buildGlobalDeclarationIndex(sources){
  const index=new Map();
  for(const source of sources.values())for(const [name,row] of source.declarations){
    if(index.has(name))throw new Error(`DUPLICATE_DECLARATION_ACROSS_PINNED_SOURCES:${name}`);
    index.set(name,row);
  }
  return index;
}

function resolveCandidateDeclaration(name,index,stack=[]){
  if(stack.includes(name))return {error:`DECLARATION_CYCLE:${[...stack,name].join('>')}`};
  const declaration=index.get(name);
  if(!declaration)return {error:`DECLARATION_NOT_FOUND:${name}`};
  const expression=declaration.expression;
  const nextStack=[...stack,name];

  for(const constructor of ['createBerrySpecialist','createIngredientSpecialist','createSkillSpecialist','createAllSpecialist']){
    const args=callArgs(expression,constructor);
    if(!args)continue;
    const object=args[0]||'';
    const ingredientValue=findPropertyValue(object,'ingredients');
    if(ingredientValue){
      const parsed=candidateDefinitionFromIngredientValue(ingredientValue);
      if(parsed?.reference){
        const inherited=resolveCandidateDeclaration(parsed.reference,index,nextStack);
        return {...inherited,provenance_mode:'SHARED_INGREDIENT_REFERENCE',definition_source_key:parsed.reference};
      }
      return {...parsed,provenance_mode:parsed?.mode||'DIRECT',definition_source_key:name,definition_source_path:declaration.source_path};
    }
    const spreads=topLevelSpreadIdentifiers(object);
    for(const spread of [...spreads].reverse()){
      const resolved=resolveCandidateDeclaration(spread,index,nextStack);
      if(!resolved.error)return {...resolved,provenance_mode:'SHARED_OBJECT_SPREAD',definition_source_key:spread};
    }
    return {error:`INGREDIENTS_NOT_FOUND_IN_CONSTRUCTOR:${name}`};
  }

  for(const constructor of ['evolvedPokemon','preEvolvedPokemon']){
    const args=callArgs(expression,constructor);
    if(!args)continue;
    const relationTarget=args[0]?.match(/^([A-Za-z0-9_]+)$/)?.[1];
    const override=args[1]||'';
    const ingredientValue=findPropertyValue(override,'ingredients');
    if(ingredientValue){
      const parsed=candidateDefinitionFromIngredientValue(ingredientValue);
      if(parsed?.reference){
        const resolved=resolveCandidateDeclaration(parsed.reference,index,nextStack);
        return {...resolved,provenance_mode:'EVOLUTION_OVERRIDE_REFERENCE',definition_source_key:parsed.reference};
      }
      return {...parsed,provenance_mode:'EVOLUTION_OVERRIDE',definition_source_key:name,definition_source_path:declaration.source_path};
    }
    if(!relationTarget)return {error:`EVOLUTION_RELATION_TARGET_UNRESOLVED:${name}`};
    const inherited=resolveCandidateDeclaration(relationTarget,index,nextStack);
    return {...inherited,provenance_mode:constructor==='evolvedPokemon'?'INHERITED_FROM_PREVIOUS_FORM':'INHERITED_FROM_NEXT_FORM',inherited_from_source_key:relationTarget};
  }

  if(expression.trim().startsWith('{')){
    const ingredientValue=findPropertyValue(expression,'ingredients');
    if(ingredientValue){
      const parsed=candidateDefinitionFromIngredientValue(ingredientValue);
      return {...parsed,provenance_mode:'SHARED_OBJECT',definition_source_key:name,definition_source_path:declaration.source_path};
    }
    const direct=candidateDefinitionFromIngredientValue(expression);
    if(direct&&!direct.error)return {...direct,provenance_mode:'SHARED_INGREDIENT_OBJECT',definition_source_key:name,definition_source_path:declaration.source_path};
    for(const spread of [...topLevelSpreadIdentifiers(expression)].reverse()){
      const resolved=resolveCandidateDeclaration(spread,index,nextStack);
      if(!resolved.error)return {...resolved,provenance_mode:'SHARED_OBJECT_SPREAD',definition_source_key:spread};
    }
  }
  return {error:`UNSUPPORTED_DECLARATION_SHAPE:${name}:${expression.slice(0,100)}`};
}

function mapConstants(constants,sourceKey,slot){
  return constants.map(constant=>{
    const canonical=INGREDIENT_CONSTANT_TO_ZH_TW[constant];
    if(!canonical)throw new Error(`UNKNOWN_INGREDIENT_CONSTANT:${sourceKey}:${slot}:${constant}`);
    if(!canonicalIngredientSet.has(canonical))throw new Error(`INGREDIENT_NOT_CURRENT_CANONICAL:${sourceKey}:${slot}:${constant}:${canonical}`);
    return Object.freeze({source_constant:constant,canonical_name_zh_tw:canonical});
  });
}

const sources=await fetchPinnedSources();
const declarationIndex=buildGlobalDeclarationIndex(sources);
const outputRows=[];
const failures=[];
for(const rosterRow of PUBLIC_SPECIES_FORM_ROSTER_ROWS){
  const source= sources.get(rosterRow.source_path);
  if(!source){failures.push(`${rosterRow.source_key}:ROSTER_SOURCE_PATH_NOT_PINNED:${rosterRow.source_path}`);continue;}
  if(!source.declarations.has(rosterRow.source_key)){failures.push(`${rosterRow.source_key}:SOURCE_KEY_DECLARATION_MISSING`);continue;}
  const resolved=resolveCandidateDeclaration(rosterRow.source_key,declarationIndex);
  if(resolved.error){failures.push(`${rosterRow.source_key}:${resolved.error}`);continue;}
  const level1=mapConstants(resolved.level1||[],rosterRow.source_key,'level_1');
  const level30=mapConstants(resolved.level30||[],rosterRow.source_key,'level_30');
  const level60=mapConstants(resolved.level60||[],rosterRow.source_key,'level_60');
  if(!level1.length||!level30.length){failures.push(`${rosterRow.source_key}:REQUIRED_SLOT_CANDIDATES_EMPTY`);continue;}
  outputRows.push(Object.freeze({
    canonical_species_form_id:rosterRow.canonical_species_form_id,
    source_key:rosterRow.source_key,
    specialty_group:rosterRow.specialty_group,
    source_commit:PINNED_COMMIT,
    source_path:rosterRow.source_path,
    source_blob_sha:source.blob_sha,
    provenance_mode:resolved.provenance_mode,
    definition_source_key:resolved.definition_source_key||rosterRow.source_key,
    inherited_from_source_key:resolved.inherited_from_source_key||null,
    candidates:Object.freeze({
      level_1:Object.freeze(level1),
      level_30:Object.freeze(level30),
      level_60:Object.freeze(level60),
      species_wide:Object.freeze(uniq([...level1,...level30,...level60].map(row=>row.canonical_name_zh_tw))),
    }),
    rate_authority:false,
    quantity_authority:false,
    player_observation:false,
    catch_assignment_probability:false,
    production_slot_distribution:false,
  }));
}

const sourceKeys=outputRows.map(row=>row.source_key);
const duplicates=sourceKeys.filter((value,index)=>sourceKeys.indexOf(value)!==index);
const unexpected=sourceKeys.filter(value=>!PUBLIC_SPECIES_FORM_ROSTER_ROWS.some(row=>row.source_key===value));
const missing=PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>row.source_key).filter(value=>!sourceKeys.includes(value));
const provenanceCounts=outputRows.reduce((out,row)=>{out[row.provenance_mode]=(out[row.provenance_mode]||0)+1;return out;},{});
const specialSetRows=outputRows.filter(row=>row.provenance_mode==='DIRECT_SET'||row.provenance_mode==='EVOLUTION_OVERRIDE'&&row.source_key==='MEW').map(row=>row.source_key);

const artifact={
  schema:'pokemon-sleep-public-species-ingredient-candidate-source-audit/1.0',
  generated_at:new Date().toISOString(),
  source_commit:PINNED_COMMIT,
  roster_row_count:PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,
  mapped_row_count:outputRows.length,
  missing_source_keys:missing,
  duplicate_source_keys:uniq(duplicates),
  unexpected_source_keys:uniq(unexpected),
  extraction_failures:failures,
  provenance_counts:provenanceCounts,
  direct_set_source_keys:specialSetRows,
  semantic_policy:Object.freeze({
    candidate_lifecycle:'IDENTITY_GENERATION_TIME',
    level_1_candidates:'SOURCE_INGREDIENT0',
    level_30_candidates:'SOURCE_INGREDIENT30',
    level_60_candidates:'SOURCE_INGREDIENT60_EXCLUDING_LOCKED_SENTINEL',
    player_slot_identity_generated:false,
    production_slot_distribution_authority:false,
    ingredient_probability_authority:false,
    ingredient_quantity_authority:false,
    specialty_inference:false,
    private_player_data_used:false,
  }),
  source_files:Object.fromEntries(Object.entries(SOURCE_FILES).map(([sourcePath,row])=>[sourcePath,{expected_blob_sha:row.blob_sha,actual_blob_sha:sources.get(sourcePath)?.blob_sha||null}])),
  rows:outputRows,
};

assert.equal(failures.length,0,`candidate extraction failures:\n${failures.join('\n')}`);
assert.equal(outputRows.length,242,`candidate mapped row count: ${outputRows.length}`);
assert.deepEqual(missing,[],'candidate source key coverage missing');
assert.deepEqual(uniq(duplicates),[],'candidate source key duplicates');
assert.deepEqual(uniq(unexpected),[],'candidate source key unexpected');
assert.ok(outputRows.every(row=>row.rate_authority===false&&row.quantity_authority===false&&row.player_observation===false));
assert.ok(outputRows.every(row=>row.candidates.level_1.length>0&&row.candidates.level_30.length>0));
assert.equal(JSON.stringify(artifact).includes('ingredientPercentage'),false,'hidden ingredient probability must never enter structural candidate artifact');

fs.mkdirSync(path.dirname(OUT_PATH),{recursive:true});
fs.writeFileSync(OUT_PATH,`${JSON.stringify(artifact,null,2)}\n`,'utf8');
console.log(JSON.stringify({
  status:'PASS',
  gate:'PUBLIC_SPECIES_INGREDIENT_CANDIDATE_SOURCE_EXTRACT',
  source_commit:PINNED_COMMIT,
  roster_row_count:242,
  mapped_row_count:outputRows.length,
  missing_count:missing.length,
  duplicate_count:uniq(duplicates).length,
  failure_count:failures.length,
  provenance_counts:provenanceCounts,
  direct_set_source_keys:specialSetRows,
  artifact_path:path.relative(root,OUT_PATH),
  probability_authority:false,
  production_slot_distribution_authority:false,
  player_slot_identity_generated:false,
},null,2));
