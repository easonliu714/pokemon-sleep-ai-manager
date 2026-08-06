import './version-authority.js';

const UNKNOWN_VERSION='v0.0.0-unknown';
const UNKNOWN_BUILD='unknown-build';

function cleanToken(value,fallback){
  const normalized=String(value||'').trim();
  return (normalized||fallback).replace(/[^a-zA-Z0-9._-]+/g,'_');
}

function timestampToken(value=new Date()){
  return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

export function getVersionAuthority(){
  return globalThis.PokemonSleepVersionAuthority||Object.freeze({
    app_version:UNKNOWN_VERSION,
    app_build:UNKNOWN_BUILD,
    cache_name:'pokemon-sleep-ai-unknown',
    schema:'pokemon-sleep-version-authority/unknown',
  });
}

export function getRuntimeVersion(root=globalThis.document){
  const authority=getVersionAuthority();
  const element=root?.documentElement||null;
  return {
    app_version:String(element?.dataset?.appVersion||authority.app_version||UNKNOWN_VERSION),
    app_build:String(element?.dataset?.appBuild||authority.app_build||UNKNOWN_BUILD)
  };
}

export function buildVersionedExportFilename(kind,{extension='json',sourceName=null,root=globalThis.document,timestamp=new Date()}={}){
  const {app_version,app_build}=getRuntimeVersion(root);
  const version=cleanToken(app_version,UNKNOWN_VERSION);
  const build=cleanToken(app_build,UNKNOWN_BUILD);
  const source=sourceName?`_${cleanToken(String(sourceName).replace(/\.[^.]+$/,''),'source')}`:'';
  const time=timestamp?`_${cleanToken(timestampToken(timestamp),'')}`:'';
  return `pokemon_sleep_${cleanToken(kind,'export')}_${version}_${build}${source}${time}.${cleanToken(extension,'json')}`;
}

export function attachRuntimeVersion(payload,root=globalThis.document){
  const runtime=getRuntimeVersion(root);
  return {...payload,app_version:runtime.app_version,app_build:runtime.app_build};
}

export {UNKNOWN_VERSION,UNKNOWN_BUILD,timestampToken};
