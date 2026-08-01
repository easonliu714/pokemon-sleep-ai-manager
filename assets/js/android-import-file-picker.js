import {loadJSZip} from './jszip-loader.js';
import {extractZipEntries} from './pokemon-zip-adapter.js';

const ACCEPT='.zip,application/zip,image/png,image/jpeg,image/webp,image/avif';

function asFiles(list){return Array.from(list||[]).filter(Boolean);}
function isZip(file){return /\.zip$/i.test(file?.name||'')||file?.type==='application/zip'||file?.type==='application/x-zip-compressed';}
function isImage(file){return /^image\//.test(file?.type||'')||/\.(png|jpe?g|webp|avif)$/i.test(file?.name||'');}

export async function inspectImportFiles(files,{loadZip=loadJSZip,extractZip=extractZipEntries}={}){
  const selected=asFiles(files);
  if(!selected.length)return {ok:false,errors:['no_files_selected'],source_type:null,files:[],archives:[]};
  const zipFiles=selected.filter(isZip);
  const images=selected.filter(isImage);
  const unsupported=selected.filter(file=>!isZip(file)&&!isImage(file));
  if(zipFiles.length&&images.length)return {ok:false,errors:['mixed_zip_and_images_not_allowed'],source_type:null,files:selected,archives:[]};
  if(unsupported.length)return {ok:false,errors:unsupported.map(file=>`unsupported_file:${file.name}`),source_type:null,files:selected,archives:[]};
  if(zipFiles.length>1)return {ok:false,errors:['single_zip_per_batch_required'],source_type:null,files:selected,archives:[]};
  if(images.length)return {ok:true,errors:[],source_type:'screenshots',files:images,archives:[]};
  const JSZip=await loadZip();
  const archive=await extractZip(zipFiles[0],{JSZip});
  if(!archive.summary.image_count)return {ok:false,errors:['zip_contains_no_images'],source_type:'zip',files:zipFiles,archives:[archive]};
  return {ok:true,errors:[],source_type:'zip',files:zipFiles,archives:[archive]};
}

export function createAndroidImportFilePicker({onInspect,onError}={}){
  const wrapper=document.createElement('div');
  wrapper.className='tech2d-file-picker';
  const input=document.createElement('input');
  input.type='file';
  input.accept=ACCEPT;
  input.multiple=true;
  input.hidden=true;
  input.id='tech2dImportFileInput';
  const button=document.createElement('button');
  button.type='button';
  button.className='secondary';
  button.textContent='選擇截圖或 ZIP';
  button.setAttribute('aria-controls',input.id);
  const status=document.createElement('div');
  status.className='notice';
  status.textContent='支援 Android 檔案選擇器、相簿多選與單一 ZIP。每批次只處理一種來源。';
  button.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    button.disabled=true;
    status.textContent='正在檢查檔案…';
    try{
      const result=await inspectImportFiles(input.files);
      status.textContent=result.ok
        ? `已選取 ${result.files.length} 個來源；類型：${result.source_type}`
        : `無法使用：${result.errors.join('、')}`;
      if(result.ok)await onInspect?.(result);
      else onError?.(result);
    }catch(error){
      const result={ok:false,errors:[error?.message||String(error)],source_type:null,files:[],archives:[]};
      status.textContent=`讀取失敗：${result.errors[0]}`;
      onError?.(result);
    }finally{
      button.disabled=false;
      input.value='';
    }
  });
  wrapper.append(button,input,status);
  return wrapper;
}

export {ACCEPT as ANDROID_IMPORT_ACCEPT};
