import {jstDayKey,jstTargetCount,selectDailyQuestions,validateQuestionBank,assessAnswer,eventFromAnswer} from './review-engine.mjs';
import {getReviewEvents,addReviewEvent,getDeviceId,readDailySession,storeDailySession,getReviewSetting,prepareReviewExport,importReviewEvents,acknowledgeReviewBackup,backupIsDue} from './review-store.mjs';

const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grades=[['again','もう一度'],['hard','まだ不安'],['good','理解できた'],['easy','すぐ答えられる']];
export class ReviewFeature {
 constructor(){
  this.bank=[];this.events=[];this.deviceId='';this.ack=null;this.ready=false;this.error='準備中';
  this.day=null;this.ids=[];this.revealed=false;this.choice=null;this.message='';this.saving=false;
 }
 async init(bank){
  this.bank=bank;
  try{validateQuestionBank(bank);await this.reload();this.ready=true;this.error='';}
  catch(e){this.ready=false;this.error=e.message;}
 }
 async reload(){
  this.events=await getReviewEvents();
  this.deviceId=await getDeviceId();
  this.ack=await getReviewSetting('backup_ack_at');
 }
 async prepare(){
  if(!this.ready)return;
  const day=jstDayKey();
  if(this.day===day&&this.ids.length)return;
  const old=await readDailySession(day),known=new Set(this.bank.map(x=>x.id));
  if(old&&old.ids.length)this.ids=old.ids.filter(x=>known.has(x));
  else{
   this.ids=selectDailyQuestions(this.bank,this.events).questions.map(x=>x.id);
   await storeDailySession(day,this.ids);
  }
  this.day=day;this.revealed=false;this.choice=null;
 }
 answered(q){return this.events.some(e=>e.question_id===q.id&&e.question_version===q.version&&jstDayKey(new Date(e.recorded_at_utc))===this.day);}
 current(){return this.ids.map(id=>this.bank.find(q=>q.id===id)).find(q=>q&&!this.answered(q))||null;}
 complete(){return this.ids.filter(id=>{const q=this.bank.find(x=>x.id===id);return q&&this.answered(q)}).length;}
 html(){
  if(!this.ready)return '<section class="card review-panel"><h2>復習を開始できません</h2><p class="draft-alert">'+h(this.error)+'</p><button type="button" id="reviewRetry" class="primary-btn">再試行する</button></section>';
  const q=this.current(),done=this.complete(),target=jstTargetCount();
  let out='<section class="card review-panel"><h2>今日の復習：'+done+' / '+this.ids.length+'問</h2>'+
    '<div class="review-progress"><div style="width:'+(this.ids.length?Math.floor(100*done/this.ids.length):0)+'%"></div></div>'+
    '<p class="small-note">日本時間 '+h(this.day)+'：'+(target===10?'週末10問':'平日5問')+'を目標に出題。現在の問題は原典未確認の練習用で、正式な医学的理解度には算入しません。</p></section>';
  if(!q)out+='<section class="card review-panel"><h2>本日の復習は終了です</h2><p>次回の復習で学習内容を定着させましょう。</p></section>';
  else{
   out+='<section class="card review-panel"><div class="draft-label">原典未確認・練習用</div><h2>'+h(q.prompt)+'</h2>'+
    '<p class="small-note">出典：'+h(q.source_path.split('/').pop())+' ＞ '+h(q.source_section)+'</p>';
   if(q.type==='mcq'){
    out+='<div class="review-options">';
    q.choices.forEach((choice,i)=>{
     out+='<label class="review-option"><input type="radio" name="reviewChoice" value="'+i+'" '+(this.choice===i?'checked':'')+' '+(this.revealed?'disabled':'')+'><span>'+h(choice)+'</span></label>';
    });
    out+='</div>';
   }else out+='<p class="small-note">頭の中で答えを考えてください。自由記述の回答は保存しません。</p>';
   if(!this.revealed)out+='<button id="reviewReveal" type="button" class="primary-btn">'+(q.type==='mcq'?'回答を確認する':'模範回答を見る')+'</button>';
   else{
    const grade=assessAnswer(q,this.choice);
    out+='<div class="review-feedback"><h3>練習用の回答例</h3>';
    if(q.type==='mcq')out+='<p>'+(grade.correct?'練習上は正解':'練習上は不正解')+'：'+h(q.choices[q.correct_index])+'</p><p>'+h(q.explanation||'')+'</p>';
    else out+='<p>'+h(q.model_answer)+'</p>';
    out+='<p class="small-note">この答えは原典未確認です。治療判断には用いないでください。</p><h3>理解度を自己評価</h3><div class="review-rating">';
    grades.forEach(x=>{out+='<button type="button" data-review-rating="'+x[0]+'" '+(this.saving?'disabled':'')+'>'+x[1]+'</button>';});
    out+='</div></div>';
   }
   out+='</section>';
  }
  if(this.message)out+='<p class="review-message" role="status">'+h(this.message)+'</p>';
  out+='<section class="card review-panel"><h2>💾 回答履歴のバックアップ</h2>'+
   '<p class="small-note">回答履歴はこの端末のIndexedDB内のみ。端末変更やブラウザのデータ削除に備えてJSONを保存してください。</p>';
  if(backupIsDue(this.events,this.ack))out+='<p class="review-backup-notice">バックアップ確認が必要です。</p>';
  out+='<div class="review-backup-buttons"><button type="button" id="reviewExport">JSONを書き出す</button>'+
   '<label for="reviewImportFile" class="review-import-label">JSONを読み込む</label><input type="file" accept=".json,application/json" id="reviewImportFile" hidden></div>'+
   '<button type="button" id="reviewBackupAck" class="review-backup-ack">ファイルを保存済みとして記録</button>'+
   '<p class="small-note">7日ごとの案内は「保存済み」の確認日から数えます。アプリからファイルの保存成否は確認できません。</p></section>';
  return out;
 }
 async mount(){
  const root=document.getElementById('reviewFeature');
  if(!root)return;
  try{await this.prepare();}
  catch(e){this.ready=false;this.error=e.message;}
  this.draw();
 }
 draw(){
  const root=document.getElementById('reviewFeature');if(!root)return;
  root.innerHTML=this.html();
  root.querySelector('#reviewRetry')?.addEventListener('click',async()=>{await this.init(this.bank);this.day=null;await this.mount();});
  root.querySelectorAll('[name="reviewChoice"]').forEach(el=>el.addEventListener('change',()=>{this.choice=Number(el.value);}));
  root.querySelector('#reviewReveal')?.addEventListener('click',()=>{
   const q=this.current();
   if(q?.type==='mcq'&&this.choice===null){this.message='選択肢を選んでください。';this.draw();return;}
   this.revealed=true;this.message='';this.draw();
  });
  root.querySelectorAll('[data-review-rating]').forEach(el=>el.addEventListener('click',async()=>{
   if(this.saving)return;
   const q=this.current();if(!q)return;
   this.saving=true;this.message='';
   try{
    const event=eventFromAnswer({question:q,rating:el.dataset.reviewRating,selectedIndex:this.choice,deviceId:this.deviceId});
    await addReviewEvent(event);this.events.push(event);
    this.revealed=false;this.choice=null;
   }catch(e){this.message='保存に失敗しました：'+e.message;}
   finally{this.saving=false;this.draw();}
  }));
  root.querySelector('#reviewExport')?.addEventListener('click',async()=>{
   try{
    const content=await prepareReviewExport(),blob=new Blob([content],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ast-pocket-review-'+jstDayKey()+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.message='JSONの保存を開始しました。実際に保存できたら「保存済み」を押してください。';
   }catch(e){this.message='書き出し失敗：'+e.message;}
   this.draw();
  });
  root.querySelector('#reviewBackupAck')?.addEventListener('click',async()=>{
   if(!this.events.length){this.message='まだ回答履歴がありません。';this.draw();return;}
   if(!confirm('バックアップファイルを安全な場所へ保存できましたか？'))return;
   try{await acknowledgeReviewBackup();this.ack=await getReviewSetting('backup_ack_at');this.message='保存済みとして記録しました。';}
   catch(e){this.message='保存確認を記録できませんでした：'+e.message;}
   this.draw();
  });
  root.querySelector('#reviewImportFile')?.addEventListener('change',async ev=>{
   const file=ev.target.files?.[0];if(!file)return;
   if(!confirm('選択したバックアップの回答履歴を、この端末へ重複なく追加しますか？'))return;
   try{
    const result=await importReviewEvents(await file.text());
    await this.reload();this.day=null;await this.prepare();
    this.message=result.added+'件読み込みました（重複'+result.duplicates+'件）。';
   }catch(e){this.message='読み込み失敗：'+e.message;}
   this.draw();
  });
 }
}
