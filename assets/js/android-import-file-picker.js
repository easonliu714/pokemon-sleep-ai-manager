import {loadJSZip} from './jszip-loader.js';
import {extractZipEntries} from './pokemon-zip-adapter.js';
import {debugTrace} from './debug-trace-manager.js';

const IMAGE_ACCEPT='image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif';
const ZIP_ACCEPT='.zip,application/zip,application/x-zip-compressed';
const ERROR_MESSAGES={
  no_files_selected:'未選取任何檔案。',
  mixed_zip_and_images_not_allowed:'請勿同時選擇圖片與 ZIP；請改用對應的獨立按鈕。',
  single_zip_per_batch_required:'一次只能選擇一個 ZIP。請確認 ZIP 內圖片屬於同一個匯入情境，再重新選擇。',
  zip_contains_no_images:'ZIP 內沒有支援的圖片。支援 PNG、JPG、JPEG、WEBP、AVIF。',
};

function asFiles(list){return Array.from(list||[]).filter(Boolean);}
function isZip(file){return /\.zip$/i.test(file?.name||'')||file?.type==='application/zip'||file?.type==='application/x-zip-compressed';}
function isImage(file){return /^image\//.test(file?.type||'')||/\.(png|jpe?g|webp|avif)$/i.test(file?.name||'');}
export function humanizeImportError(code){
  if(ERROR_MESSAGES[code])return ERROR_MESSAGES[code];
  if(String(code).startsWith('unsupported_file:'))return `不支援此檔案格式：${String(code).split(':').slice(1).join(':')}。`;
  return `檔案讀取失敗。錯誤代碼：${code}`;
}

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

function createHiddenInput({id,accept,multiple}){
  const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.hidden=true;input.id=id;return input;
}
function errorText(result){return (result.errors||[]).map(code=>`${humanizeImportError(code)}（${code}）`).join(' ');}

export function createAndroidImportFilePicker({onInspect,onError}={}){
  const wrapper=document.createElement('div');wrapper.className='tech2d-file-picker';
  const imageInput=createHiddenInput({id:'tech2dImageInput',accept:IMAGE_ACCEPT,multiple:true});
  const zipInput=createHiddenInput({id:'tech2dZipInput',accept:ZIP_ACCEPT,multiple:false});
  const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='secondary';imageButton.textContent='選擇圖片';imageButton.setAttribute('aria-controls',imageInput.id);
  const zipButton=document.createElement('button');zipButton.type='button';zipButton.className='secondary';zipButton.textContent='選擇 ZIP';zipButton.setAttribute('aria-controls',zipInput.id);
  const buttonRow=document.createElement('div');buttonRow.className='tech2d-file-picker-actions';buttonRow.append(imageButton,zipButton);
  const status=document.createElement('div');status.className='notice';status.textContent='圖片支援 PNG、JPG、JPEG、WEBP、AVIF；ZIP 每次限一個，且內容應屬於同一個匯入情境。';
  imageButton.addEventListener('click',()=>imageInput.click());zipButton.addEventListener('click',()=>zipInput.click());

  const handle=async(input,sourceKind)=>{
    const buttons=[imageButton,zipButton];buttons.forEach(button=>button.disabled=true);
    const operationId=debugTrace.begin('import_source_inspection',{source_kind:sourceKind,file_count:input.files?.length||0});
    debugTrace.recordStage(operationId,'file_selection_received',{source_kind:sourceKind,file_count:input.files?.length||0});
    status.textContent=sourceKind==='zip'?'正在讀取並檢查 ZIP…':'正在檢查圖片…';
    try{
      const result=await inspectImportFiles(input.files);
      if(result.ok){
        const archive=result.archives?.[0];
        debugTrace.recordStage(operationId,result.source_type==='zip'?'zip_inspection_completed':'image_selection_completed',{source_type:result.source_type,source_count:result.files.length,image_count:archive?.summary?.image_count||result.files.length});
        debugTrace.end(operationId,'completed',{source_type:result.source_type,source_count:result.files.length});
        status.textContent=result.source_type==='zip'
          ? `ZIP 檢查完成：1 個 ZIP，內含 ${archive?.summary?.image_count||0} 張支援圖片。`
          : `圖片檢查完成：已選取 ${result.files.length} 張圖片。`;
        await onInspect?.(result);
      }else{
        debugTrace.end(operationId,'blocked',{errors:result.errors,source_kind:sourceKind});
        status.textContent=errorText(result);onError?.(result);
      }
    }catch(error){
      debugTrace.fail(operationId,error,{source_kind:sourceKind});
      const result={ok:false,errors:[error?.message||String(error)],source_type:null,files:[],archives:[]};
      status.textContent=`讀取失敗：${humanizeImportError(result.errors[0])}`;onError?.(result);
    }finally{buttons.forEach(button=>button.disabled=false);input.value='';}
  };
  imageInput.addEventListener('change',()=>handle(imageInput,'images'));
  zipInput.addEventListener('change',()=>handle(zipInput,'zip'));
  wrapper.append(buttonRow,imageInput,zipInput,status);
  return wrapper;
}

export {IMAGE_ACCEPT as ANDROID_IMAGE_ACCEPT,ZIP_ACCEPT as ANDROID_ZIP_ACCEPT};
