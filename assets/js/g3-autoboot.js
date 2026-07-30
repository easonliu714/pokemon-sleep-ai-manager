import {setupG3Pages} from './g3-planning.js';
let attempts=0;
const timer=setInterval(()=>{attempts+=1;try{setupG3Pages();clearInterval(timer);}catch(e){if(attempts>100){clearInterval(timer);console.error('Phase G3 initialization failed',e);}}},100);
