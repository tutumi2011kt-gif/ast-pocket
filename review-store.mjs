/* Browser-only private learning log. Never upload attempts to GitHub Pages. */
const DB_NAME='astPocketStudyV1';
const DB_VERSION=1;
let dbPromise=null;
function requestResult(request){
 return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Database request failed'))});
}
export function openReviewDB(){
 if(!('indexedDB' in globalThis))return Promise.reject(Error('IndexedDB unavailable: history will not be saved'));
 if(!dbPromise){
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,DB_VERSION);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('events')){
     const events=db.createObjectStore('events',{keyPath:'event_uuid'});
     events.createIndex('by_question','question_id');
     events.createIndex('by_time','recorded_at_utc');
    }
    if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'});
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error('IndexedDB connection failed'));
   req.onblocked=()=>reject(Error('Close other tabs using AST Pocket and reload'));
  }).catch(err=>{dbPromise=null;throw err});
 }
 return dbPromise;
}
export async function getReviewEvents(){
 const db=await openReviewDB();
 return requestResult(db.transaction('events','readonly').objectStore('events').getAll());
}
export async function addReviewEvent(event){
 if(!event||!event.event_uuid||!event.question_id||!Number.isInteger(event.question_version)
   ||!['again','hard','good','easy'].includes(event.rating)
   ||!['practice_only','verified','self_assessment'].includes(event.graded_as)
   ||event.answer_text!==null)throw Error('Invalid review event');
 const db=await openReviewDB();
 return requestResult(db.transaction('events','readwrite').objectStore('events').add(event));
}
export async function getReviewSetting(key){
 const db=await openReviewDB();
 const value=await requestResult(db.transaction('settings','readonly').objectStore('settings').get(key));
 return value?.value??null;
}
export async function setReviewSetting(key,value){
 const db=await openReviewDB();
 return requestResult(db.transaction('settings','readwrite').objectStore('settings').put({key,value}));
}
export async function getDeviceId(){
 let id=await getReviewSetting('device_id');
 if(!id){id=crypto.randomUUID();await setReviewSetting('device_id',id)}
 return id;
}
export async function readDailySession(day){
 const session=await getReviewSetting('session:'+day);
 return session?.day===day&&Array.isArray(session.ids)?session:null;
}
export async function storeDailySession(day,ids){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('Invalid session');
 return setReviewSetting('session:'+day,{day,ids});
}
export async function prepareReviewExport(){
 const [events,deviceId,acknowledged]=await Promise.all([
  getReviewEvents(),getDeviceId(),getReviewSetting('backup_ack_at')
 ]);
 // No patient data, open-ended free text, passwords or auth tokens are exported.
 const payload={format:'ast-pocket-review-backup',schema_version:1,
  exported_at_utc:new Date().toISOString(),origin_device_id:deviceId,
  backup_ack_at:acknowledged,events};
 return JSON.stringify(payload,null,2)+'\n';
}
export function validateImport(text){
 if(typeof text!=='string'||text.length>30_000_000)throw Error('Backup file is too large');
 const data=JSON.parse(text);
 if(data?.format!=='ast-pocket-review-backup'||data?.schema_version!==1||!Array.isArray(data.events))throw Error('Unknown backup format');
 if(data.events.length>100000)throw Error('Too many events');
 const ids=new Set();
 for(const e of data.events){
  if(!e||typeof e.event_uuid!=='string'||e.event_uuid.length>128||
    ids.has(e.event_uuid)||typeof e.question_id!=='string'||e.question_id.length>200||
    !Number.isInteger(e.question_version)||e.question_version<1||
    !['again','hard','good','easy'].includes(e.rating)||
    !['practice_only','verified','self_assessment'].includes(e.graded_as)||
    !['mcq','self'].includes(e.type)||
    e.answer_text!==null||
    typeof e.recorded_at_utc!=='string'||!Number.isFinite(Date.parse(e.recorded_at_utc))||
    typeof e.device_id!=='string'||e.device_id.length>128)throw Error('Invalid event in backup');
  ids.add(e.event_uuid);
 }
 return data;
}
export async function importReviewEvents(text){
 const data=validateImport(text);
 const existing=await getReviewEvents();
 const ids=new Set(existing.map(e=>e.event_uuid));
 const newEvents=data.events.filter(e=>!ids.has(e.event_uuid));
 if(!newEvents.length)return {added:0,duplicates:data.events.length};
 const db=await openReviewDB();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('events','readwrite');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||Error('Import transaction failed'));
  tx.onabort=()=>reject(tx.error||Error('Import was rolled back'));
  const store=tx.objectStore('events');
  for(const e of newEvents)store.add(e);
 });
 return {added:newEvents.length,duplicates:data.events.length-newEvents.length};
}
export async function acknowledgeReviewBackup(at=new Date()){
 return setReviewSetting('backup_ack_at',at.toISOString());
}
export function backupIsDue(events,acknowledged,now=new Date()){
 if(!events.length)return false;
 if(!acknowledged)return true; // First backup should be offered after study events exist.
 const elapsed=now.getTime()-new Date(acknowledged).getTime();
 return !Number.isFinite(elapsed)||elapsed>=7*86400000;
}
