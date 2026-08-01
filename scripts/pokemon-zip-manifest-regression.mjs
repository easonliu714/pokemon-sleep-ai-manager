import assert from 'node:assert/strict';
import {buildZipManifest,toScreenshotGroupingInput} from '../assets/js/pokemon-zip-manifest.js';

const manifest=buildZipManifest([
  {name:'001.png',page_type:'pokemon_detail',header:{name:'土王',level:31,sp:1183},sections:['profile']},
  {name:'002.png',header:{name:'土王',level:31,sp:1183},sections:['sleep_time']},
  {name:'003.png',page_type:'recipe',header:{}},
  {name:'notes.txt'},
  {name:'folder/',directory:true},
  {name:'004.png',header:{name:'',level:null,sp:null}}
]);

assert.equal(manifest.summary.total,6);
assert.equal(manifest.summary.eligible,2);
assert.equal(manifest.summary.excluded,4);
assert.equal(manifest.summary.non_detail_pages,1);
assert.equal(manifest.summary.non_images,1);
assert.equal(manifest.summary.directories,1);
assert.equal(manifest.summary.unclassified_images,1);
const grouping=toScreenshotGroupingInput(manifest);
assert.equal(grouping.length,2);
assert.equal(grouping[0].header.name,'土王');
assert.equal(grouping[1].sections[0],'sleep_time');
console.log('PASS TECH.2D ZIP manifest classification');
