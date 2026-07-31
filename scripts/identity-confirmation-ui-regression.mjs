import assert from 'node:assert/strict';
import {identityConfirmationStyles} from '../assets/js/identity-confirmation-ui.js';

assert.match(identityConfirmationStyles,/max-width:560px/);
assert.match(identityConfirmationStyles,/min-height:44px/);
assert.match(identityConfirmationStyles,/grid-template-columns:1fr/);
console.log('PASS TECH.2C mobile confirmation UI contract');
