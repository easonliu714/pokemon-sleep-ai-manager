import assert from 'node:assert/strict';
import {buildPrivateZipInventory,updateInventoryItem,validatePrivateZipInventory,PRIVATE_ZIP_INVENTORY_SCHEMA} from '../assets/js/data1-zip-inventory.js';

const archive={
  summary:{entry_count:6,image_count:5,total_uncompressed_bytes:12345},
  entries:[
    {path:'pokemon/detail_001.png',extension:'png',size:100,modified_at:'2026-07-30T00:00:00.000Z'},
    {path:'pokemon/detail_001-copy.png',extension:'png',size:100,modified_at:'2026-07-30T00:00:01.000Z'},
    {path:'recipe/recipe_001.jpg',extension:'jpg',size:200},
    {path:'items/bag_001.webp',extension:'webp',size:300},
    {path:'notes/readme.txt',extension:'txt',size:10},
    {path:'empty/',directory:true,extension:'',size:0}
  ]
};
const manifest=buildPrivateZipInventory(archive,{archiveName:'private.zip'});
assert.equal(manifest.schema,PRIVATE_ZIP_INVENTORY_SCHEMA);
assert.equal(manifest.summary.total,4);
assert.equal(manifest.summary.pending,4);
assert.equal(manifest.summary.by_category.pokemon,2);
assert.equal(manifest.summary.by_category.recipe,1);
assert.equal(manifest.summary.by_category.item,1);
assert.ok(manifest.items.every(item=>item.source_image_ref));

const updated=updateInventoryItem(manifest,manifest.items[0].source_image_ref,{status:'processed',confidence:0.95,output_package_ref:'batch-01.json'});
assert.equal(updated.summary.processed,1);
assert.equal(updated.summary.pending,3);
assert.equal(updated.items[0].confidence,0.95);
assert.equal(validatePrivateZipInventory(updated).ok,true);
assert.throws(()=>updateInventoryItem(updated,updated.items[0].source_image_ref,{status:'unknown'}),/invalid_inventory_status/);
console.log(JSON.stringify({ok:true,schema:PRIVATE_ZIP_INVENTORY_SCHEMA,total:updated.summary.total,processed:updated.summary.processed}));
