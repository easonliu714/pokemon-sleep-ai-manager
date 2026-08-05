const APP_VERSION='v0.3.84';
const APP_BUILD='20260805-v0384-database-catalog-recovery';

function record(event,details={},status='completed',error=null){
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('release_authority',event,{status,details,error});
}

function enforceRuntimeAuthority(){
  document.documentElement.dataset.appVersion=APP_VERSION;
  document.documentElement.dataset.appBuild=APP_BUILD;
  const badge=document.getElementById('appVersion');
  if(badge){
    badge.textContent=`版本 ${APP_VERSION}`;
    badge.dataset.versionAuthority='v0382-release-authority';
    badge.title=`Pokémon Sleep AI Manager ${APP_VERSION} / ${APP_BUILD}`;
  }
  globalThis.PokemonSleepRuntimeVersion=Object.freeze({app_version:APP_VERSION,app_build:APP_BUILD});
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)){
    record('v0382_service_worker_unsupported',{app_version:APP_VERSION},'blocked');
    return null;
  }
  const url=new URL('../../service-worker.js',import.meta.url);
  try{
    const scope=new URL('../../',import.meta.url).pathname;
    const registration=await navigator.serviceWorker.register(url,{scope,updateViaCache:'none'});
    if(typeof registration?.update==='function')await registration?.update?.();
    record('v0382_service_worker_registered',{app_version:APP_VERSION,build:APP_BUILD,scope:registration?.scope||null,script_url:url.href,registration_available:Boolean(registration)});
    return registration||null;
  }catch(error){
    record('v0382_service_worker_failed',{app_version:APP_VERSION,build:APP_BUILD,message:error?.message||String(error)},'failed',error);
    throw error;
  }
}

enforceRuntimeAuthority();
const registrationPromise=registerServiceWorker();
globalThis.PokemonSleepV0382ReleaseAuthority=Object.freeze({app_version:APP_VERSION,app_build:APP_BUILD,enforceRuntimeAuthority,registrationPromise});
record('v0382_release_authority_ready',{app_version:APP_VERSION,build:APP_BUILD});

export {APP_VERSION,APP_BUILD,enforceRuntimeAuthority,registerServiceWorker};
