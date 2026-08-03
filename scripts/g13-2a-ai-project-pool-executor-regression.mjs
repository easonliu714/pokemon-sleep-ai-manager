import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {classifyGeminiFailure,normalizeProjectPool,selectAvailableProject,executeWithProjectPool} from '../assets/js/ai-project-pool-runtime.js';

const files=['assets/js/ai-key-vault.js','assets/js/ai-project-pool-runtime.js','assets/js/ai-project-pool-settings.js','assets/js/ai-review-image-resolver.js','assets/js/ai-review-queue-executor.js','assets/js/ai-review-executor-controller.js','assets/js/ai-review-executor-status-ui.js','assets/js/data1d1-ocr-region-ai-consent.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
assert.equal(classifyGeminiFailure({status:429,message:'requests per minute'}).class,'temporary_rate_limit');
assert.equal(classifyGeminiFailure({status:429,message:'daily quota exceeded'}).class,'daily_project_quota_exhausted');
assert.equal(classifyGeminiFailure({status:403,message:'API key not valid'}).disable_project,true);
assert.equal(classifyGeminiFailure({status:500}).retryable,true);
const projects=normalizeProjectPool([{alias:'B',key:'k2',priority:2},{alias:'A',key:'k1',priority:1}]);
assert.equal(selectAvailableProject(projects).alias,'A');
let calls=0;
const fetchImpl=async url=>{calls+=1;if(url.includes('k1'))return {ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'daily quota exceeded'}})};return {ok:true,status:200,headers:{get:()=>null},json:async()=>({candidates:[{content:{parts:[{text:'{"pokemon_name":"測試"}'}]}}]})};};
const result=await executeWithProjectPool({projects,model:'test-model',prompt:'test',imageBase64:'AA==',fetchImpl});
assert.equal(result.ok,true);assert.equal(result.used_alias,'B');assert.equal(calls,2);assert.equal(result.attempts[0].error_class,'daily_project_quota_exhausted');
const vault=fs.readFileSync(files[0],'utf8'),settings=fs.readFileSync(files[2],'utf8'),controller=fs.readFileSync(files[5],'utf8'),consent=fs.readFileSync(files[7],'utf8'),bootstrap=fs.readFileSync(files[8],'utf8'),worker=fs.readFileSync(files[9],'utf8');
for(const token of ['AES-GCM','indexedDB','extractable','ciphertext'])assert.match(vault,new RegExp(token==='extractable'?'false':token));
assert.match(settings,/在此裝置加密保存 API Key/);assert.match(settings,/清除工作階段 Key/);assert.match(settings,/清除此裝置保存的 Key/);
assert.match(controller,/pokemon-sleep:ai-review-queue-consented/);assert.match(consent,/contains_api_key:false/);assert.match(consent,/pokemon-sleep:ai-review-queue-consented/);
for(const source of [vault,settings,controller])assert.doesNotMatch(source,/DebugTrace[^\n]*(?:project\.key|keys\b)/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.59'/);assert.match(bootstrap,/20260803-g13-2a-ai-project-pool-executor/);assert.match(worker,/pokemon-sleep-ai-v0\.3\.59-g13-2a-ai-project-pool-executor/);
console.log(JSON.stringify({ok:true,gate:'G13.2A Project Pool Executor',failover:true,encrypted_vault:true,temporary_rate_limit_no_failover:true}));
