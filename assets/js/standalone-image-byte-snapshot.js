import {
  createImageArchive,
  ANDROID_IMAGE_BYTE_SNAPSHOT_SCHEMA,
} from './android-import-file-picker.js';

export async function snapshotStandaloneImage(file){
  if(!file)throw new TypeError('standalone_image_file_required');
  const archive=await createImageArchive([file]);
  const entry=archive.entries?.[0]||null;
  if(!entry||entry.byte_snapshot_status!=='ready'){
    const error=new Error(entry?.byte_snapshot_error||'standalone_image_snapshot_failed');
    error.name=entry?.byte_snapshot_error==='NotReadableError'?'NotReadableError':'StandaloneImageSnapshotError';
    error.code='standalone_image_snapshot_failed';
    error.snapshot=archive.byte_snapshot||null;
    throw error;
  }
  const blob=await archive.readImage(entry.path,{type:'blob'});
  return {
    blob,
    source_name:entry.name,
    source_type:blob.type||file.type||'application/octet-stream',
    byte_size:blob.size,
    snapshot:{...archive.byte_snapshot,schema:ANDROID_IMAGE_BYTE_SNAPSHOT_SCHEMA},
  };
}
