// G9R published November data-only bytes: independent source-bound replay.
// Read-only CI. Future append-only releases may follow these immutable first six.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePublicEventManifest,validatePublicEventPayload} from '../assets/js/public-event-master-contract.js';
import {parseVerifiedNovemberOfficialNotice,NOVEMBER_OFFICIAL_NOTICE_URLS} from './g9r-november-official-notice-strict-parser.mjs';
import {moonHtml,prepHtml} from './g9r-november-official-notice-strict-contract.mjs';
import {verifyNovemberDataOnlyRelease} from './g9r-november-data-only-admission-contract.mjs';

const sha=bytes=>createHash('sha256').update(bytes,'utf8').digest('hex');
const payloadText=readFileSync('assets/data/public-event-master.json','utf8');
const manifestText=readFileSync('assets/data/public-event-master-manifest.json','utf8');
const current=JSON.parse(payloadText),manifest=validatePublicEventManifest(JSON.parse(manifestText));
assert.equal(sha(payloadText),manifest.payload_sha256,'Published manifest must bind exact payload bytes');
validatePublicEventPayload(current,{expectedVersion:manifest.master_version});
assert.ok(current.events.length>=6,'November source-proven events must remain published');
const originalVersion='public-event-master-tw-2026-10-14-halloween2026-official-a';
const originalTime='2026-10-14T04:09:09.853Z';
const originalHash='9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c';
const releaseVersion='public-event-master-tw-2026-11-02-november-official-source-a';
const releaseHash='4e96c3319158251c6ee8792b16a5961e765992f462d0efb46de53df03bcfca90';
const firstSix=current.events.slice(0,6);
const verifiedAt=firstSix[4].source?.verified_at;
assert.equal(verifiedAt,'2026-11-02T06:55:00.000Z');
assert.equal(firstSix[5].source?.verified_at,verifiedAt);
const original={...current,master_version:originalVersion,generated_at:originalTime,events:firstSix.slice(0,4)};
const originalText=JSON.stringify(original,null,2)+'\n';
assert.equal(sha(originalText),originalHash,'Original four historical events must be byte-identical');
const released={...current,master_version:releaseVersion,generated_at:verifiedAt,events:firstSix};
const releasedText=JSON.stringify(released,null,2)+'\n';
assert.equal(sha(releasedText),releaseHash,'Published November six-event prefix must remain immutable');
const beforeManifestText=JSON.stringify({...manifest,master_version:originalVersion,
  generated_at:originalTime,payload_sha256:originalHash},null,2)+'\n';
const afterManifestText=JSON.stringify({...manifest,master_version:releaseVersion,
  generated_at:verifiedAt,payload_sha256:releaseHash},null,2)+'\n';
const events=[
  parseVerifiedNovemberOfficialNotice(moonHtml,NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,{verifiedAt}),
  parseVerifiedNovemberOfficialNotice(prepHtml,NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,{verifiedAt}),
];
const result=verifyNovemberDataOnlyRelease({beforePayloadText:originalText,beforeManifestText,
  afterPayloadText:releasedText,afterManifestText,sourceParsedEvents:events});
assert.equal(result.status,'READY_FOR_CONTROLLED_DATA_ONLY_PR');
assert.equal(result.payload_sha256,releaseHash);
assert.equal(result.player_write,false);
assert.equal(result.app_version_bump,false);
console.log('PASS G9R_NOVEMBER_PUBLISHED_TWO_OFFICIAL_SOURCES_APPEND_ONLY_SHA256_0400');
console.log('PASS G9R_NOVEMBER_PUBLISHED_CONDITIONAL_EFFECTS_NO_PLAYER_WRITE');
console.log('HOLD G9R_NOVEMBER_LIVE_HTML_REPLAY_AND_ANDROID_OWNER_UAT');

// CI: network-free official HTML replay contract. Live fetch is explicit --live only.
await import('./g9r-november-live-source-replay-contract.mjs');
