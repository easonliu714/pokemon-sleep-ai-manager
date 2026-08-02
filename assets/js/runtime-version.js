const UNKNOWN_VERSION='v0.0.0-unknown';
const UNKNOWN_BUILD='unknown-build';

function cleanToken(value,fallback){
  const normalized=String(value||'').trim();
  return (normalized||fallback).replace(/[^a-zA-Z0-9._-]+/g,'_');
}

export function getRuntimeVersion(root=document){
  const element=root?.documentElement||document?.documentElement;
  return {
    app_version:String(element?.dataset?.appVersion||UNKNOWN_VERSION),
    app_build:String(element?.dataset?.appBuild||UNKNOWN_BUILD)
  };
}

export function buildVersionedExportFilename(kind,{extension='json',sourceName=null,root=document,timestamp=null}={}){
  const {app_version,app_build}=getRuntimeVersion(root);
  const version=cleanToken(app_version,UNKNOWN_VERSION);
  const build=cleanToken(app_build,UNKNOWN_BUILD);
  const source=sourceName?`_${cleanToken(String(sourceName).replace(/\.[^.]+$/,''),'source')}`:'';
  const time=timestamp?`_${cleanToken(timestamp,'')}`:'';
  return `pokemon_sleep_${cleanToken(kind,'export')}_${version}_${build}${source}${time}.${cleanToken(extension,'json')}`;
}

export function attachRuntimeVersion(payload,root=document){
  const runtime=getRuntimeVersion(root);
  return {...payload,app_version:runtime.app_version,app_build:runtime.app_build};
}

export {UNKNOWN_VERSION,UNKNOWN_BUILD};
