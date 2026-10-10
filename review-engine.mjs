/*
 * AST Pocket review scheduler. Pure JavaScript; safe to test in Node.
 * Clinical confidence is NEVER inferred from practice quiz accuracy.
 */
export const REVIEW_SCHEMA_VERSION=1;
const DAY_MS=86400000;
const INTERVALS=[1,3,7,14,30];
function partsAt(date){
 const entries=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'
 }).formatToParts(date);
 return Object.fromEntries(entries.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
}
export function jstDayKey(date=new Date()){
 const p=partsAt(date);
 return [p.year,p.month,p.day].join('-');
}
export function jstTargetCount(date=new Date()){
 return ['Sat','Sun'].includes(partsAt(date).weekday)?10:5;
}
function nextDayKey(key,days){
 const [year,month,day]=key.split('-').map(Number);
 return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
}
export function getQuestionProgress(question,events=[],today=jstDayKey()){
 const history=events.filter(e=>e.question_id===question.id&&e.question_version===question.version
  &&['again','hard','good','easy'].includes(e.rating))
  .sort((a,b)=>a.recorded_at_utc.localeCompare(b.recorded_at_utc)||a.event_uuid.localeCompare(b.event_uuid));
 let streak=0,step=0,due=today,lastRating=null,lastDay=null;
 for(const e of history){
  const day=jstDayKey(new Date(e.recorded_at_utc));
  if(e.rating==='again'){step=0;streak=0;due=nextDayKey(day,1);}
  if(e.rating==='hard'){step=Math.max(0,step-1);streak=0;due=nextDayKey(day,1);}
  if(e.rating==='good'){step=Math.min(INTERVALS.length-1,step+1);streak++;due=nextDayKey(day,INTERVALS[step]);}
  if(e.rating==='easy'){step=Math.min(INTERVALS.length-1,step+2);streak++;due=nextDayKey(day,INTERVALS[step]);}
  lastDay=day;lastRating=e.rating;
 }
 const formal=question.status==='verified'&&Boolean(question.reviewed_at)&&Boolean(question.evidence_url);
 return {
  attempts:history.length,streak,step,next_due_jst:history.length?due:today,last_rating:lastRating,
  weak:lastRating==='again'||lastRating==='hard',
  last_day_jst:lastDay,
  // Practice outcomes may schedule repetition but cannot establish clinical mastery.
  proficiency:formal?(streak>=4?'定着':streak>=2?'理解確認済み':'学習済み'):'練習中・原典未確認',
  clinical_verified:formal
 };
}
function rotationScore(id,day){
 let h=2166136261;
 for(const c of day+'|'+id){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}
 return h;
}
export function selectDailyQuestions(questions,events=[],date=new Date()){
 const today=jstDayKey(date),target=jstTargetCount(date);
 const available=questions.filter(q=>q&&q.id&&q.version&&q.status!=='retired'&&
  (q.type==='mcq'?Array.isArray(q.choices)&&q.choices.length>=2
   :q.type==='self'&&Boolean(q.model_answer)));
 const entries=available.map(q=>({q,progress:getQuestionProgress(q,events,today),rotation:rotationScore(q.id,today)}))
 .sort((a,b)=>a.rotation-b.rotation||a.q.id.localeCompare(b.q.id));
 // Avoid re-asking the same question on the same local calendar day.
 const unanswered=entries.filter(x=>x.progress.last_day_jst!==today);
 const selected=[],added=new Set();
 const take=(predicate,count)=>{
  for(const item of unanswered){
   if(count===0)break;
   if(!added.has(item.q.id)&&predicate(item)){
    selected.push(item);added.add(item.q.id);count--;
   }
  }
 };
 if(target===10){
  take(x=>x.progress.weak,6);
  take(x=>x.q.integrative===true,4);
 }else{
  take(x=>x.progress.attempts>0&&x.progress.next_due_jst<=today,2);
  take(x=>x.progress.weak,2);
  take(x=>x.progress.attempts===0,1);
 }
 // Fill from due, unseen and finally not-yet-due as needed; no forced repeats today.
 take(x=>x.progress.next_due_jst<=today,target-selected.length);
 take(x=>x.progress.attempts===0,target-selected.length);
 take(()=>true,target-selected.length);
 return {
  day:today,target,
  questions:selected.slice(0,target).map(x=>x.q),
  available:available.length,
  remaining:unanswered.length,
  practice_only:selected.some(x=>!x.progress.clinical_verified),
  insufficient:unanswered.length<target
 };
}
export function validateQuestionBank(questions){
 if(!Array.isArray(questions))throw Error('Review bank must be an array');
 const ids=new Set();
 for(const q of questions){
  if(!q.id||!Number.isInteger(q.version)||q.version<1||ids.has(q.id))throw Error('Invalid/duplicate question ID: '+q.id);
  ids.add(q.id);
  if(!['mcq','self'].includes(q.type)||!['draft','review_required','verified'].includes(q.status))throw Error('Invalid question kind/status: '+q.id);
  if(!q.prompt||!q.source_path||!q.source_section||!Array.isArray(q.tags))throw Error('Question is missing provenance: '+q.id);
  if(q.type==='mcq'&&(!Array.isArray(q.choices)||q.choices.length<2||!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>=q.choices.length))throw Error('Bad MCQ choices: '+q.id);
  if(q.type==='self'&&!q.model_answer)throw Error('Missing model answer: '+q.id);
  if(q.status==='verified'&&(!q.reviewed_at||!/^https:\/\//.test(q.evidence_url||'')))throw Error('Verified question requires reviewed_at and external source: '+q.id);
 }
 return true;
}
export function assessAnswer(question,selectedIndex=null){
 if(question.type==='mcq')return {correct:selectedIndex===question.correct_index,reference_index:question.correct_index,graded_as:question.status==='verified'?'verified':'practice_only'};
 return {correct:null,reference_index:null,graded_as:'self_assessment'};
}
export function eventFromAnswer({question,rating,selectedIndex=null,deviceId,now=new Date()}){
 if(!question?.id||!Number.isInteger(question.version))throw Error('Question required');
 if(!['again','hard','good','easy'].includes(rating))throw Error('Invalid rating');
 if(!deviceId)throw Error('Device ID required');
 const graded=assessAnswer(question,selectedIndex);
 if(question.type==='mcq'&&(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=question.choices.length))throw Error('Invalid choice');
 return {
  event_uuid:crypto.randomUUID(),
  device_id:deviceId,
  recorded_at_utc:now.toISOString(),
  question_id:question.id,
  question_version:question.version,
  type:question.type,
  selected_index:question.type==='mcq'?selectedIndex:null,
  answer_text:null, // Never record identifiable free-text / patient details
  rating,
  correct:graded.correct,
  graded_as:graded.graded_as,
  clinical_verified:graded.graded_as==='verified'
 };
}
