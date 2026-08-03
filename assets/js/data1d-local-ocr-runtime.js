const TESSERACT_VERSION='5.1.1';
const TESSERACT_SCRIPT_URL=`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const DEFAULT_LANGUAGES=['chi_tra','eng'];
const RUNTIME_SCHEMA='pokemon-sleep-local-ocr-runtime/1.1';
const DEFAULT_TIMEOUT_MS=30000;
const DEFAULT_STALL_MS=20000;
let scriptPromise=null;
let workerPromise=null;
let currentLanguages=null;
let workerGeneration=0;
let activeJob=null;

function emit(name,detail={}){globalThis.dispatchEvent?.(new CustomEvent(`pokemon-sleep:${name}`,{detail:{schema:RUNTIME_SCHEMA,...detail}}));}
function now(){return Date.now();}
function createRuntimeError(code,message=code){const error=new Error(message);error.code=code;return error;}
function loadScript(url=TESSERACT_SCRIPT_URL){
  if(globalThis.Tesseract?.createWorker)return Promise.resolve(globalThis.Tesseract);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-ocr-runtime="tesseract-${TESSERACT_VERSION}"]`);
    if(existing){existing.addEventListener('load',()=>resolve(globalThis.Tesseract),{once:true});existing.addEventListener('error',()=>reject(createRuntimeError('ocr_runtime_script_load_failed')),{once:true});return;}
    const script=document.createElement('script');script.src=url;script.async=true;script.crossOrigin='anonymous';script.dataset.ocrRuntime=`tesseract-${TESSERACT_VERSION}`;
    script.addEventListener('load',()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(createRuntimeError('ocr_runtime_global_missing')),{once:true});
    script.addEventListener('error',()=>reject(createRuntimeError('ocr_runtime_script_load_failed')),{once:true});document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;throw error;});return scriptPromise;
}
async function terminateWorker(reason='manual_terminate'){
  const pending=workerPromise;workerPromise=null;currentLanguages=null;workerGeneration+=1;
  if(activeJob){activeJob.abortReason=reason;activeJob=null;}
  if(pending){try{const worker=await pending;await worker.terminate();}catch{}}
  emit('ocr_runtime_worker_terminated',{reason,worker_generation:workerGeneration});
}
async function createWorker(languages=DEFAULT_LANGUAGES){
  const normalized=[...new Set((languages||DEFAULT_LANGUAGES).filter(Boolean))];const languageKey=normalized.join('+');
  if(workerPromise&&currentLanguages===languageKey)return workerPromise;
  if(workerPromise&&currentLanguages!==languageKey)await terminateWorker('language_changed');
  currentLanguages=languageKey;const generation=++workerGeneration;
  workerPromise=(async()=>{emit('ocr_runtime_loading',{engine:'tesseract.js',version:TESSERACT_VERSION,languages:normalized,worker_generation:generation});const Tesseract=await loadScript();const worker=await Tesseract.createWorker(normalized,1,{cacheMethod:'write',logger:message=>{if(activeJob){activeJob.lastProgressAt=now();activeJob.lastStatus=message?.status||null;activeJob.progress=message?.progress??null;}emit('ocr_runtime_progress',{status:message?.status||null,progress:message?.progress??null,worker_generation:generation,job_id:activeJob?.jobId||null});}});emit('ocr_runtime_ready',{engine:'tesseract.js',version:TESSERACT_VERSION,languages:normalized,offline_after_first_load:true,worker_generation:generation});return worker;})().catch(error=>{workerPromise=null;currentLanguages=null;emit('ocr_runtime_failed',{message:error?.message||String(error),worker_generation:generation});throw error;});return workerPromise;
}
function arrayBufferToBlob(buffer,mimeType='image/png'){if(buffer instanceof Blob)return buffer;if(buffer instanceof ArrayBuffer)return new Blob([buffer],{type:mimeType});if(ArrayBuffer.isView(buffer))return new Blob([buffer.buffer],{type:mimeType});throw createRuntimeError('ocr_input_type_unsupported');}
function raceJob(promise,{signal,timeoutMs,stallMs,job}){
  return new Promise((resolve,reject)=>{
    let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearInterval(stallTimer);clearTimeout(timeoutTimer);signal?.removeEventListener('abort',abortHandler);fn(value);};
    const abortHandler=()=>finish(reject,createRuntimeError('ocr_cancelled','OCR cancelled'));
    if(signal?.aborted)return abortHandler();signal?.addEventListener('abort',abortHandler,{once:true});
    const timeoutTimer=setTimeout(()=>finish(reject,createRuntimeError('ocr_timeout',`OCR exceeded ${timeoutMs}ms`)),timeoutMs);
    const stallTimer=setInterval(()=>{if(now()-job.lastProgressAt>=stallMs)finish(reject,createRuntimeError('ocr_stalled',`OCR stalled for ${stallMs}ms`));},1000);
    promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
}
async function recognizeWithRecovery(buffer,{mimeType='image/png',language='chi_tra+eng',signal=null,timeoutMs=DEFAULT_TIMEOUT_MS,stallMs=DEFAULT_STALL_MS,retry=1}={}){
  const languages=String(language||'chi_tra+eng').split('+').filter(Boolean);let attempt=0;
  while(attempt<=retry){attempt+=1;const worker=await createWorker(languages);const job={jobId:`ocr-${now()}-${attempt}`,startedAt:now(),lastProgressAt:now(),lastStatus:'recognize_start',progress:0,attempt,abortReason:null};activeJob=job;emit('ocr_runtime_job_started',{job_id:job.jobId,attempt,timeout_ms:timeoutMs,stall_ms:stallMs,worker_generation:workerGeneration});
    try{const started=performance.now();const result=await raceJob(worker.recognize(arrayBufferToBlob(buffer,mimeType)),{signal,timeoutMs,stallMs,job});emit('ocr_runtime_job_completed',{job_id:job.jobId,attempt,duration_ms:Math.round(performance.now()-started)});activeJob=null;return {text:result?.data?.text||'',confidence:result?.data?.confidence??null,duration_ms:Math.round(performance.now()-started),engine:localOcrRuntime.name,attempt};}
    catch(error){emit('ocr_runtime_job_failed',{job_id:job.jobId,attempt,code:error?.code||null,message:error?.message||String(error)});await terminateWorker(error?.code||'recognize_failed');if(error?.code==='ocr_cancelled'||attempt>retry)throw error;emit('ocr_runtime_retrying',{attempt:attempt+1,reason:error?.code||error?.message||String(error)});await new Promise(resolve=>setTimeout(resolve,0));}
  }
}
export const localOcrRuntime={
  name:`tesseract.js/${TESSERACT_VERSION}`,schema:RUNTIME_SCHEMA,
  async prepare({languages=DEFAULT_LANGUAGES}={}){await createWorker(languages);return this.status();},
  async recognize(buffer,options={}){return recognizeWithRecovery(buffer,options);},
  status(){return {schema:RUNTIME_SCHEMA,engine:this.name,loaded:Boolean(globalThis.Tesseract?.createWorker),worker_ready:Boolean(workerPromise),worker_generation:workerGeneration,languages:currentLanguages?.split('+')||[],active_job:activeJob?{job_id:activeJob.jobId,started_at:activeJob.startedAt,last_progress_at:activeJob.lastProgressAt,last_status:activeJob.lastStatus,progress:activeJob.progress,attempt:activeJob.attempt}:null,offline_after_first_load:true,network_required_for_first_load:true,timeout_ms:DEFAULT_TIMEOUT_MS,stall_ms:DEFAULT_STALL_MS};},
  async cancel(reason='user_cancelled'){await terminateWorker(reason);},
  async terminate(){await terminateWorker('manual_terminate');}
};
globalThis.PokemonSleepOCR=localOcrRuntime;
export {TESSERACT_VERSION,TESSERACT_SCRIPT_URL,DEFAULT_LANGUAGES,RUNTIME_SCHEMA,DEFAULT_TIMEOUT_MS,DEFAULT_STALL_MS};