import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPinnedEvidenceFetch,pinnedMirrorUrl,PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION} from './pinned-evidence-fetch-resilience.mjs';

const pinned='https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/fc36317b195125c63bf56d3777fa3ed1a9548831/common/src/types/pokemon/berry-pokemon.ts';
const mirror='https://cdn.jsdelivr.net/gh/nerolis-lab/nerolis-lab@fc36317b195125c63bf56d3777fa3ed1a9548831/common/src/types/pokemon/berry-pokemon.ts';
assert.equal(pinnedMirrorUrl(pinned),mirror);
assert.equal(pinnedMirrorUrl('https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/main/common/src/types/pokemon/berry-pokemon.ts'),null,'mutable branch URL must never gain mirror fallback');
assert.equal(pinnedMirrorUrl('https://example.com/file'),null);

const response=(status,headers={})=>({ok:status>=200&&status<300,status,headers:{get:key=>headers[String(key).toLowerCase()]??null}});

{
  const calls=[],sleeps=[],retries=[],fallbacks=[];
  const sequence=[response(429,{'retry-after':'0'}),response(429),response(200)];
  const wrapped=createPinnedEvidenceFetch({
    fetchImpl:async url=>{calls.push(String(url));return sequence.shift();},
    sleepFn:async ms=>{sleeps.push(ms);},
    primaryAttempts:2,mirrorAttempts:2,
    onRetry:event=>retries.push(event),onFallback:event=>fallbacks.push(event),
  });
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.deepEqual(calls,[pinned,pinned,mirror]);
  assert.equal(sleeps.length,1);
  assert.equal(retries.length,1);
  assert.equal(fallbacks.length,1);
  assert.equal(fallbacks[0].reason,'HTTP_429');
}

{
  const calls=[];
  const sequence=[response(503),response(200)];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async url=>{calls.push(String(url));return sequence.shift();},sleepFn:async()=>{},primaryAttempts:2});
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.deepEqual(calls,[pinned,pinned],'primary retry success must not use mirror');
}

{
  const calls=[];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async url=>{calls.push(String(url));return response(404);},sleepFn:async()=>{}});
  const out=await wrapped(pinned);
  assert.equal(out.status,404);
  assert.deepEqual(calls,[pinned],'authoritative 404 must not be hidden by mirror fallback');
}

{
  const mutable='https://raw.githubusercontent.com/nerolis-lab/nerolis-lab/main/common/src/types/pokemon/berry-pokemon.ts';
  const calls=[];
  const wrapped=createPinnedEvidenceFetch({fetchImpl:async url=>{calls.push(String(url));return response(429);},sleepFn:async()=>{}});
  const out=await wrapped(mutable);
  assert.equal(out.status,429);
  assert.deepEqual(calls,[mutable],'mutable URL must bypass resilience wrapper');
}

{
  const calls=[];
  let n=0;
  const wrapped=createPinnedEvidenceFetch({
    fetchImpl:async url=>{calls.push(String(url));n+=1;if(n<=2)throw new Error('network down');return response(200);},
    sleepFn:async()=>{},primaryAttempts:2,mirrorAttempts:1,
  });
  const out=await wrapped(pinned);
  assert.equal(out.status,200);
  assert.deepEqual(calls,[pinned,pinned,mirror]);
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
assert.ok(workflow.includes("ALLOW_PINNED_EVIDENCE_FETCH: '1'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'PINNED_EVIDENCE_FETCH_RESILIENCE',
  version:PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION,
  immutable_commit_required_for_fallback:true,
  primary_transport:'raw.githubusercontent.com',
  fallback_transport:'cdn.jsdelivr.net/gh',
  retryable_statuses:[408,425,429,500,502,503,504],
  authoritative_404_fallback:false,
  mutable_branch_fallback:false,
  ingredient_blob_sha_verification_preserved:true,
  identity_blob_sha_verification_preserved:true,
  evidence_authority_changed:false,
},null,2));
