import fs from 'node:fs';
const picker=fs.readFileSync('assets/js/android-import-file-picker.js','utf8');
const unified=fs.readFileSync('assets/js/unified-import-analysis-workbench.js','utf8');
const entry=fs.readFileSync('assets/js/two-stage-forced-ocr-entry.js','utf8');
const contract=fs.readFileSync('docs/UNIFIED_IMPORT_PIPELINE_CONTRACT.md','utf8');
const required=[
  [picker,'createImageArchive'],[picker,'async readImage'],[picker,"sourceType:zipFiles.length?'zip':'images'"],
  [picker,'enrichInventoryWithFingerprints'],[picker,'classifyInventoryWithOcr'],
  [unified,"const VERSION='v0.3.75'"],[unified,"value=\"ocr_ai\""],[unified,'GENERAL_SCALE=2'],[unified,'SMALL_TEXT_SCALE=4'],
  [unified,'runTwoStageOcr'],[unified,'runAi'],[unified,'executePreparedAiPayload'],[unified,'unified_pipeline_completed'],
  [entry,'unified-import-analysis-workbench.js'],[contract,'Inventory 是預覽、OCR、AI 與 Revision 的唯一來源']
];
for(const [source,token] of required){if(!source.includes(token))throw new Error(`missing_contract:${token}`);}
if(!unified.includes('pokemon-sleep:identity-import-files-selected'))throw new Error('unified_event_missing');
if(!unified.includes('contains_api_key:false')||!unified.includes('contains_image_bytes:false'))throw new Error('secret_or_image_queue_contract_missing');
console.log('G13.5 unified import pipeline gate PASS');
