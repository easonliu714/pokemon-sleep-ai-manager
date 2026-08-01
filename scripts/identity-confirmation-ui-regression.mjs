import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {identityConfirmationStyles} from '../assets/js/identity-confirmation-ui.js';

const uiSource=await readFile(new URL('../assets/js/identity-confirmation-ui.js',import.meta.url),'utf8');
const entrySource=await readFile(new URL('../assets/js/identity-confirmation-entry.js',import.meta.url),'utf8');
const bootstrapSource=await readFile(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');

assert.match(identityConfirmationStyles,/max-width:560px/);
assert.match(identityConfirmationStyles,/min-height:44px/);
assert.match(identityConfirmationStyles,/grid-template-columns:1fr/);
assert.match(uiSource,/data-accept-high-confidence/);
assert.match(uiSource,/identity-confirmation__thumbnail/);
assert.match(uiSource,/dto\.evidence/);
assert.match(entrySource,/identityConfirmationRoot/);
assert.match(entrySource,/pokemon-sleep:identity-confirmation/);
assert.match(entrySource,/pokemon-sleep:identity-decision/);
assert.match(bootstrapSource,/identity-confirmation-entry\.js/);
assert.match(bootstrapSource,/v0\.3\.32/);
console.log('PASS TECH.2C mobile confirmation UI and update-center entry contract');
