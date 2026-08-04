import {loadJSZip} from './jszip-loader.js';
import {extractZipEntries} from './pokemon-zip-adapter.js';
import {buildPrivateZipInventory,finalizeInventory} from './data1-zip-inventory.js';
import {enrichInventoryWithFingerprints} from './data1-image-fingerprint.js';
import {classifyInventoryWithOcr,resolveOcrProvider} from './data1d-ocr-first-classifier.js';

const IMAGE_ACCEPT='image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif';
const ZIP_ACCEPT='.zip,application/zip,application/x-zip-compressed';
const IMPORT_ACCEPT=`${ZIP_ACCEPT},${IMAGE_ACCEPT}`;
const ERROR_MESSAGES={no_files_selected:'未選取任何檔案。',mixed_zip_and_images_not_allowed:'請勿同時選擇圖片與 ZIP；請改用對應的獨立按鈕。',single_zip_per_batch_required:'一次只能選擇一個 ZIP。',zip_contains_no_images:'ZIP 內沒有支援的圖片。',review_render_timeout:'分析清單建立逾時，系統已保留清點結果與本頁除錯紀錄。'};
const EXT_BY_TYPE={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'};
const asFiles=list=>Array.from(list||[]).filter(Boolean);
const isZip=file=>/\.zip$/i.test(file?.name||'')||['application/zip','application/x-zip-compressed'].includes(file?.type);
const isImage=file=>/^image\//.test(file?.type||'')||/\.(png|jpe?g|webp|avif)$/i.test(file?.name||'');
const yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0));
function getDebugTrace(){const trace=globalThis.DebugTrace;if(trace?.begin&&trace?.recordStage&&trace?.recordProgress&&trace?.end&&trace?.fail)return trace;return {begin:()=>null,recordStage:()=>null,recordProgress:()=>null,end:()=>null,fail:()=>null};}
function dispatchBatch(name,detail={}){globalThis.dispatchEvent?.(new CustomEvent(`pokemon-sleep:ocr-batch-${name}`,{detail}));}
function dispatchCheckpoint(stage,details={}){globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:update-center-debug',{detail:{stage,details}}));}
function withTimeout(promise,timeoutMs,code='review_render_timeout'){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error(code);error.code=code;reject(error);},timeoutMs);})]).finally(()=>clearTimeout(timer));}
export function humanizeImportError(code){if(ERROR_MESSAGES[code])return ERROR_MESSAGES[code];if(String(code).startsWith('unsupported_file:'))return `不支援此檔案格式：${String(code).split(':').slice(1).join(':')}。`;if(code==='ocr_timeout')return '單張圖片 OCR 超時，系統已重建辨識器並繼續後續圖片。';if(code==='ocr_stalled')return 'OCR 長時間無進度，系統已重建辨識器並繼續後續圖片。';return `檔案讀取失敗。錯誤代碼：${code}`;}

function createImageArchive(files){
  const entries=files.map((file,index)=>{const ext=(file.name.split('.').pop()||EXT_BY_TYPE[file.type]||'png').toLowerCase();return {path:file.name||`image-${index+1}.${ext}`,name:file.name||`image-${index+1}.${ext}`,extension:ext,size:file.size,modified_at:file.lastModified?new Date(file.lastModified).toISOString():null,directory:false,file};});
  const byPath=new Map(entries.map(entry=>[entry.path,entry]));
  return {entries,summary:{entry_count:entries.length,image_count:entries.length,total_uncompressed_bytes:entries.reduce((sum,row)=>sum+Number(row.size||0),0)},async readImage(path,{type='blob'}={}){const entry=byPath.get(path);if(!entry)throw new Error(`image_source_not_found:${path}`);if(type==='blob')return entry.file;if(type==='arraybuffer')return entry.file.arrayBuffer();if(type==='uint8array')return new Uint8Array(await entry.file.arrayBuffer());return entry.file;}};
}

async function buildUnifiedResult({selected,sourceType,loadZip,extractZip,onStage,onFingerprintProgress,onOcrProgress,ocrProvider,signal,shouldCancel,regions,itemTimeoutMs}){
  let archive,sourceFiles=selected;
  if(sourceType==='zip'){
    onStage('archive_read_started');await yieldUi();const JSZip=await loadZip();archive=await extractZip(selected[0],{JSZip});onStage('archive_read_completed',{image_count:archive.summary.image_count});if(!archive.summary.image_count)return {ok:false,errors:['zip_contains_no_images'],source_type:'zip',files:selected,archives:[archive],inventory:null};
  }else{
    archive=createImageArchive(selected);onStage('image_archive_created',{image_count:archive.summary.image_count});
  }
  const archiveName=sourceType==='zip'?(selected[0]?.name||null):`selected-images-${new Date().toISOString()}`;
  const baseInventory=buildPrivateZipInventory(archive,{archiveName});
  onStage('fingerprint_started',{image_count:archive.summary.image_count});
  const fingerprinted=await enrichInventoryWithFingerprints(archive,baseInventory,{onProgress:onFingerprintProgress});
  onStage('fingerprint_completed',{new_images:fingerprinted?.fingerprint_summary?.new_images||0,duplicates:(fingerprinted?.fingerprint_summary?.existing_index_matches||0)+(fingerprinted?.fingerprint_summary?.within_archive_duplicates||0)});
  await yieldUi();
  const ocrItems=(fingerprinted?.items||[]).filter(item=>!['duplicate','ignored','unreadable'].includes(item.status));
  onStage('ocr_started',{ocr_total:ocrItems.length,skipped:(fingerprinted?.items||[]).length-ocrItems.length});
  let classified;
  if(!ocrItems.length){onStage('ocr_skipped_duplicate_only',{total:(fingerprinted?.items||[]).length});classified=fingerprinted;}
  else classified=await classifyInventoryWithOcr(archive,fingerprinted,{ocrProvider,onProgress:onOcrProgress,signal,shouldCancel,regions,itemTimeoutMs});
  onStage('ocr_completed',{analyzed:classified?.classification_summary?.analyzed||0,failed:classified?.classification_summary?.failed||0});
  onStage('finalize_started');const inventory=finalizeInventory(classified);onStage('finalize_completed');
  return {ok:true,errors:[],source_type:sourceType,files:sourceFiles,archives:[archive],inventory};
}

export async function inspectImportFiles(files,{loadZip=loadJSZip,extractZip=extractZipEntries,onFingerprintProgress=()=>{},onOcrProgress=()=>{},onStage=()=>{},ocrProvider=resolveOcrProvider(),signal=null,shouldCancel=()=>false,regions=[],itemTimeoutMs=30000}={}){
  const selected=asFiles(files);if(!selected.length)return {ok:false,errors:['no_files_selected'],source_type:null,files:[],archives:[],inventory:null};
  const zipFiles=selected.filter(isZip),images=selected.filter(isImage),unsupported=selected.filter(file=>!isZip(file)&&!isImage(file));
  if(zipFiles.length&&images.length)return {ok:false,errors:['mixed_zip_and_images_not_allowed'],source_type:null,files:selected,archives:[],inventory:null};
  if(unsupported.length)return {ok:false,errors:unsupported.map(file=>`unsupported_file:${file.name}`),source_type:null,files:selected,archives:[],inventory:null};
  if(zipFiles.length>1)return {ok:false,errors:['single_zip_per_batch_required'],source_type:null,files:selected,archives:[],inventory:null};
  return buildUnifiedResult({selected,sourceType:zipFiles.length?'zip':'images',loadZip,extractZip,onStage,onFingerprintProgress,onOcrProgress,ocrProvider,signal,shouldCancel,regions,itemTimeoutMs});
}

function createHiddenInput({id,accept,multiple}){const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.hidden=true;input.id=id;return input;}
function errorText(result){return (result.errors||[]).map(code=>`${humanizeImportError(code)}（${code}）`).join(' ');}
export function createAndroidImportFilePicker({onInspect,onError}={}){
  const wrapper=document.createElement('div');wrapper.className='tech2d-file-picker';
  const imageInput=createHiddenInput({id:'tech2dImageInput',accept:IMAGE_ACCEPT,multiple:true}),zipInput=createHiddenInput({id:'tech2dZipInput',accept:ZIP_ACCEPT,multiple:false});
  const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='secondary';imageButton.textContent='新增圖片';
  const zipButton=document.createElement('button');zipButton.type='button';zipButton.className='secondary';zipButton.textContent='新增 ZIP';
  const buttonRow=document.createElement('div');buttonRow.className='tech2d-file-picker-actions';buttonRow.append(imageButton,zipButton);
  const status=document.createElement('div');status.className='notice';status.textContent='圖片與 ZIP 共用同一套清點、SHA-256、預覽、OCR、AI、Cross Check 與人工確認流程。';
  imageButton.onclick=()=>imageInput.click();zipButton.onclick=()=>zipInput.click();let activeController=null,cancelRequested=false;
  const cancelListener=async()=>{cancelRequested=true;activeController?.abort('user_cancelled');status.textContent='正在停止 OCR…';try{await globalThis.PokemonSleepOCR?.cancel?.('user_cancelled');}catch{}status.textContent='OCR 已停止，可重新選擇來源。';};
  globalThis.addEventListener?.('pokemon-sleep:ocr-cancel-requested',cancelListener);
  const handle=async(input,sourceKind)=>{const debugTrace=getDebugTrace(),buttons=[imageButton,zipButton];buttons.forEach(button=>button.disabled=true);activeController=new AbortController();cancelRequested=false;const operationId=debugTrace.begin('unified_import_source_inspection',{source_kind:sourceKind,file_count:input.files?.length||0});dispatchBatch('started',{source_kind:sourceKind,file_count:input.files?.length||0,phase:'PREPARING_SOURCE'});dispatchCheckpoint('file_selection_received',{source_kind:sourceKind,file_count:input.files?.length||0});status.textContent='正在建立統一圖片清單…';await yieldUi();try{const result=await inspectImportFiles(input.files,{signal:activeController.signal,shouldCancel:()=>cancelRequested,itemTimeoutMs:30000,onStage:(stage,details={})=>{dispatchCheckpoint(stage,details);debugTrace.recordStage(operationId,stage,details);if(stage==='fingerprint_started')status.textContent='正在計算 SHA-256…';if(stage==='ocr_started')status.textContent=`OCR 初判：需辨識 ${details.ocr_total} 張；略過 ${details.skipped} 張。`;if(stage==='ocr_skipped_duplicate_only')status.textContent='全部圖片已存在；仍可在清單中勾選後強制重新辨識。';if(stage==='finalize_started')status.textContent='正在建立統一 Inventory…';},onFingerprintProgress:progress=>debugTrace.recordProgress(operationId,'image_fingerprint_progress',progress.current,progress.total,progress),onOcrProgress:progress=>debugTrace.recordProgress(operationId,'ocr_classification_progress',progress.current,progress.total,progress)});if(result.ok){const classification=result.inventory?.classification_summary||{};const detail={source_type:result.source_type,total:classification.total||0,analyzed:classification.analyzed||0,skipped:classification.skipped||0,failed:classification.failed||0,requires_review:classification.requires_review||0};await withTimeout(onInspect?.(result),15000);dispatchBatch('completed',detail);debugTrace.end(operationId,'completed',detail);status.textContent=`清點完成：共 ${detail.total} 張；OCR ${detail.analyzed}；略過 ${detail.skipped}；待覆核 ${detail.requires_review}。`;globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:unified-import-ready',{detail:{result}}));}else{status.textContent=errorText(result);onError?.(result);debugTrace.end(operationId,'blocked',{errors:result.errors});}}catch(error){status.textContent=`讀取失敗：${humanizeImportError(error?.code||error?.message||String(error))}`;onError?.({ok:false,errors:[error?.code||error?.message||String(error)],source_type:null,files:[],archives:[],inventory:null});debugTrace.fail(operationId,error,{source_kind:sourceKind});}finally{activeController=null;buttons.forEach(button=>button.disabled=false);input.value='';await yieldUi();}};
  imageInput.addEventListener('change',()=>handle(imageInput,'images'));zipInput.addEventListener('change',()=>handle(zipInput,'zip'));wrapper.append(buttonRow,imageInput,zipInput,status);return wrapper;
}
export {IMPORT_ACCEPT as ANDROID_IMPORT_ACCEPT,IMAGE_ACCEPT as ANDROID_IMAGE_ACCEPT,ZIP_ACCEPT as ANDROID_ZIP_ACCEPT};
