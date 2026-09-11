import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ensureG121DWarroomRecommendationSlot,
  G121D_WARROOM_RECOMMENDATION_SLOT_ID,
} from '../assets/js/g121d-warroom-recommendation-slot.js';

function element(tagName){
  return {
    tagName:String(tagName).toUpperCase(),
    id:'',
    dataset:{},
    className:'',
    parentElement:null,
    children:[],
    innerHTML:'',
    appendChild(child){
      child.parentElement=this;
      this.children.push(child);
      return child;
    },
  };
}

const panel=element('section');
panel.id='warroomPanel';
const planningSentinel=element('div');
planningSentinel.id='g3PlanningSentinel';
planningSentinel.innerHTML='<p>G3 planning survives</p>';
const g7Sentinel=element('div');
g7Sentinel.id='g7WarroomSentinel';
g7Sentinel.innerHTML='<p>G7 status survives</p>';
panel.appendChild(planningSentinel);
panel.appendChild(g7Sentinel);

const byId=new Map([
  [panel.id,panel],
  [planningSentinel.id,planningSentinel],
  [g7Sentinel.id,g7Sentinel],
]);
const doc={
  getElementById(id){
    if(id===G121D_WARROOM_RECOMMENDATION_SLOT_ID){
      return panel.children.find(child=>child.id===id)||null;
    }
    return byId.get(id)||null;
  },
  createElement(tagName){return element(tagName);},
};

const slot=ensureG121DWarroomRecommendationSlot(panel,doc);
assert.equal(slot.id,G121D_WARROOM_RECOMMENDATION_SLOT_ID);
assert.equal(slot.parentElement,panel);
assert.equal(slot.dataset.g121dOwner,'evolution-recommendation');
assert.equal(panel.children.length,3,'slot creation must append without replacing existing War Room children');
assert.equal(panel.children[0],planningSentinel);
assert.equal(panel.children[1],g7Sentinel);

// Model the delayed recommendation-ready render: only the owned child slot may change.
slot.innerHTML='<section class="g121d-evolution-card">delayed recommendation</section>';
assert.equal(panel.children.length,3,'delayed recommendation render must preserve sibling War Room sections');
assert.equal(panel.children[0].id,'g3PlanningSentinel');
assert.equal(panel.children[0].innerHTML,'<p>G3 planning survives</p>');
assert.equal(panel.children[1].id,'g7WarroomSentinel');
assert.equal(panel.children[1].innerHTML,'<p>G7 status survives</p>');
assert.match(slot.innerHTML,/delayed recommendation/);

const reused=ensureG121DWarroomRecommendationSlot(panel,doc);
assert.equal(reused,slot,'revisit must reuse the owned slot rather than append or replace the shared panel');
assert.equal(panel.children.length,3);

const bindingSource=fs.readFileSync(new URL('../assets/js/g121d-warroom-recommendation-binding.js',import.meta.url),'utf8');
assert.match(bindingSource,/ensureG121DWarroomRecommendationSlot\(panel,document\)/,'binding must resolve the dedicated slot through the governed helper');
assert.doesNotMatch(bindingSource,/panel\.innerHTML\s*=/,'G12.1D binding must never clear or replace #warroomPanel');
assert.match(bindingSource,/mountG121DWarroomRecommendationUI\(\{container,envelopes:state\.envelopes\}\)/,'recommendation UI must receive only the dedicated slot container');

console.log(JSON.stringify({
  gate:'G12.1D_WARROOM_SLOT_OWNERSHIP_CONTRACT',
  status:'PASS',
  dedicated_slot:true,
  delayed_render_sentinel_survival:true,
  revisit_reuses_slot:true,
  shared_panel_replace_forbidden:true,
},null,2));
