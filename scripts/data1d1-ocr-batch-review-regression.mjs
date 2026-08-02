import fs from 'node:fs';
import assert from 'node:assert/strict';
const classifier=fs.readFileSync('assets/js/data1d-ocr-first-classifier.js','utf8');
const review=fs.readFileSync('assets/js/data1d1-ocr-review-package.js','utf8');
for(const pattern of [/signal/,/shouldCancel/,/classification_status:'cancelled'/,/user_cancelled/,/recognizeRegion/,/ocr_region_count/,/was_cancelled/,/region_mode/])assert.match(classifier,pattern);
for(const pattern of [/OCR_REVIEW_SCHEMA/,/buildOcrReviewQueue/,/buildPrivateOcrReviewPackage/,/downloadPrivateOcrReviewPackage/,/contains_image_bytes:false/,/contains_ocr_full_text:false/,/ocr_review_package_exported/])assert.match(review,pattern);
assert.doesNotMatch(review,/base64|data:image/i);
console.log('PASS DATA.1D.1 cancellable OCR batch, region provider, and private review package contract');
