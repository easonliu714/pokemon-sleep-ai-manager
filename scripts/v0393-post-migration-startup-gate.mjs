import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const database = read('assets/js/database.js');
const app = read('assets/js/app.js');
const bootstrap = read('assets/js/bootstrap.js');
const serviceWorker = read('service-worker.js');
const index = read('index.html');

assert.match(database, /DATABASE_READY_DISPATCH_SCHEDULED/);
assert.match(database, /DATABASE_READY_DISPATCH_START/);
assert.match(database, /DATABASE_READY_DISPATCH_COMPLETED/);
assert.match(database, /POST_MIGRATION_HANDOFF/);
assert.match(database, /SQLITE_SOURCE_BUFFER_RELEASED/);
assert.match(database, /setTimeout\(\(\)=>\{/);
assert.doesNotMatch(database, /const dispatchReady=detail=>.*dispatchEvent/);
assert.match(database, /bytes=null;/);
assert.match(database, /const byteLength=bytes\?\.byteLength\|\|0/);
assert.match(database, /const restored=Boolean\(bytes\)/);
assert.match(app, /async function start\(\)/);
assert.match(app, /await initializeDatabase\(\)/);
assert.match(bootstrap, /v0\.3\.93/);
assert.match(serviceWorker, /v0\.3\.93/);
assert.match(index, /20260806-v0393-post-migration-startup-isolation/);
console.log('v0.3.93 post-migration startup isolation contract PASS');
