import {validateObservationPayload} from './ai-observation.js';
import {createSqliteIdentityCandidateAdapter} from './sqlite-identity-candidate-adapter.js';
import {resolveObservationBatch} from './identity-candidate-engine.js';
import {buildConfirmationQueue,buildConfirmedImportPlan} from './identity-confirmation-model.js';
import {
  createIdentityImportWizard,
  selectIdentityImportSource,
  attachValidatedObservation,
  attachIdentityResolutions,
  attachConfirmationQueue,
  attachConfirmedImportPlan
} from './identity-import-wizard.js';

export async function prepareIdentityImport({source,input,db,adapterOptions}={}){
  let state=createIdentityImportWizard();
  state=selectIdentityImportSource(state,source);
  if(state.errors.length)return {state,validation:null,candidates:[],resolutions:[],confirmation_queue:[]};

  const validation=validateObservationPayload(input);
  state=attachValidatedObservation(state,{payload:validation.payload,validation:{...validation,ok:validation.errors.length===0}});
  if(state.errors.length)return {state,validation,candidates:[],resolutions:[],confirmation_queue:[]};

  const adapter=createSqliteIdentityCandidateAdapter(db,adapterOptions);
  const candidates=await adapter.loadCandidates();
  const resolutions=resolveObservationBatch(validation.payload,candidates);
  state=attachIdentityResolutions(state,resolutions);
  if(state.errors.length)return {state,validation,candidates,resolutions,confirmation_queue:[]};

  const confirmation_queue=buildConfirmationQueue(resolutions);
  state=attachConfirmationQueue(state,confirmation_queue);
  return {state,validation,candidates,resolutions,confirmation_queue};
}

export function finalizeIdentityImport(prepared,confirmationQueue){
  let state=attachConfirmationQueue(prepared.state,confirmationQueue);
  if(state.step!=='plan')return {state,plan:null};
  const plan=buildConfirmedImportPlan(confirmationQueue);
  state=attachConfirmedImportPlan(state,plan);
  return {state,plan};
}
