// G14.1 evidence-only audit. This module does not load, export, import,
// modify, or inspect individual player records or touch IndexedDB.
// It is safe to use with REDACTED backup/restore metadata only.
export const G141_BACKUP_MANIFEST_SCHEMA='pokemon-sleep-backup-manifest/2.0';
export const G141_RECEIPT_STAGES=Object.freeze({
  IMMEDIATE:'AFTER_RESTORE_BEFORE_ADDITIONAL_WRITES',
  RELOAD:'AFTER_RELOAD_OR_OTHER_WRITES',
});
const sha256=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const nonnegativeInteger=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const positiveInteger=value=>nonnegativeInteger(value)&&value>0;
const decide=(status,reason,extra={})=>Object.freeze({status,reason,source:'G14.1_REDACTED_METADATA_ONLY',
  player_rows_read:false,player_rows_written:false,...extra});
const countForeignErrors=value=>Array.isArray(value)?value.length:value;

export function evaluateG141CrossDeviceRestoreEvidence({
  oldManifest=null,newReceipt=null,stage=G141_RECEIPT_STAGES.RELOAD,
}={}){
  if(!newReceipt||typeof newReceipt!=='object'||newReceipt.integrity_ok!==true||
      countForeignErrors(newReceipt.foreign_key_errors)!==0){
    return decide('HOLD','NEW_PHONE_SQLITE_INTEGRITY_NOT_PROVEN');
  }
  if(!positiveInteger(newReceipt.database_size))return decide('HOLD','NEW_PHONE_DATABASE_SIZE_INVALID');
  // A healthy replacement on a brand-new phone is independently useful even
  // when no OLD-phone manifest or full SHA was shared with the auditor.
  if(!oldManifest)return decide('DEVICE_INTEGRITY_PASS_ONLY','OLD_PHONE_MANIFEST_NOT_PROVIDED',
    {new_phone_database_size:newReceipt.database_size});
  if(oldManifest.schema!==G141_BACKUP_MANIFEST_SCHEMA||
      oldManifest.verification?.integrity_ok!==true||
      oldManifest.verification?.foreign_key_error_count!==0){
    return decide('HOLD','OLD_PHONE_MANIFEST_NOT_VERIFIED');
  }
  if(!positiveInteger(oldManifest.database_size)||
      !sha256(oldManifest.database_sha256))return decide('HOLD','OLD_PHONE_SHA_OR_SIZE_INVALID');
  if(!oldManifest.table_counts||typeof oldManifest.table_counts!=='object'||
      Array.isArray(oldManifest.table_counts)||
      Object.keys(oldManifest.table_counts).length===0){
    return decide('HOLD','OLD_PHONE_TABLE_COUNTS_MISSING');
  }
  const tables=Object.keys(oldManifest.table_counts);
  if(tables.some(t=>!/^[a-z][a-z0-9_]*$/.test(t)||
      !nonnegativeInteger(oldManifest.table_counts[t])||
      !nonnegativeInteger(newReceipt.table_counts?.[t]))){
    return decide('HOLD','INCOMPLETE_OR_INVALID_TABLE_COUNTS');
  }
  const mismatches=tables.filter(t=>oldManifest.table_counts[t]!==newReceipt.table_counts[t]);
  const strictStage=stage===G141_RECEIPT_STAGES.IMMEDIATE;
  if(!strictStage&&stage!==G141_RECEIPT_STAGES.RELOAD)return decide('HOLD','UNKNOWN_RECEIPT_CAPTURE_STAGE');
  if(mismatches.length){
    // Once the app resumes after import, public/master/settings rows can be
    // reconciled. Differences require review, not an invented data-loss claim.
    return decide('REVIEW_REQUIRED',strictStage?'IMMEDIATE_TABLE_COUNT_MISMATCH':'POST_RELOAD_TABLE_COUNTS_DIFFER',
      {mismatched_table_names:Object.freeze([...mismatches]),count_table_total:tables.length});
  }
  if(!sha256(newReceipt.database_sha256)){
    return decide('COUNT_PARITY_ONLY','NEW_PHONE_COMPLETE_SHA_NOT_PROVIDED',
      {matched_table_count:tables.length,byte_size_equal:oldManifest.database_size===newReceipt.database_size});
  }
  const digestEqual=oldManifest.database_sha256.toLowerCase()===newReceipt.database_sha256.toLowerCase();
  const sizeEqual=oldManifest.database_size===newReceipt.database_size;
  if(!digestEqual||!sizeEqual){
    return decide('REVIEW_REQUIRED',strictStage?'IMMEDIATE_BYTE_PARITY_MISMATCH':'POST_RELOAD_BYTES_CHANGED_NOT_AUTOMATIC_DATA_LOSS',
      {matched_table_count:tables.length,digest_equal:digestEqual,byte_size_equal:sizeEqual});
  }
  return decide('EXACT_SQLITE_BYTES_PARITY_PASS','MANIFEST_RECEIPT_SHA_SIZE_COUNTS_MATCH',
    {matched_table_count:tables.length,bytes_equal:true,sha256:oldManifest.database_sha256.toLowerCase(),
      capture_stage:stage});
}
