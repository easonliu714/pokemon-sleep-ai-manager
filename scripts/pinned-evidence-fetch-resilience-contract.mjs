import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPinnedEvidenceFetch,pinnedGitHubContentsApiUrl,PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION} from './pinned-evidence-fetch-resilience.mjs';

const pinned='https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/fc36317b195125c63bf56d3777fa3ed1a9548831/common/src/types/pokemon/berry-pokemon.ts';
const api='https://api.github.com/repos/nerolis-lab/nerolis-lab/contents/common/src/types/pokemon/berry-pokemon.ts?ref=fc36317b195125c63bf56d3777fa3ed1a9548831';
assert.equal(pinnedGitHubContentsApiUrl(pinned),api);
assert.equal(pinnedGitHubContentsApiUrl('https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/main/common/src/types/pokemon/berry-pokemon.ts'),null,'mutable branch URL must never gain API fallback');
assert.equal(pinnedGitHubContentsApiUrl('https://example.com/file'),null);

const response=(status,{headers={},payload=null,text=''}={})=>({
  ok:status>=200&&status<300,
  status,
  headers:{get:key=>headers[String(key).toLowerCase()]??null},
  json:async()=>payload,
  text:async()=>text,
});
const apiFile=(text,sha='0123456789abcdef0123456789abcdef01234567')=>response(200,{payload:{type:'file',encoding:'base64',content:Buffer.from(text,'utf8').toString('base64'),sha}});

{
  const calls=[],sleeps=[],retries=[],fallbacks=[];
  const sequence=[response(429,{headers:{'retry-after':'0'}}),response(429),apiFile('verified source text')];
  const wrapped=createPinnedEvidenceFetch({
    fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return sequence.shift();},
    sleepFn:async ms=>{sleeps.push(ms);},
    primaryAttempts:2,apiAttempts:1,githubToken:'test-token',
    onRetry:event=>retries.push(event),onFallback:event=>fallbacks.push(event),
  });
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.equal(await out.text(),'verified source text');
  assert.deepEqual(calls.map(row=>row.url),[pinned,pinned,api]);
  assert.equal(sleeps.length,1);
  assert.equal(retries.length,1);
  assert.equal(fallbacks.length,1);
  assert.equal(fallbacks[0].reason,'HTTP_429');
  assert.equal(fallbacks[0].to,'GITHUB_CONTENTS_API');
  const apiHeaders=calls[2].init.headers;
  assert.equal(apiHeaders.get('authorization'),'Bearer test-token');
  assert.equal(apiHeaders.get('accept'),'application/vnd.github+json');
  assert.equal(apiHeaders.get('x-github-api-version'),'2022-11-28');
  assert.equal(apiHeaders.get('user-agent'),'pokemon-sleep-ai-manager-ci');
}

{
  const calls=[];
  const sequence=[response(503),response(200,{text:'raw succeeded'})];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return sequence.shift();},sleepFn:async()=>{},primaryAttempts:2});
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.deepEqual(calls.map(row=>row.url),[pinned,pinned],'primary retry success must not use API fallback');
}

{
  const calls=[];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return response(404);},sleepFn:async()=>{}});
  const out=await wrapped(pinned);
  assert.equal(out.status,404);
  assert.deepEqual(calls.map(row=>row.url),[pinned],'authoritative raw 404 must not be hidden by API fallback');
}

{
  const mutable='https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/main/common/src/types/pokemon/berry-pokemon.ts';
  const calls=[];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return response(429);},sleepFn:async()=>{}});
  const out=await wrapped(mutable);
  assert.equal(out.status,429);
  assert.deepEqual(calls.map(row=>row.url),[mutable],'mutable URL must bypass resilience wrapper');
}

{
  const calls=[];
  let n=0;
  const wrapped=createPinnedEvidenceFetch({
    fetchImpl:async(url,init)=>{calls.push({url:String(url),init});n+=1;if(n<=2)throw new Error('network down');return apiFile('api recovered');},
    sleepFn:async()=>{},primaryAttempts:2,apiAttempts:1,githubToken:'test-token',
  });
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.equal(await out.text(),'api recovered');
  assert.deepEqual(calls.map(row=>row.url),[pinned,pinned,api]);
}

{
  const calls=[];
  const sequence=[response(429),response(429),response(429),apiFile('api retry recovered')];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return sequence.shift();},sleepFn:async()=>{},primaryAttempts:2,apiAttempts:2});
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.equal(await out.text(),'api retry recovered');
  assert.deepEqual(calls.map(row=>row.url),[pinned,pinned,api,api]);
}

{
  const sequence=[response(429),response(429),response(200,{payload:{type:'dir',encoding:null,content:null}})];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async()=>sequence.shift(),sleepFn:async()=>{},primaryAttempts:2,apiAttempts:1});
  const out=await wrapped(pinned);
  assert.equal(out.status,502,'invalid Contents API payload must fail closed');
}

const ingredientExtractor=fs.readFileSync('scripts/species-ingredient-candidate-source-extract.mjs','utf8');
const identityExtractor=fs.readFileSync('scripts/species-form-zh-tw-identity-source-extract.mjs','utf8');
for(const [name,source] of [['ingredient',ingredientExtractor],['identity',identityExtractor]]){
  assert.ok(source.includes('PINNED_SOURCE_BLOB_SHA_MISMATCH'),`${name} extractor must fail closed on blob hash mismatch`);
  assert.ok(source.includes('raw.githubusercontent.com'),`${name} extractor must retain canonical pinned GitHub source URL`);
}

const workflow=fs.readFileSync('.github/workflows/regression-gate.yml','utf8');
assert.ok(workflow.includes('pinned-evidence-fetch-resilience-contract.mjs'),'Frontend gate must run the transport adversarial contract');
const preloadOccurrences=(workflow.match(/--import \.\/scripts\/pinned-evidence-fetch-resilience-preload\.mjs/g)||[]).length;
assert.equal(preloadOccurrences,2,'both pinned source extractors must use the resilient transport preload');
const tokenOccurrences=(workflow.match(/PINNED_EVIDENCE_GITHUB_TOKEN: \$\{\{ github\.token \}\}/g)||[]).length;
assert.equal(tokenOccurrences,2,'both pinned extractors must receive the read-only GitHub token for Contents API fallback');
assert.ok(workflow.includes("ALLOW_PINNED_EVIDENCE_FETCH: '1'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'PINNED_EVIDENCE_FETCH_RESILIENCE',
  version:PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION,
  immutable_commit_required_for_fallback:true,
  primary_transport:'raw.githubusercontent.com',
  fallback_transport:'api.github.com/repos/.../contents?ref=<40-char-commit>',
  authenticated_contents_read:true,
  retryable_statuses:[408,425,429,500,502,503,504],
  authoritative_404_fallback:false,
  mutable_branch_fallback:false,
  invalid_api_payload_fail_closed:true,
  ingredient_blob_sha_verification_preserved:true,
  identity_blob_sha_verification_preserved:true,
  evidence_authority_changed:false,
  token_logged:false,
},null,2));
