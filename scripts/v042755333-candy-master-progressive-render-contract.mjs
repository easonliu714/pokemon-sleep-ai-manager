import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const candy=read('assets/js/candy-inventory-ui.js');
const appVersion=authority.match(/app_version:\s*'([^']+)'/)?.[1]||'';

// G479-R exact .24 -> .23 successor; Candy batch-24 and progressive assertions stay frozen.

// G479-R2 exact .25 weekly pot CSS-only successor; preserve frozen historical checks.
// G479 .27 debug-history scope successor; Candy progressive behavior remains frozen.
// G479 .28 exact Public Catalog successor: retain .27 and original Candy .3 lineage.
if(appVersion==='v0.4.27.55.3.3.32'){
  // G479 .32 exact successor retains .31 and frozen lineage.
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.31'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553331-g479-passive-esm-provenance'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.31-v0427553331-g479-passive-esm-provenance'"));

  assert.ok(authority.includes("app_build: '20261024-v0427553332-g479-exact-resource-provenance'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.32-v0427553332-g479-exact-resource-provenance'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.30'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.30-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive lineage');
}
else if(appVersion==='v0.4.27.55.3.3.31'){
  assert.ok(authority.includes("app_build: '20261024-v0427553331-g479-passive-esm-provenance'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.31-v0427553331-g479-passive-esm-provenance'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.30'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.30-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive lineage');
}
else if(appVersion==='v0.4.27.55.3.3.30'){
  assert.ok(authority.includes("app_build: '20261024-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.30-v0427553330-g62-player-write-singleflight'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.27'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');

  // .29 inherits exact .28 and all frozen assertions above.
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.28'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.28-v0427553328-g479-public-catalog-postsync-readback'"));
}
else if(appVersion==='v0.4.27.55.3.3.29'){
  assert.ok(authority.includes("app_build: '20261024-v0427553329-g62-persistence-uncertain-hold'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.29-v0427553329-g62-persistence-uncertain-hold'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.27'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');

  // .29 inherits exact .28 and all frozen assertions above.
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.28'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.28-v0427553328-g479-public-catalog-postsync-readback'"));
}else if(appVersion==='v0.4.27.55.3.3.28'){
  assert.ok(authority.includes("app_build: '20261024-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.28-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.27'"));
  assert.ok(authority.includes("// app_build: '20261024-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.27'){
  assert.ok(authority.includes("app_build: '20261024-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.26'"));
  assert.ok(authority.includes("// app_build: '20261023-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.26-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.26'){
  assert.ok(authority.includes("app_build: '20261023-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.26-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.25'"));
  assert.ok(authority.includes("// app_build: '20261023-v0427553325-weekly-pot-capacity-containment'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.25-v0427553325-weekly-pot-capacity-containment'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.25'){
  assert.ok(authority.includes("app_build: '20261023-v0427553325-weekly-pot-capacity-containment'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.25-v0427553325-weekly-pot-capacity-containment'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.24'"));
  assert.ok(authority.includes("// app_build: '20261017-v0427553324-mobile-warroom-knowledge-containment'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.24'){
  assert.ok(authority.includes("app_build: '20261017-v0427553324-mobile-warroom-knowledge-containment'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.23'"));
  assert.ok(authority.includes("// app_build: '20261017-v0427553323-g479-startup-stage-ownership'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.23-v0427553323-g479-startup-stage-ownership'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.23'){
  assert.ok(authority.includes("app_build: '20261017-v0427553323-g479-startup-stage-ownership'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.23-v0427553323-g479-startup-stage-ownership'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.21'"));
  assert.ok(authority.includes("// app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen progressive Candy lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.22'){
  assert.ok(authority.includes("app_build: '20261012-v0427553322-g9-official-event-auto-refresh'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.22-v0427553322-g9-official-event-auto-refresh'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.21'"));
  assert.ok(authority.includes("// app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen progressive Candy lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.21'){
  assert.ok(authority.includes("app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.20'"),'exact previous .20 release marker');
  assert.ok(authority.includes("// app_build: '20261011-v0427553320-unlock-planner-inventory-parity'"),'exact previous .20 build marker');
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.20-v0427553320-unlock-planner-inventory-parity'"),'exact previous .20 cache marker');
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen progressive Candy lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.20'){
  assert.ok(authority.includes("app_build: '20261011-v0427553320-unlock-planner-inventory-parity'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.20-v0427553320-unlock-planner-inventory-parity'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.19'"),'exact .19 predecessor version marker');
  assert.ok(authority.includes("// app_build: '20261005-v0427553319-g62-recipe-attempt-feedback'"),'exact .19 predecessor build marker');
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.19-v0427553319-g62-recipe-attempt-feedback'"),'exact .19 predecessor cache marker');
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'frozen Candy progressive rendering lineage marker');
}else if(appVersion==='v0.4.27.55.3.3.19'){
  assert.ok(authority.includes("app_build: '20261005-v0427553319-g62-recipe-attempt-feedback'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.19-v0427553319-g62-recipe-attempt-feedback'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.18'"),'exact .55.3.3.18 predecessor bridge must remain');
  assert.ok(authority.includes("// app_build: '20261004-v0427553318-g52-recipe-state-import-hardening'"),'exact .55.3.3.18 predecessor build must remain');
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.18-v0427553318-g52-recipe-state-import-hardening'"),'exact .55.3.3.18 predecessor cache must remain');
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.18'){
  assert.ok(authority.includes("app_build: '20261004-v0427553318-g52-recipe-state-import-hardening'"));
  assert.ok(authority.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.18-v0427553318-g52-recipe-state-import-hardening'"));
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.17'"),'exact .55.3.3.17 predecessor bridge must remain');
  assert.ok(authority.includes("// app_build: '20261002-v0427553317-weekly-berry-evidence-resolution'"),'exact .55.3.3.17 predecessor build must remain');
  assert.ok(authority.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.17-v0427553317-weekly-berry-evidence-resolution'"),'exact .55.3.3.17 predecessor cache must remain');
  assert.ok(authority.includes("// app_version: 'v0.4.27.55.3.3.3'"),'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.17'){
  assert.match(authority,/app_build:\s*'20261002-v0427553317-weekly-berry-evidence-resolution'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.17-v0427553317-weekly-berry-evidence-resolution'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.16'/,'exact .55.3.3.16 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_build: '20261001-v0427553316-personal-recipe-retirement-hotfix'/,'exact .55.3.3.16 predecessor build must remain');
  assert.match(authority,/\/\/ cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.16-v0427553316-personal-recipe-retirement-hotfix'/,'exact .55.3.3.16 predecessor cache must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.16'){
  assert.match(authority,/app_build:\s*'20261001-v0427553316-personal-recipe-retirement-hotfix'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.16-v0427553316-personal-recipe-retirement-hotfix'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.15'/,'exact .55.3.3.15 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_build: '20260930-v0427553315-canonical-recipe-state-authority'/,'exact .55.3.3.15 predecessor build must remain');
  assert.match(authority,/\/\/ cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.15-v0427553315-canonical-recipe-state-authority'/,'exact .55.3.3.15 predecessor cache must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.15'){
  assert.match(authority,/app_build:\s*'20260930-v0427553315-canonical-recipe-state-authority'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.15-v0427553315-canonical-recipe-state-authority'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.14'/,'exact .55.3.3.14 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_build: '20260927-v0427553314-g51-personal-recipe-real-device-closure'/,'exact .55.3.3.14 predecessor build must remain');
  assert.match(authority,/\/\/ cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.14-v0427553314-g51-personal-recipe-real-device-closure'/,'exact .55.3.3.14 predecessor cache must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.14'){
  assert.match(authority,/app_build:\s*'20260927-v0427553314-g51-personal-recipe-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.14-v0427553314-g51-personal-recipe-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.13'/,'exact .55.3.3.13 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_build: '20260926-v0427553313-g14-derived-state-authority'/,'exact .55.3.3.13 predecessor build must remain');
  assert.match(authority,/\/\/ cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.13-v0427553313-g14-derived-state-authority'/,'exact .55.3.3.13 predecessor cache must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.13'){
  assert.match(authority,/app_build:\s*'20260926-v0427553313-g14-derived-state-authority'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.13-v0427553313-g14-derived-state-authority'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.12'/,'exact .55.3.3.12 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.12'){
  assert.match(authority,/app_build:\s*'20260920-v0427553312-weekly-review-navigation-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.12-v0427553312-weekly-review-navigation-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.11'/,'exact .55.3.3.11 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.11'){
  assert.match(authority,/app_build:\s*'20260918-v0427553311-ucimg-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.11-v0427553311-ucimg-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.10'/,'exact .55.3.3.10 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 Candy predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.10'){
  assert.match(authority,/app_build:\s*'20260917-v0427553310-real-device-followup'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.10-v0427553310-real-device-followup'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.9'/,'exact .55.3.3.9 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.9'){
  assert.match(authority,/app_build:\s*'20260914-v042755339-duration-berry-visual-authority'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.9-v042755339-duration-berry-visual-authority'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.8'/,'exact .55.3.3.8 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.7'/,'exact .55.3.3.7 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.6'/,'exact .55.3.3.6 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.8'){
  assert.match(authority,/app_build:\s*'20260913-v042755338-g121-authority-parity-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.8-v042755338-g121-authority-parity-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.7'/,'exact .55.3.3.7 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.6'/,'exact .55.3.3.6 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.7'){
  assert.match(authority,/app_build:\s*'20260911-v042755337-g121d-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.7-v042755337-g121d-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.6'/,'exact .55.3.3.6 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.6'){
  assert.match(authority,/app_build:\s*'20260910-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.6-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.5'){
  assert.match(authority,/app_build:\s*'20260908-v042755335-g121a-authority-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.5-v042755335-g121a-authority-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.4'){
  assert.match(authority,/app_build:\s*'20260908-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.4-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3.3');
  assert.match(authority,/app_build:\s*'20260907-v042755333-candy-master-progressive-render'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.3-v042755333-candy-master-progressive-render'/);
}
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');

assert.match(candy,/const CANDY_MASTER_BATCH_SIZE=24/,'Candy Master must use bounded row batches');
assert.match(candy,/candyMasterProgressOverlayV042755333/,'visible Candy Master progress overlay must exist');
assert.match(candy,/role','dialog'/);
assert.match(candy,/aria-modal','true'/);
assert.match(candy,/糖果資料載入中/);
assert.match(candy,/candyMasterProgressBarV042755333/);
assert.match(candy,/取消載入/);
assert.match(candy,/yieldToPaint/,'progressive renderer must yield to browser paint/input');
assert.match(candy,/requestAnimationFrame/,'progressive renderer must permit a real paint between chunks');
assert.match(candy,/for\(let start=0;start<total;start\+=CANDY_MASTER_BATCH_SIZE\)/,'rows must be materialized in bounded chunks');
assert.match(candy,/tbody\.insertAdjacentHTML\('beforeend',html\)/,'each chunk must append incrementally instead of replacing the full table');
assert.match(candy,/updateCandyMasterProgress\(end,total/,'visible progress must advance after each row chunk');
assert.match(candy,/pageProgress\('loading',`資料百科：糖果 Master \$\{end\}\/\$\{total\}/,'page hydration progress must expose completed/total');
assert.match(candy,/tableEl\.dataset\.candyRevision===String\(cache\.revision\)/,'same cache revision must reuse materialized Candy DOM');
assert.match(candy,/candy_master_materialization_completed/,'completion timing must be observable');
assert.match(candy,/cancelCandyMasterMaterialization\('details-collapsed'\)/,'collapsing must cancel an in-flight materialization');
assert.match(candy,/if\(content\)content\.dataset\.materialized='false'/,'data invalidation must mark the Candy table stale');
assert.doesNotMatch(
  candy.slice(candy.indexOf('export async function materializeCandyMaster'),candy.indexOf('function renderKnowledge')),
  /table\(document\.getElementById\('candyMasterTable'\),cache\.masterRows/,
  'Candy Master must not regress to the synchronous whole-table helper'
);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V042755333_CANDY_MASTER_PROGRESSIVE_RENDER',
  status:'PASS',
  version:appVersion,
  batch_size:24,
  visible_progress:true,
  cancellable:true,
  main_thread_yield:true,
  same_revision_reuse:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));

if(['v0.4.27.55.3.3.4','v0.4.27.55.3.3.5','v0.4.27.55.3.3.6','v0.4.27.55.3.3.7','v0.4.27.55.3.3.8','v0.4.27.55.3.3.9','v0.4.27.55.3.3.10','v0.4.27.55.3.3.11','v0.4.27.55.3.3.12','v0.4.27.55.3.3.13','v0.4.27.55.3.3.14'].includes(appVersion))await import('./v042755334-page-status-visibility-watchdog-contract.mjs');
