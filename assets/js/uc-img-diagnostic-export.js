const clean=value=>String(value??'').trim();

function compactStamp(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return 'unknown-time';
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

function safeToken(value,fallback='unknown'){
  const text=clean(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
  return text||fallback;
}

export function buildUcImgDiagnosticFilename({appVersion=null,scenarioKey=null,sessionId=null,generatedAt=null}={}){
  return `pokemon_sleep_ucimg_diagnostic_${safeToken(appVersion,'unknown-version')}_${safeToken(scenarioKey,'unknown-scenario')}_${safeToken(sessionId,'unknown-session')}_${compactStamp(generatedAt||new Date())}.json`;
}

export function serializeUcImgDiagnosticBundle(bundle){
  return `${JSON.stringify(bundle,null,2)}\n`;
}

export function downloadUcImgDiagnosticJson(bundle,{filename=null,documentRef=globalThis.document,urlApi=globalThis.URL,BlobCtor=globalThis.Blob}={}){
  if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))throw new Error('AI 診斷包必須是 JSON 物件');
  if(!documentRef?.createElement||!urlApi?.createObjectURL||!BlobCtor)throw new Error('目前瀏覽器不支援診斷 JSON 下載');
  const finalName=filename||buildUcImgDiagnosticFilename({
    appVersion:bundle.app_version,
    scenarioKey:bundle.scenario_key,
    sessionId:bundle.session_id,
    generatedAt:bundle.generated_at,
  });
  const blob=new BlobCtor([serializeUcImgDiagnosticBundle(bundle)],{type:'application/json;charset=utf-8'});
  const href=urlApi.createObjectURL(blob),anchor=documentRef.createElement('a');
  anchor.href=href;anchor.download=finalName;anchor.style.display='none';
  documentRef.body?.appendChild(anchor);
  try{anchor.click();}finally{anchor.remove?.();setTimeout(()=>urlApi.revokeObjectURL?.(href),0);}
  return finalName;
}
