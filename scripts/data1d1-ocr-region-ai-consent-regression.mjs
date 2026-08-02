import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('assets/js/data1d1-ocr-region-ai-consent.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');

for(const token of ['OCR_REGION_PRESETS','full_image','pokemon_profile','recipe','buildRegionConfig','normalizeRegion','buildAiConsentQueue','validateAiConsent','explicit_consent_required','image_upload_acknowledgement_required','contains_image_bytes:false','contains_api_key:false','ai_review_consent_prepared'])assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(source,/localStorage|sessionStorage|api[_-]?key\s*:/i);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.47'/);
assert.match(bootstrap,/20260802-data1d1-ocr-region-ai-consent/);
assert.match(bootstrap,/data1d1-ocr-region-ai-consent\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.47-data1d1-ocr-region-ai-consent/);
assert.match(worker,/data1d1-ocr-region-ai-consent\.js/);
console.log('PASS DATA.1D.1 OCR region presets and explicit AI consent contract');
