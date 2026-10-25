/**
 * Dedicated API-free AmpC study reader and 10-question self-assessment.
 * Learning-only, never clinical guidance or a medically verified result.
 */
import {getChapters} from './notebook-templates.mjs';
export const AMP_C_NOTE='content/notes/ampc-study-2026.md';
export const AMP_C_QUIZ='content/review/ampc-focused.json';
export const AMP_C_PROGRESS_KEY='astPocketAmpcStudyV1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseAmpcNote(markdown){
 if(typeof markdown!=='string'||markdown.length<2500||markdown.length>25000)throw Error('Invalid AmpC learning note');
 if(/(?:患者名|患者ID|院内限定|https:\/\/chatgpt\.com\/c\/)/i.test(markdown))throw Error('Private material detected');
 const lines=markdown.replace(/\r\n/g,'\n').split('\n'),starts=[];
 lines.forEach((line,i)=>{const m=line.match(/^## ([1-8])\. (.+)$/);if(m)starts.push({i,n:Number(m[1]),title:m[2]})});
 const expected=getChapters('cross');if(starts.length!==8)throw Error('AmpC note requires 8 chapters');
 return expected.map((ch,i)=>{
  if(starts[i].n!==i+1||starts[i].title!==ch.title)throw Error('Incorrect AmpC chapter title');
  return {...ch,body:lines.slice(starts[i].i+1,starts[i+1]?.i??lines.length).join('\n').trim()};
 });
}
export function validateAmpcQuiz(q){
 if(!Array.isArray(q)||q.length!==10)throw Error('AmpC focus quiz requires 10 questions');
 const ids=new Set();
 for(const x of q){
  if(!/^ampc-2026-[a-z0-9_]+$/.test(x.id)||ids.has(x.id)||x.version!==1||x.status!=='draft'||x.medical_review!=='pending')throw Error('Invalid AmpC question ID/status');
  ids.add(x.id);
  if(x.type!=='mcq'||!Array.isArray(x.choices)||x.choices.length!==4||!Number.isInteger(x.correct_index)||x.correct_index<0||x.correct_index>3)throw Error('Invalid AmpC answer options');
  if(x.source_path!==AMP_C_NOTE||!x.source_section||!x.reference_section||x.reference_url!=='https://www.idsociety.org/practice-guideline/amr-guidance/')throw Error('Incorrect provenance');
  if(typeof x.prompt!=='string'||!x.explanation||x.choices.some(c=>typeof c!=='string'))throw Error('Invalid AmpC question text');
 }
 return true;
}
const inline=s=>{
 // Only the single explicitly authorized guideline URL is linkified.
 let v=esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
 const url='https://www.idsociety.org/practice-guideline/amr-guidance/';
 return v.replace(/\[([^\]\n]+)\]\(https:\/\/www\.idsociety\.org\/practice-guideline\/amr-guidance\/\)/g,
   '<a href="'+url+'" target="_blank" rel="noopener noreferrer">$1</a>');
};
function linesHtml(markdown){
 const out=[];let list=null;const close=()=>{if(list){out.push('</'+list+'>');list=null}};
 const lines=markdown.split('\n');
 for(let i=0;i<lines.length;i++){
  const raw=lines[i].trim();
  if(!raw){close();continue}
  if(raw.startsWith('|')&&lines[i+1]?.trim().startsWith('| ---')){
   close();
   const header=raw.slice(1,-1).split('|');
   out.push('<div class="ampc-table-wrap"><table><thead><tr>'+header.map(c=>'<th>'+inline(c.trim())+'</th>').join('')+'</tr></thead><tbody>');
   i++;
   while(lines[i+1]?.trim().startsWith('|')){
    const cells=lines[++i].trim().slice(1,-1).split('|');
    out.push('<tr>'+cells.map(c=>'<td>'+inline(c.trim())+'</td>').join('')+'</tr>');
   }
   out.push('</tbody></table></div>');continue;
  }
  const bul=raw.match(/^[-*] (.+)$/);
  const ord=raw.match(/^\d+\. (.+)$/);
  if(bul||ord){
   const tag=bul?'ul':'ol';
   if(list!==tag){close();list=tag;out.push('<'+tag+'>')}
   out.push('<li>'+inline((bul||ord)[1])+'</li>');continue;
  }
  close();
  if(raw.startsWith('> '))out.push('<blockquote>'+inline(raw.slice(2))+'</blockquote>');
  else out.push('<p>'+inline(raw)+'</p>');
 }
 close();return out.join('');
}
const simple=body=>{
 const candidates=body.split('\n').map(x=>x.trim()).filter(x=>(x.startsWith('- ')||x.startsWith('* ')));
 return candidates.slice(0,2).join('\n')||body.split('\n').filter(Boolean).slice(0,2).join('\n');
};
export function rankAmpcQuestions(questions,progress={}){
 validateAmpcQuiz(questions);
 return [...questions].sort((a,b)=>{
  const score=x=>progress[x.id]?.rating==='again'?0:progress[x.id]?.rating==='hard'?1:
   progress[x.id]?.rating==='good'?3:progress[x.id]?.rating==='easy'?4:2;
  return score(a)-score(b)||a.id.localeCompare(b.id);
 }).map(x=>x.id);
}
export function renderAmpcStudy({mode='study',chapters=[],questions=[],tab='notes',index=0,order=[],
 choice=null,revealed=false,progress={},modeHtml=''}={}){
 let html='<main class="screen ampc-screen">'+modeHtml+
  '<header class="ampc-heading"><div class="eyebrow">📘 AmpCを復習する</div><h1>AmpC βラクタマーゼ</h1>'+
  (mode==='study'?'<p>ECKH → CTRXがSでも注意 → CFPM → 必要時MEPM</p>':'')+'</header>';
 if(mode!=='study')return html+
  '<section class="card ampc-alert"><strong>臨床モードでは学習草案を表示しません</strong><p>医学的確認待ちの情報は学習モードで確認してください。</p>'+
  '<button class="primary-btn" data-mode="study">学習モードに切り替える</button></section></main>';
 html+='<section class="card ampc-alert"><strong>⚠️ 学習用・医学的最終承認待ち</strong><p>2026年IDSAを参照した一般的な学習草案です。個別患者の診療判断・国内適応は別途確認してください。</p></section>';
 if(chapters.length!==8||questions.length!==10)return html+'<section class="card empty">学習ノートを読み込めませんでした。</section></main>';
 html+='<div class="ampc-tabs"><button data-ampc-tab="notes" class="'+(tab==='notes'?'active':'')+'">📖 教科書8章</button>'+
  '<button data-ampc-tab="quiz" class="'+(tab==='quiz'?'active':'')+'">✍️ AmpC集中復習10問</button></div>';
 if(tab==='notes'){
  html+='<section class="card ampc-content"><h2>8章で理解する</h2><p class="small-note">各章を開いて学べます。特に第4章のCFPM・MEPM・CMZの比較を復習してください。</p>';
  for(const ch of chapters){
   html+='<details class="ampc-chapter" '+(ch.index===0?'open':'')+'><summary>'+(ch.index+1)+'. '+esc(ch.title)+'</summary>'+
    '<div>'+linesHtml(ch.body)+'</div></details>';
  }
  html+='</section>';
 }else{
  const ids=order.length?order:questions.map(q=>q.id);
  const q=questions.find(x=>x.id===ids[index]);
  const count=Object.keys(progress).filter(id=>questions.some(q=>q.id===id)).length;
  html+='<section class="card ampc-content"><h2>AmpC 集中復習</h2>'+
   '<p class="small-note">未承認の練習問題。回答はこの端末内に保存し、次回は苦手問題を優先します。</p>'+
   '<p class="small-note">自己評価を記録した問題：'+count+' / 10</p>';
  if(!q)html+='<h3>今回の10問が終了しました</h3><p>もう一度復習して、苦手な問題を確認できます。</p>'+
   '<button class="primary-btn" data-ampc-repeat>10問をもう一度</button>';
  else{
   html+='<div class="ampc-progress">問題 '+(index+1)+' / '+ids.length+'</div>'+
    '<h3>'+esc(q.prompt)+'</h3>'+
    '<div class="ampc-options">'+q.choices.map((x,i)=>'<label><input type="radio" name="ampcChoice" value="'+i+'" '+(choice===i?'checked':'')+' '+(revealed?'disabled':'')+'/>'+
     '<span>'+esc(x)+'</span></label>').join('')+'</div>';
   if(!revealed)html+='<button class="primary-btn" data-ampc-reveal '+(choice===null?'disabled':'')+'>答えと解説を見る</button>';
   else html+='<div class="ampc-answer"><strong>'+(choice===q.correct_index?'練習上は正解':'練習上は不正解')+'</strong>'+
    '<p>正答：'+esc(q.choices[q.correct_index])+'</p><p>'+esc(q.explanation)+'</p>'+
    '<p class="small-note">根拠：IDSA AMR 2026 '+esc(q.reference_section)+'（医学的最終レビューは別途）</p>'+
    '<p><a href="'+q.reference_url+'" target="_blank" rel="noopener noreferrer">原典を開く</a></p>'+
    '<h4>自己評価して次へ</h4><div class="ampc-ratings">'+[['again','もう一度'],['hard','まだ不安'],['good','理解できた'],['easy','すぐ答えられる']].map(([val,title])=>
      '<button type="button" data-ampc-rating="'+val+'">'+title+'</button>').join('')+'</div></div>';
  }
  html+='</section>';
 }
 return html+'</main>';
}
