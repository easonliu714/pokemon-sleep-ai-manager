import fs from 'node:fs';

const OLD_BUILD='20260805-v0382-file-snapshot-public-catalog';
const BUILD='20260805-v0383-catalog-ocr-review-contract';
function patch(path,mutate){
  const before=fs.readFileSync(path,'utf8');
  const after=mutate(before);
  if(after===before){console.log(`unchanged ${path}`);return;}
  fs.writeFileSync(path,after);
  console.log(`patched ${path}`);
}

patch('assets/js/bootstrap.js',text=>{
  let out=text.replaceAll(OLD_BUILD,BUILD)
    .replace("const APP_VERSION = 'v0.3.82';","const APP_VERSION = 'v0.3.83';")
    .replace("const VERSION = '20260805-v0382-file-snapshot-public-catalog';",`const VERSION = '${BUILD}';`);
  if(!out.includes("APP_VERSION = 'v0.3.82' 20260805-v0382-file-snapshot-public-catalog")){
    out=out.replace('const PREVIOUS_RELEASE_COMPATIBILITY_MARKERS = [',`const PREVIOUS_RELEASE_COMPATIBILITY_MARKERS = [\n  "APP_VERSION = 'v0.3.82' 20260805-v0382-file-snapshot-public-catalog",`);
  }
  if(!out.includes("'v0383-catalog-ocr-review-contract.js'")){
    out=out.replace("'v0382-image-byte-snapshot.js','v0382-release-authority.js'","'v0382-image-byte-snapshot.js','v0382-release-authority.js','v0383-catalog-ocr-review-contract.js'");
  }
  return out;
});

patch('service-worker.js',text=>{
  let out=text.replace("const APP_VERSION = 'v0.3.82';","const APP_VERSION = 'v0.3.83';")
    .replace("const APP_BUILD = '20260805-v0382-file-snapshot-public-catalog';",`const APP_BUILD = '${BUILD}';`)
    .replace("const CACHE = 'pokemon-sleep-ai-v0.3.82-v0382-file-snapshot-public-catalog';","const CACHE = 'pokemon-sleep-ai-v0.3.83-v0383-catalog-ocr-review-contract';");
  if(!out.includes("'pokemon-sleep-ai-v0.3.82-v0382-file-snapshot-public-catalog'")){
    out=out.replace('const PREVIOUS_CACHE_COMPATIBILITY_MARKERS = [',"const PREVIOUS_CACHE_COMPATIBILITY_MARKERS = [\n  'pokemon-sleep-ai-v0.3.82-v0382-file-snapshot-public-catalog',");
  }
  if(!out.includes("'./assets/js/v0383-catalog-ocr-review-contract.js'")){
    out=out.replace("'./assets/js/v0382-image-byte-snapshot.js','./assets/js/v0382-release-authority.js'","'./assets/js/v0382-image-byte-snapshot.js','./assets/js/v0382-release-authority.js','./assets/js/v0383-catalog-ocr-review-contract.js'");
  }
  return out;
});

patch('index.html',text=>text.replaceAll(OLD_BUILD,BUILD));

patch('assets/js/admin-auth.js',text=>text.includes("./v0383-catalog-ocr-review-contract.js")?text:text.replace("import './v0382-catalog-and-field-migration.js';","import './v0382-catalog-and-field-migration.js';\nimport './v0383-catalog-ocr-review-contract.js';"));

patch('assets/js/v0382-release-authority.js',text=>{
  let out=text;
  out=out.replace("const registration=await navigator.serviceWorker.register(url,{scope:'../../',updateViaCache:'none'});","const scope=new URL('../../',import.meta.url).pathname;\n    const registration=await navigator.serviceWorker.register(url,{scope,updateViaCache:'none'});");
  out=out.replace('await registration.update();','await registration?.update?.();');
  return out;
});

console.log('v0.3.83 release patch complete');
