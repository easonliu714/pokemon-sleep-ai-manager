const TESSERACT_VERSION='5.1.1';
const TESSERACT_SCRIPT_URL=`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const DEFAULT_LANGUAGES=['chi_tra','eng'];
const RUNTIME_SCHEMA='pokemon-sleep-local-ocr-runtime/1.0';
let scriptPromise=null;
let workerPromise=null;
let currentLanguages=null;

function emit(name,detail={}){
  globalThis.dispatchEvent?.(new CustomEvent(`pokemon-sleep:${name}`,{detail:{schema:RUNTIME_SCHEMA,...detail}}));
}

function loadScript(url=TESSERACT_SCRIPT_URL){
  if(globalThis.Tesseract?.createWorker)return Promise.resolve(globalThis.Tesseract);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-ocr-runtime="tesseract-${TESSERACT_VERSION}"]`);
    if(existing){existing.addEventListener('load',()=>resolve(globalThis.Tesseract),{once:true});existing.addEventListener('error',()=>reject(new Error('ocr_runtime_script_load_failed')),{once:true});return;}
    const script=document.createElement('script');
    script.src=url;script.async=true;script.crossOrigin='anonymous';
    script.dataset.ocrRuntime=`tesseract-${TESSERACT_VERSION}`;
    script.addEventListener('load',()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(new Error('ocr_runtime_global_missing')),{once:true});
    script.addEventListener('error',()=>reject(new Error('ocr_runtime_script_load_failed')),{once:true});
    document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;throw error;});
  return scriptPromise;
}

async function createWorker(languages=DEFAULT_LANGUAGES){
  const normalized=[...new Set((languages||DEFAULT_LANGUAGES).filter(Boolean))];
  const languageKey=normalized.join('+');
  if(workerPromise&&currentLanguages===languageKey)return workerPromise;
  if(workerPromise&&currentLanguages!==languageKey){
    try{const oldWorker=await workerPromise;await oldWorker.terminate();}catch{}
    workerPromise=null;
  }
  currentLanguages=languageKey;
  workerPromise=(async()=>{
    emit('ocr_runtime_loading',{engine:'tesseract.js',version:TESSERACT_VERSION,languages:normalized});
    const Tesseract=await loadScript();
    const worker=await Tesseract.createWorker(normalized,1,{
      cacheMethod:'write',
      logger:message=>emit('ocr_runtime_progress',{status:message?.status||null,progress:message?.progress??null})
    });
    emit('ocr_runtime_ready',{engine:'tesseract.js',version:TESSERACT_VERSION,languages:normalized,offline_after_first_load:true});
    return worker;
  })().catch(error=>{workerPromise=null;currentLanguages=null;emit('ocr_runtime_failed',{message:error?.message||String(error)});throw error;});
  return workerPromise;
}

function arrayBufferToBlob(buffer,mimeType='image/png'){
  if(buffer instanceof Blob)return buffer;
  if(buffer instanceof ArrayBuffer)return new Blob([buffer],{type:mimeType});
  if(ArrayBuffer.isView(buffer))return new Blob([buffer.buffer],{type:mimeType});
  throw new Error('ocr_input_type_unsupported');
}

export const localOcrRuntime={
  name:`tesseract.js/${TESSERACT_VERSION}`,
  schema:RUNTIME_SCHEMA,
  async prepare({languages=DEFAULT_LANGUAGES}={}){await createWorker(languages);return this.status();},
  async recognize(buffer,{mimeType='image/png',language='chi_tra+eng'}={}){
    const languages=String(language||'chi_tra+eng').split('+').filter(Boolean);
    const worker=await createWorker(languages);
    const started=performance.now();
    const result=await worker.recognize(arrayBufferToBlob(buffer,mimeType));
    return {text:result?.data?.text||'',confidence:result?.data?.confidence??null,duration_ms:Math.round(performance.now()-started),engine:this.name};
  },
  status(){return {schema:RUNTIME_SCHEMA,engine:this.name,loaded:Boolean(globalThis.Tesseract?.createWorker),worker_ready:Boolean(workerPromise),languages:currentLanguages?.split('+')||[],offline_after_first_load:true,network_required_for_first_load:true};},
  async terminate(){if(workerPromise){try{const worker=await workerPromise;await worker.terminate();}finally{workerPromise=null;currentLanguages=null;}}}
};

globalThis.PokemonSleepOCR=localOcrRuntime;
export {TESSERACT_VERSION,TESSERACT_SCRIPT_URL,DEFAULT_LANGUAGES,RUNTIME_SCHEMA};
