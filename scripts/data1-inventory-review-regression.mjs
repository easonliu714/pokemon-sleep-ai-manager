import assert from 'node:assert/strict';
import {filterInventoryItems,summarizeReviewProgress,patchInventoryReview,bulkPatchInventoryReview,buildReviewPackage} from '../assets/js/data1-inventory-review.js';

const manifest={schema:'pokemon-sleep-private-zip-inventory/1.0',archive:{name:'private.zip'},items:[
  {source_image_ref:'a',file_name:'pokemon_1.png',path:'pokemon/1.png',category:'pokemon',status:'pending',confidence:null,duplicate_of:null},
  {source_image_ref:'b',file_name:'recipe_1.png',path:'recipe/1.png',category:'recipe',status:'processed',confidence:0.9,duplicate_of:null},
  {source_image_ref:'c',file_name:'bag_1.png',path:'item/1.png',category:'item',status:'review_required',confidence:null,duplicate_of:null}
]};
const filtered=filterInventoryItems(manifest,{status:'pending'});assert.equal(filtered.length,1);assert.equal(filtered[0].source_image_ref,'a');
const patched=patchInventoryReview(manifest,'a',{status:'processed',category:'pokemon',confidence:0.95,notes:'verified'});assert.equal(patched.summary.processed,2);
const bulk=bulkPatchInventoryReview(patched,['c'],{status:'ignored',category:'item'});assert.equal(bulk.summary.ignored,1);
const progress=summarizeReviewProgress(bulk);assert.equal(progress.total,3);assert.equal(progress.reviewed,3);assert.equal(progress.percent,100);
const pkg=buildReviewPackage(bulk);assert.equal(pkg.schema,'pokemon-sleep-private-inventory-review/1.0');assert.equal(pkg.items.length,3);
assert.throws(()=>patchInventoryReview(manifest,'a',{category:'invalid'}),/invalid_inventory_category/);
console.log(JSON.stringify({ok:true,total:progress.total,reviewed:progress.reviewed,percent:progress.percent}));
