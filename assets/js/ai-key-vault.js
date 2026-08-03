const DB_NAME='pokemon-sleep-ai-key-vault';
const DB_VERSION=1;
const KEY_STORE='crypto';
const RECORD_STORE='records';
const DEVICE_KEY_ID='device-aes-gcm-v1';
const POOL_RECORD_ID='project-pool-v1';

const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('indexeddb_request_failed'));});
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(KEY_STORE))db.createObjectStore(KEY_STORE);if(!db.objectStoreNames.contains(RECORD_STORE))db.createObjectStore(RECORD_STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('ai_key_vault_open_failed'));});}
async function withStore(name,mode,callback){const db=await openDb();try{const tx=db.transaction(name,mode);const result=await callback(tx.objectStore(name));await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('ai_key_vault_tx_failed'));tx.onabort=()=>reject(tx.error||new Error('ai_key_vault_tx_aborted'));});return result;}finally{db.close();}}
async function getDeviceKey(){let key=await withStore(KEY_STORE,'readonly',store=>requestResult(store.get(DEVICE_KEY_ID)));if(key)return key;key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await withStore(KEY_STORE,'readwrite',store=>requestResult(store.put(key,DEVICE_KEY_ID)));return key;}
const bytesToBase64=bytes=>btoa(String.fromCharCode(...bytes));
const base64ToBytes=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));

export async function saveEncryptedProjectPool(payload){const key=await getDeviceKey();const iv=crypto.getRandomValues(new Uint8Array(12));const plaintext=new TextEncoder().encode(JSON.stringify(payload));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);const record={schema:'pokemon-sleep-ai-key-vault/1.0',algorithm:'AES-GCM',iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(ciphertext)),saved_at:new Date().toISOString()};await withStore(RECORD_STORE,'readwrite',store=>requestResult(store.put(record,POOL_RECORD_ID)));return {saved:true,saved_at:record.saved_at};}
export async function loadEncryptedProjectPool(){const record=await withStore(RECORD_STORE,'readonly',store=>requestResult(store.get(POOL_RECORD_ID)));if(!record)return null;const key=await getDeviceKey();const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(record.iv)},key,base64ToBytes(record.ciphertext));return JSON.parse(new TextDecoder().decode(plaintext));}
export async function clearEncryptedProjectPool(){await withStore(RECORD_STORE,'readwrite',store=>requestResult(store.delete(POOL_RECORD_ID)));}
export async function hasEncryptedProjectPool(){return Boolean(await withStore(RECORD_STORE,'readonly',store=>requestResult(store.get(POOL_RECORD_ID))));}
export const AI_KEY_VAULT_SCHEMA='pokemon-sleep-ai-key-vault/1.0';
