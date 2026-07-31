import {renderIdentityConfirmationQueue,identityConfirmationStyles} from './identity-confirmation-ui.js';

const container=document.getElementById('identityConfirmationRoot');
let currentQueue={items:[]};
let decideHandler=null;

function ensureStyles(){
  if(document.getElementById('identityConfirmationStyles'))return;
  const style=document.createElement('style');
  style.id='identityConfirmationStyles';
  style.textContent=identityConfirmationStyles;
  document.head.appendChild(style);
}

function render(){
  if(!container)return;
  ensureStyles();
  if(!currentQueue.items.length){
    container.innerHTML='<div class="panel notice">尚無需要確認的身分辨識結果。</div>';
    return;
  }
  renderIdentityConfirmationQueue(container,currentQueue,{
    onDecide:decision=>decideHandler?.(decision),
    onAcceptHighConfidence:incomingRefs=>incomingRefs.forEach(incoming_ref=>{
      const item=currentQueue.items.find(row=>(row.resolution||row).incoming_ref===incoming_ref);
      const dto=item?.resolution||item;
      if(!dto?.selected_pokemon_instance_id)return;
      decideHandler?.({incoming_ref,action:'accept_existing',pokemon_instance_id:dto.selected_pokemon_instance_id,batch:true});
    })
  });
}

export function mountIdentityConfirmationQueue(queue,{onDecide}={}){
  currentQueue=queue&&Array.isArray(queue.items)?queue:{items:[]};
  decideHandler=typeof onDecide==='function'?onDecide:null;
  render();
}

window.PokemonSleepIdentityConfirmation={
  mount:mountIdentityConfirmationQueue,
  clear:()=>mountIdentityConfirmationQueue({items:[]})
};

window.addEventListener('pokemon-sleep:identity-confirmation',event=>{
  mountIdentityConfirmationQueue(event.detail?.queue||{items:[]},{onDecide:decision=>{
    window.dispatchEvent(new CustomEvent('pokemon-sleep:identity-decision',{detail:decision}));
  }});
});

render();
