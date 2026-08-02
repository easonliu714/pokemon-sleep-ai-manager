import assert from 'node:assert/strict';

const created=[];
const revoked=[];
let sequence=0;
Object.defineProperty(globalThis.URL,'createObjectURL',{configurable:true,value:blob=>{assert.ok(blob instanceof Blob);const url=`blob:test-${++sequence}`;created.push(url);return url;}});
Object.defineProperty(globalThis.URL,'revokeObjectURL',{configurable:true,value:url=>revoked.push(url)});

globalThis.DebugTrace={record(){}};

const {OcrThumbnailUrlPool}=await import('../assets/js/data1d1-ocr-thumbnail-region-confidence.js');
const {createOcrThumbnailOverlayController}=await import('../assets/js/data1d1-ocr-thumbnail-overlay-wiring.js');
const {bindOcrOverlayLifecycle}=await import('../assets/js/data1d1-ocr-overlay-lifecycle-events.js');

const blob=value=>new Blob([value],{type:'image/png'});

// Pool limit: the oldest URL is revoked when maxActive is exceeded.
const pool=new OcrThumbnailUrlPool({maxActive:2});
const first=pool.create('a',blob('a'));
const second=pool.create('b',blob('b'));
assert.equal(pool.activeCount,2);
const third=pool.create('c',blob('c'));
assert.equal(pool.activeCount,2);
assert.deepEqual(revoked,[first.url]);

// Replacing the same ID must revoke its previous URL before storing the replacement.
const replacement=pool.create('b',blob('b2'));
assert.equal(pool.activeCount,2);
assert.ok(revoked.includes(second.url));
assert.notEqual(replacement.url,second.url);
pool.releaseAll();
assert.equal(pool.activeCount,0);
assert.ok(revoked.includes(third.url));
assert.ok(revoked.includes(replacement.url));

// Controller attach/release/releaseAll must keep active URL count bounded and reversible.
const controller=createOcrThumbnailOverlayController({maxActive:3});
await controller.attach({item:{sha256:'one'},blob:blob('1')});
await controller.attach({item:{sha256:'two'},blob:blob('2')});
await controller.attach({item:{sha256:'three'},blob:blob('3')});
assert.equal(controller.activeCount,3);
await controller.attach({item:{sha256:'four'},blob:blob('4')});
assert.equal(controller.activeCount,3);
controller.release('two');
assert.equal(controller.activeCount,2);
controller.releaseAll();
assert.equal(controller.activeCount,0);

// Lifecycle events must release every active Object URL.
const eventController=createOcrThumbnailOverlayController({maxActive:4});
await eventController.attach({item:{sha256:'life-1'},blob:blob('l1')});
await eventController.attach({item:{sha256:'life-2'},blob:blob('l2')});
assert.equal(eventController.activeCount,2);
const target=new EventTarget();
const lifecycle=bindOcrOverlayLifecycle({controller:eventController,target});
target.dispatchEvent(new Event('pokemon-sleep:import-source-changed'));
assert.equal(eventController.activeCount,0);
await eventController.attach({item:{sha256:'life-3'},blob:blob('l3')});
target.dispatchEvent(new Event('pokemon-sleep:ocr-cancel-requested'));
assert.equal(eventController.activeCount,0);
await eventController.attach({item:{sha256:'life-4'},blob:blob('l4')});
target.dispatchEvent(new Event('zip-selection-cleared'));
assert.equal(eventController.activeCount,0);
await eventController.attach({item:{sha256:'life-5'},blob:blob('l5')});
target.dispatchEvent(new Event('pagehide'));
assert.equal(eventController.activeCount,0);
await eventController.attach({item:{sha256:'life-6'},blob:blob('l6')});
lifecycle.dispose();
assert.equal(eventController.activeCount,0);

assert.equal(created.length,revoked.length,'all_created_object_urls_must_be_revoked');
assert.equal(new Set(revoked).size,revoked.length,'object_url_must_not_be_revoked_twice');

console.log(JSON.stringify({
  ok:true,
  gate:'DATA.1D.1 OCR overlay browser lifecycle',
  created_object_urls:created.length,
  revoked_object_urls:revoked.length,
  max_active_verified:3,
  lifecycle_events:['import-source-changed','ocr-cancel-requested','zip-selection-cleared','pagehide','dispose'],
  hardware_validation_required_next:true
}));
