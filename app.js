import {ReviewFeature} from './review-feature.mjs';
import {MSSA_PATH,renderMssaNotebook,bindMssaReader,stopMssaReader} from './mssa-notebook.mjs';
import {renderTemplateNotebook,bindTemplateReader,stopTemplateReader} from './notebook-templates.mjs';
import {REVIEW_TEXTBOOKS,parseReviewTextbook,renderReviewTextbook} from './review-textbooks.mjs';
import {AMP_C_NOTE,AMP_C_QUIZ,parseAmpcNote,validateAmpcQuiz,rankAmpcQuestions,renderAmpcStudy} from './ampc-study.mjs';
import {ANTIFUNGAL_SPECTRUM_PATH,validateSpectrum,renderSpectrum} from './antifungal-spectrum.mjs';
import {embeddedBuild,fetchPublishedBuild,compareBuilds,freshLaunchUrl} from './app-update.mjs';
const reviewFeature=new ReviewFeature();
const state={mode:'clinical',noteOrigin:'search',view:'home',query:'',filter:'all',notes:[],weekly:[],organisms:[],antibiotics:[],review:[],selectedNote:null,selectedWeeklyPath:null,organized:null,libraryCategory:'all',integrations:null,selectedTopicId:null,selectedTextbookId:null,textbooks:{},textbookErrors:{},evidenceLedger:null,ampcChapters:[],ampcQuestions:[],ampcProgress:{},ampcTab:'notes',ampcOrder:[],ampcIndex:0,ampcChoice:null,ampcRevealed:false,spectrumData:null,spectrumOrganism:'all',spectrumCell:null};
const $=s=>document.querySelector(s);
const releaseCheck={message:'アプリ起動時にも最新版を確認します。',lastCheckAt:0,busy:false};
let releaseCheckPromise=null;
function updateCard(){
 return '<section class="card app-release-card">'+
  '<div class="app-release-heading"><strong>🔄 アプリを最新版に更新</strong>'+
  '<button type="button" id="updateAppBtn" class="app-update-button" '+(releaseCheck.busy?'disabled':'')+'>最新版に更新</button></div>'+
  '<p id="appUpdateStatus" aria-live="polite">'+esc(releaseCheck.message)+'</p>'+
  '<p class="small-note">ホーム画面に追加していても更新できます。学習中の内容は自動で再読み込みしません。</p></section>';
}
function showReleaseStatus(){
 const status=$('#appUpdateStatus');
 if(status)status.textContent=releaseCheck.message;
 const button=$('#updateAppBtn');
 if(button)button.disabled=releaseCheck.busy;
}
async function checkLatestRelease(manual=false){
 if(releaseCheckPromise)return releaseCheckPromise;
 if(!manual&&Date.now()-releaseCheck.lastCheckAt<60_000)return;
 releaseCheck.busy=true;releaseCheck.message='公開中の最新版を確認しています…';showReleaseStatus();
 releaseCheck.lastCheckAt=Date.now();
 releaseCheckPromise=(async()=>{
  try{
   const sha=await fetchPublishedBuild();
   const status=compareBuilds(embeddedBuild(document),sha);
   if(manual){
    releaseCheck.message='最新版を再読み込みします…';showReleaseStatus();
    window.location.replace(freshLaunchUrl(window.location.href,sha,Date.now()));
    return;
   }
   releaseCheck.message=status==='new_release'?'新しい版があります。「最新版に更新」を押してください。':
    status==='up_to_date'?'最新版です。':
    '公開中のバージョンを確認できました。必要なら「最新版に更新」を押してください。';
  }catch(error){
   console.warn('AST Pocket update check unavailable',error);
   releaseCheck.message='更新を確認できませんでした。通信状況を確認して再度お試しください。';
  }finally{
   releaseCheck.busy=false;releaseCheckPromise=null;showReleaseStatus();
  }
 })();
 return releaseCheckPromise;
} const app=$('#app');
try{const m=localStorage.getItem('astPocketModeV2');if(m==='clinical'||m==='study')state.mode=m;}catch(e){/* Private browsing may disable storage */}

const icons={home:'⌂',search:'⌕',weekly:'▣',review:'▤',bug:'🦠',drug:'💊',infection:'🧫',culture:'🧪',ast:'👥'};
let searchTimer=null;
function normalize(s=''){
  s=s.normalize('NFKC').toLowerCase();
  s=s.replace(/[・･\s._\-\/()（）]+/g,'');
  s=[...s].map(ch=>{const c=ch.charCodeAt(0);return c>=0x30A1&&c<=0x30F6?String.fromCharCode(c-0x60):ch}).join('');
  return s.replace(/ー/g,'');
}
function lev(a,b){a=normalize(a);b=normalize(b);const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const d=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)d[i][0]=i;for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function score(q,text){const nq=normalize(q),nt=normalize(text);if(!nq)return 0;if(nt===nq)return 100;if(nt.startsWith(nq)||nq.startsWith(nt))return 92;if(nt.includes(nq)||nq.includes(nt))return 86;const dist=lev(nq,nt),max=Math.max(nq.length,nt.length);return Math.max(0,78-(dist/max)*70)}
function bestScore(q,vals){return Math.max(...vals.filter(Boolean).map(v=>score(q,v)),0)}

function parseMD(text,path){
  const fm={}; let body=text;
  const m=text.match(/^---\n([\s\S]*?)\n---\n/);
  if(m){m[1].split('\n').forEach(line=>{const i=line.indexOf(':');if(i>0)fm[line.slice(0,i).trim()]=line.slice(i+1).trim()});body=text.slice(m[0].length)}
  const sections={}; let current=''; body.split('\n').forEach(line=>{if(line.startsWith('# ')){current=line.slice(2).trim();sections[current]=[]}else if(current){sections[current].push(line)}});
  Object.keys(sections).forEach(k=>sections[k]=sections[k].join('\n').trim());
  return {path,fm,sections,body};
}
function mdList(s=''){return s.split('\n').filter(x=>/^[-*]\s/.test(x)).map(x=>x.replace(/^[-*]\s+/,''))}
function esc(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

let ampcLoading=null;
async function loadAmpc(){
 if(ampcLoading)return ampcLoading;
 ampcLoading=(async()=>{
  try{
   const [a,b]=await Promise.all([fetch(AMP_C_NOTE,{cache:'no-store'}),fetch(AMP_C_QUIZ,{cache:'no-store'})]);
   if(!a.ok||!b.ok)throw Error('AmpC content could not be loaded');
   const chapters=parseAmpcNote(await a.text()),questions=await b.json();
   validateAmpcQuiz(questions);
   state.ampcChapters=chapters;state.ampcQuestions=questions;
   try{
    const data=JSON.parse(localStorage.getItem('astPocketAmpcStudyV1')||'{}');
    state.ampcProgress=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
   }catch{state.ampcProgress={}}
   if(state.ampcTab==='quiz'&&!state.ampcOrder.length)
    state.ampcOrder=rankAmpcQuestions(questions,state.ampcProgress);
  }catch(e){console.warn('AmpC education material unavailable',e)}
 })();
 await ampcLoading;
 if(state.view==='ampc'&&state.mode==='study')render(false);
}
function openAmpc(quiz=false){
 if(state.mode!=='study')return;
 state.ampcTab=quiz?'quiz':'notes';
 state.ampcIndex=0;state.ampcChoice=null;state.ampcRevealed=false;
 state.ampcOrder=state.ampcQuestions.length?rankAmpcQuestions(state.ampcQuestions,state.ampcProgress):[];
 navigate('ampc');
 if(!state.ampcQuestions.length)void loadAmpc();
}
function ampcView(){
 return renderAmpcStudy({mode:state.mode,chapters:state.ampcChapters,questions:state.ampcQuestions,
 tab:state.ampcTab,index:state.ampcIndex,order:state.ampcOrder,choice:state.ampcChoice,
 revealed:state.ampcRevealed,progress:state.ampcProgress,modeHtml:modeControl()})+nav();
}
let spectrumLoading=null;
async function loadSpectrum(){
 if(state.mode!=='study')return;
 if(state.spectrumData)return;
 if(spectrumLoading)return spectrumLoading;
 spectrumLoading=(async()=>{
  try{
   const response=await fetch(ANTIFUNGAL_SPECTRUM_PATH,{cache:'no-store'});
   if(!response.ok)throw Error('Spectrum data unavailable');
   const data=await response.json();
   validateSpectrum(data);
   state.spectrumData=data;
  }catch(error){
   console.warn('Study-only antifungal spectrum could not load',error);
  }finally{
   spectrumLoading=null;
  }
  if(state.view==='spectrum'&&state.mode==='study')render(false);
 })();
 return spectrumLoading;
}
function openSpectrum(){
 if(state.mode!=='study')return;
 navigate('spectrum',{spectrumOrganism:'all',spectrumCell:null});
 if(!state.spectrumData)void loadSpectrum();
}
function spectrumView(){
 return renderSpectrum({data:state.mode==='study'?state.spectrumData:null,
  mode:state.mode,selectedOrganism:state.spectrumOrganism,
  selectedCell:state.spectrumCell,modeHtml:modeControl()})+nav();
}
async function load(){
  const [org,abx,idx,review,reviewBank]=await Promise.all([
    fetch('data/organisms.json',{cache:'no-store'}).then(r=>r.json()),fetch('data/antibiotics.json',{cache:'no-store'}).then(r=>r.json()),fetch('content/index.json',{cache:'no-store'}).then(r=>r.json()),fetch('content/review/questions.json',{cache:'no-store'}).then(r=>r.json()),fetch('content/review/bank-v2.json',{cache:'no-store'}).then(r=>r.json())
  ]); state.organisms=org;state.antibiotics=abx;state.review=review;
  await reviewFeature.init(reviewBank);
  state.notes=await Promise.all(idx.notes.map(async p=>parseMD(await fetch(p,{cache:'no-store'}).then(r=>r.text()),p)));
  state.weekly=await Promise.all(idx.weekly.map(async p=>parseMD(await fetch(p,{cache:'no-store'}).then(r=>r.text()),p)));
  state.weekly.sort((a,b)=>b.path.localeCompare(a.path));
  if(state.mode==='study')await loadTextbooks();
  try{
    const response=await fetch('content/organized.json',{cache:'no-store'});
    if(response.ok){
      const data=await response.json();
      if(data.schema_version===1&&Array.isArray(data.topics)&&Array.isArray(data.categories))state.organized=data;
    }
  }catch(e){console.warn('Organized Weekly index is not yet available',e);}
  try{
    const response=await fetch('content/integration-proposals.json',{cache:'no-store'});
    if(response.ok){const data=await response.json();if(data.schema_version===1&&Array.isArray(data.topics)&&Array.isArray(data.facts)&&data.verified===false)state.integrations=data;}
  }catch(e){console.warn('Integration drafts not yet available',e);}
  render();
}
let textbookPromise=null;
async function loadTextbooks(){
 if(textbookPromise)return textbookPromise;
 textbookPromise=Promise.all([...REVIEW_TEXTBOOKS.map(async entry=>{
  try{
   const response=await fetch(entry.path,{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   state.textbooks[entry.id]=parseReviewTextbook(entry,await response.text());
  }catch(error){
   state.textbookErrors[entry.id]='読込・章構成の検証ができませんでした';
   console.warn('Learning-only textbook could not be loaded',entry.id,error);
  }
 }), (async()=>{
  try{
   const response=await fetch('docs/evidence/sab-2026-10-21.json',{cache:'no-store'});
   if(!response.ok)throw Error('Evidence ledger unavailable');
   const data=await response.json();
   if(data.schema_version===1&&data.editor_status==='needs_human_review'&&Array.isArray(data.claims))
    state.evidenceLedger=data;
  }catch(e){console.warn('Evidence ledger remains unconfirmed',e)}
 })()]);
 return textbookPromise;
}
function textbookShelf(){
 if(state.mode!=='study'||typeof REVIEW_TEXTBOOKS==='undefined')return '';
 return '<section class="card textbook-shelf"><div class="section-title compact">📘 詳しい教科書ノート</div>'+
 '<p>GPC clusters・MSSA菌血症・抗真菌薬の全24章。医学的に未承認の学習草案です。</p>'+
 '<div class="textbook-shelf-list">'+REVIEW_TEXTBOOKS.map(entry=>
  '<button type="button" class="textbook-shelf-item" data-open-textbook="'+esc(entry.id)+'">'+
  '<strong>'+esc(entry.title)+'</strong><span>'+esc(entry.short)+'</span>'+
  '<small>8章 ／ 原典確認待ち　›</small></button>').join('')+'</div></section>';
}
function textbookView(){
 const entry=REVIEW_TEXTBOOKS.find(x=>x.id===state.selectedTextbookId);
 if(!entry)return '<main class="screen">'+brand('学習教科書')+'<section class="card empty">この教科書は見つかりません。</section></main>'+nav();
 return renderReviewTextbook({entry,textbook:state.mode==='study'?state.textbooks[entry.id]:null,
  mode:state.mode,modeHtml:modeControl(),evidenceLedger:state.evidenceLedger})+nav();
}
function brand(sub='感染症ナレッジ'){return `<div class="brand"><div><h1><span class="ast">AST</span> Pocket</h1><p>${sub}</p></div><div class="brand-mark">🩺</div></div>${modeControl()}`}
function modeControl(){return `<div class="mode-toggle" role="group" aria-label="AST Pocket表示モード"><button type="button" data-mode="clinical" class="${state.mode==='clinical'?'selected':''}" aria-pressed="${state.mode==='clinical'}">🩺 臨床モード</button><button type="button" data-mode="study" class="${state.mode==='study'?'selected':''}" aria-pressed="${state.mode==='study'}">📘 学習モード</button></div>`}
function searchBox(){return `<div class="searchbox"><span class="search-icon">⌕</span><input id="searchInput" value="${esc(state.query)}" placeholder="菌・抗菌薬・感染症を検索" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"/><button class="clear-btn ${state.query?'':'hidden'}" id="clearSearch" type="button">×</button></div>`}
function nav(){return `<nav class="bottom-nav"><div class="inner">${[['home','Home'],['search','Search'],['weekly','Weekly'],['review','Review']].map(([v,l])=>`<button class="nav-btn ${state.view===v?'active':''}" data-nav="${v}"><span class="nav-icon">${icons[v]}</span>${l}</button>`).join('')}</div></nav><button class="fab" id="fab">＋</button>`}

/* Common navigation history for all AST Pocket pages.
   Keep snapshots in memory only; no patient or answer data is persisted here. */
const navigationStack=[];
function capturePage(){
 const elements=sel=>[...document.querySelectorAll(sel)];
 return {
  view:state.view,mode:state.mode,query:state.query,filter:state.filter,
  selectedNotePath:state.selectedNote?.path||null,
  selectedWeeklyPath:state.selectedWeeklyPath,selectedTopicId:state.selectedTopicId,selectedTextbookId:state.selectedTextbookId,
  spectrumOrganism:state.spectrumOrganism,spectrumCell:state.spectrumCell,
  libraryCategory:state.libraryCategory,noteOrigin:state.noteOrigin,
  scrollY:window.scrollY||0,
  expandedDetails:elements('main.screen details').flatMap((el,i)=>el.open?[i]:[]),
  expandedAnswers:elements('main.screen .q-row').flatMap((el,i)=>el.classList.contains('open')?[i]:[])
 };
}
function routeLabel(snapshot){
 if(snapshot.view==='note')return state.notes.find(n=>n.path===snapshot.selectedNotePath)?.fm.title||'ノート';
 if(snapshot.view==='topic')return state.integrations?.topics?.find(t=>t.topic_id===snapshot.selectedTopicId)?.title||'学習ノート';
 if(snapshot.view==='textbook')return REVIEW_TEXTBOOKS.find(x=>x.id===snapshot.selectedTextbookId)?.title||'詳細教科書';
 if(snapshot.view==='ampc')return 'AmpCの学習と復習';
 if(snapshot.view==='spectrum')return '抗真菌薬スペクトル';
 const labels={home:'Home',search:'検索結果',weekly:'Weekly',review:'Review',library:'分野別ノート一覧',integration:'原典確認待ち一覧'};
 return labels[snapshot.view]||'前の画面';
}
function backMarkup(){
 if(!navigationStack.length)return '';
 const previous=navigationStack[navigationStack.length-1];
 return '<div class="global-back-row"><button type="button" class="global-back-button" data-go-back>‹ '+esc(routeLabel(previous))+'へ戻る</button></div>';
}
function navigate(view,changes={},scroll=true){
 if(view!==state.view){
  navigationStack.push(capturePage());
  if(navigationStack.length>50)navigationStack.shift();
 }
 Object.assign(state,changes);
 state.view=view;
 render(scroll);
}
function goBack(){
 const previous=navigationStack.pop();
 if(!previous){
  if(state.view!=='home'){state.view='home';render();}
  return;
 }
 state.view=previous.view;
 state.mode=previous.mode;
 state.query=previous.query;
 state.filter=previous.filter;
 state.libraryCategory=previous.libraryCategory;
 state.noteOrigin=previous.noteOrigin;
 state.selectedNote=state.notes.find(n=>n.path===previous.selectedNotePath)||null;
 state.selectedWeeklyPath=previous.selectedWeeklyPath;
 state.selectedTopicId=previous.selectedTopicId;
 state.selectedTextbookId=previous.selectedTextbookId;
 state.spectrumOrganism=previous.spectrumOrganism||'all';
 state.spectrumCell=previous.spectrumCell||null;
 try{localStorage.setItem('astPocketModeV2',state.mode)}catch(e){}
 render(false);
 requestAnimationFrame(()=>{
  document.querySelectorAll('main.screen details').forEach((el,i)=>{el.open=previous.expandedDetails.includes(i)});
  document.querySelectorAll('main.screen .q-row').forEach((el,i)=>el.classList.toggle('open',previous.expandedAnswers.includes(i)));
  window.scrollTo({top:previous.scrollY,behavior:'instant'});
 });
}

function bindCommon(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    clearTimeout(searchTimer);
    const target=b.dataset.nav;
    navigate(target,target==='search'?{query:'',filter:'all'}:target==='weekly'?{selectedWeeklyPath:null}:target==='home'?{query:''}:{});
  });
  $('#fab').onclick=openMemo;
  const inp=$('#searchInput');
  if(!inp)return;

  // On the Home screen, move to Search as soon as the field receives focus,
  // before the user starts flick input. Once on Search, the input node is kept alive.
  inp.addEventListener('focus',()=>{
    if(state.view==='home'){
      navigate('search',{},false);
      requestAnimationFrame(()=>{
        const i=$('#searchInput');
        if(i){i.focus();const p=i.value.length;i.setSelectionRange(p,p)}
      });
    }
  },{once:true});

  let composing=false;
  const refreshResults=()=>{
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      if(!composing && state.view==='search') updateSearchPanel();
    },120);
  };

  inp.addEventListener('compositionstart',()=>{
    composing=true;
    clearTimeout(searchTimer);
  });
  inp.addEventListener('compositionend',e=>{
    composing=false;
    state.query=e.target.value;
    updateClearButton();
    refreshResults();
  });
  inp.addEventListener('input',e=>{
    state.query=e.target.value;
    updateClearButton();
    if(e.isComposing||composing)return;
    refreshResults();
  });

  $('#clearSearch')?.addEventListener('click',()=>{
    clearTimeout(searchTimer);
    state.query='';
    inp.value='';
    updateClearButton();
    updateSearchPanel();
    inp.focus();
  });
}

function updateClearButton(){
  const b=$('#clearSearch');
  if(b)b.classList.toggle('hidden',!state.query);
}

function home(){
  const w=state.weekly[0];
  const featured=state.notes.find(n=>n.fm.layout==='integrated');
  const organizerCard=organizationIntro();
  const fcard=featured?`<section class="card featured-note"><div class="eyebrow">📖 分野別統合ノート・第1号</div><h2>${esc(featured.fm.title)}</h2><p>30秒要約／詳細学習／関連する菌・抗菌薬</p><span class="draft-label">学習用・原典確認待ち</span><button type="button" id="openFeaturedNote" class="primary-btn">MSSA菌血症ノートを開く ›</button></section>`:'';
  const weekCard=w?`<div class="section-title">🎓 今週の学習</div><section class="card weekly-card"><strong>📅 ${esc(w.fm.week||'今週')}</strong><ul>${mdList(w.sections['今週の学習']).slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><button class="primary-btn" id="goWeekly">今週のまとめを見る ›</button></section>`:'';
  if(state.mode==='study')return `<main class="screen">${brand('感染症を学び、ASTの判断力を育てる')}${searchBox()}<section class="hero-card study-hero"><div class="hero-title">🎓 学習モード</div><p>統合ノートで知識を整理し、復習で定着を目指す</p></section>${updateCard()}<section class="card study-landing"><div class="section-title compact">🧠 今日の復習</div><p>平日5問・週末10問の復習、自己評価、端末内の回答履歴で学習を継続できます。</p><button class="primary-btn" id="openReviewHome">Reviewを開く ›</button><p class="small-note">現在の問題は原典未確認の練習用です。正式な理解度には算入しません。</p></section>${organizerCard}${textbookShelf()}<section class="card spectrum-home-link"><div class="eyebrow">💊 10月17日の学習表</div><h2>抗真菌薬スペクトル一覧</h2><p>MCFG／CPFG・FLCZ・VRCZ・ITCZ・PSCZ・ISCZ・L-AMB・5-FC を6菌種で比較。</p><button type="button" class="primary-btn" data-open-spectrum>スペクトル表を見る ›</button><p class="small-note">◎○△×をタップして薬剤別・菌種別に確認できます（学習用）。</p></section><section class="card ampc-landing"><div class="eyebrow">🧬 以前の学習を復習</div><h2>AmpC βラクタマーゼ</h2><p>ECKH・CTRX・CFPM・MEPM・CMZを最新IDSAに照らして整理。</p><div class="ampc-shortcuts"><button id="ampcStudyOpen" class="primary-btn">8章の教科書を読む ›</button><button id="ampcQuizOpen" class="primary-btn">AmpCの10問を復習する ›</button></div><p class="small-note">学習専用・原典確認待ち</p></section>${fcard}${weekCard}<section class="card notice">💾 回答履歴は端末内に保存します。ReviewからJSONの書き出し・読み込みができます。</section></main>${nav()}`;
  return `<main class="screen">${brand()}${searchBox()}${updateCard()}<section class="hero-card"><div class="hero-title">💡 AST重要ポイント</div><p>明日からの診療に役立つ<br>感染症診療・ASTのキーポイントを確認</p></section>${organizerCard}${fcard}<div class="grid"><button class="category" data-cat="菌"><span class="icon-bubble teal">🦠</span><strong>菌</strong></button><button class="category" data-cat="抗菌薬"><span class="icon-bubble">💊</span><strong>抗菌薬</strong></button></div><div class="grid three"><button class="category" data-cat="感染症"><span class="icon-bubble pink">🧫</span><strong>感染症</strong></button><button class="category" data-cat="血培"><span class="icon-bubble purple">🧪</span><strong>血培</strong></button><button class="category" data-cat="AST介入"><span class="icon-bubble teal">👥</span><strong>AST介入</strong></button></div>${weekCard}<section class="card notice">🔔 更新確認が必要 <strong>${staleCount()}件</strong></section></main>${nav()}`;
}
function organizationIntro(){
 const count=state.organized?.topics?.length||0;
 const weeks=state.organized?.stats?.weekly_count||0;
 const total=state.integrations?.stats?.facts||0;
 const pending=state.integrations?.stats?.review_required||0;
 return `<section class="card organizer-intro"><div class="eyebrow">🗂 学習ログの自動分類・統合</div><h2>分野別に学習を整理</h2>
  <p>6分類で整理し、Weeklyから統合ノートの学習メモを自動生成します。${count?`現在 ${count} テーマ／${weeks} 週分を分類済み`:'分類データを準備しています。'}</p>
  <button id="openOrganizer" type="button" class="primary-btn">自動整理したノートを見る ›</button>
  ${state.integrations?`<div class="queue-preview"><strong>📘 新しい学習候補 ${total}件</strong><p>医学的内容の原典確認待ち：${pending}件</p><button id="openReviewQueue" type="button" class="review-queue-button">確認待ちの内容を見る ›</button></div>`:''}
  <p class="small-note">ルールによる自動分類・重複整理です。未確認の情報は確定した臨床推奨には加えません。</p></section>`;
}
function staleCount(){const now=new Date();return state.notes.filter(n=>{const d=new Date(n.fm.last_reviewed);return isFinite(d)&&((now-d)/86400000)>365}).length}
function getSearchResults(){
  const q=state.query.trim();let results=[];
  for(const o of state.organisms){
    const s=bestScore(q,[o.canonical,o.ja,o.short,...o.aliases,...o.tags]);
    if(s>38)results.push({type:'菌',score:s,title:o.canonical,sub:o.ja,obj:o});
  }
  for(const a of state.antibiotics){
    const s=bestScore(q,[a.generic,a.english,...a.abbr,...a.brands,...a.aliases,...a.tags]);
    if(s>38)results.push({type:'抗菌薬',score:s,title:a.generic,sub:[a.english,...a.abbr].join(' / '),obj:a});
  }
  for(const n of state.notes){
    if(n.fm.layout!=='integrated')continue;
    const s=bestScore(q,[n.fm.title,n.fm.ja,n.fm.aliases,n.fm.category,...(n.fm.tags||'').split(','),...mdList(n.sections['30秒要約'])]);
    if(s>38)results.push({type:'ノート',score:s,title:n.fm.title,sub:n.fm.ja||n.fm.category,obj:n});
  }
  for(const w of state.weekly){
    const s=bestScore(q,[w.fm.title,w.fm.week,w.fm.tags,...w.body.split('\n').filter(Boolean).slice(0,80)]);
    if(s>36)results.push({type:'Weekly',score:s,title:w.fm.title,sub:w.fm.week,obj:w});
  }
  if(state.mode==='study'&&q&&['抗真菌','真菌薬','スペクトル','mcfg','cpfg','flcz','vrcz','itcz','pscz','iscz','l-amb','5-fc','カンジダ','cryptococcus','aspergillus'].some(v=>normalize(q).includes(normalize(v))||normalize(v).includes(normalize(q)))){
    results.push({type:'抗真菌薬スペクトル',score:100,title:'抗真菌薬スペクトル一覧',sub:'10月17日の表・8薬剤×6菌種',obj:null});
  }
  if(state.mode==='study'&&q&&['ampc','ampcβ','誘導型ampc','enterobacter','cfpm','eckh','シトロバクター'].some(v=>normalize(q).includes(normalize(v))||normalize(v).includes(normalize(q)))){
    results.push({type:'AmpC学習',score:100,title:'AmpC βラクタマーゼ',sub:'教科書8章・復習10問',obj:null});
  }
  if(!q){
    results=[
      ...state.organisms.slice(0,4).map(o=>({type:'菌',score:50,title:o.canonical,sub:o.ja,obj:o})),
      ...state.antibiotics.slice(0,3).map(a=>({type:'抗菌薬',score:50,title:a.generic,sub:a.english,obj:a}))
    ];
  }
  results.sort((a,b)=>b.score-a.score);
  if(state.filter!=='all')results=results.filter(r=>r.type===state.filter||(state.filter==='ノート'&&r.type==='抗真菌薬スペクトル'));
  return results;
}

function searchPanelHtml(){
  const q=state.query.trim();
  const results=getSearchResults();
  return `<div class="tabs">${[['all','すべて'],['菌','菌'],['抗菌薬','抗菌薬'],['ノート','ノート'],['Weekly','Weekly']].map(([k,l])=>`<button class="chip ${state.filter===k?'active':''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div class="suggest">${q?'もしかして？':'検索候補'}</div>
    ${results.length?results.slice(0,8).map((r,i)=>resultCard(r,i===0&&q)).join(''):'<div class="card empty">候補が見つかりません。別名・略語・商品名でも検索できます。</div>'}`;
}

function extractWeeklyLines(w,section){
 const body=w?.sections?.[section]||'';
 return body.split('\n').filter(s=>/^\s*(?:[-*]\s+|\d+\.\s+)/.test(s))
   .map(s=>s.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/,'').trim());
}
function excerptForRef(ref){
 const week=state.weekly.find(w=>w.path===ref.weekly);
 return extractWeeklyLines(week,ref.section)[ref.index]||null;
}
function classifiedHistory(refs,limit=5){
 return refs.slice(0,limit).map(r=>{
   const text=excerptForRef(r);
   const date=r.weekly.match(/\d{4}-\d{2}-\d{2}/)?.[0]||'';
   return text?`<div class="learning-snippet"><div class="learning-origin">${esc(date)} · ${esc(r.section)} · <span class="draft-label">学習ログ</span></div><p>${esc(text)}</p><button type="button" class="open-weekly-ref" data-weekly-path="${esc(r.weekly)}">元のWeeklyを見る ›</button></div>`:'';
 }).join('');
}
function integrationFact(id){return state.integrations?.facts?.find(f=>f.id===id)||null}
function proposedSource(f){
 const ref=f?.refs?.[0];if(!ref)return null;
 const weekly=state.weekly.find(w=>w.path===ref.weekly);if(!weekly)return null;
 if(ref.section==='今週の復習'){const q=parseQA(weekly.sections['今週の復習']||'')[ref.index];return q?{text:q.q,answer:q.a,ref}:null}
 const text=extractWeeklyLines(weekly,ref.section)[ref.index];return text?{text,answer:'',ref}:null
}
function proposalSnippet(link){
 const f=integrationFact(link.fact_id),src=proposedSource(f);if(!f||!src)return '';
 const flagged=f.risk==='review_required';
 const date=src.ref.weekly.match(/\d{4}-\d{2}-\d{2}/)?.[0]||'';
 return `<div class="proposal-snippet ${flagged?'review-required':'draft-learning'}">
 <div class="proposal-meta"><span class="draft-label">${flagged?'医学的内容：原典確認待ち':'学習メモ（未確認）'}</span>${link.already_present?'<span class="pill">既存内容との重複候補</span>':''}<small>${esc(date)} · ${esc(src.ref.section)}</small></div>
 <p>${f.kind==='qa'?'<strong>Q. </strong>':''}${esc(src.text)}</p>
 ${src.answer?`<p class="proposal-answer"><strong>学習時の回答：</strong>${esc(src.answer)}</p>`:''}
 <button type="button" class="open-weekly-ref" data-weekly-path="${esc(src.ref.weekly)}">元のWeeklyを見る ›</button>
 </div>`;
}
function topicIntegrationDetails(t,includeAll=false){
 if(!t?.links?.length)return '';
 const links=t.links.filter(l=>includeAll||!l.already_present);if(!links.length)return '<p class="small-note">既存内容と重複する候補のみです。</p>';
 const grouped=new Map();for(const l of links){const k=l.target_section||'学習メモ';if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(l)}
 return [...grouped].map(([section,refs])=>`<div class="proposal-group"><h3>${esc(section)}</h3>${refs.map(l=>proposalSnippet(l)).join('')}</div>`).join('');
}
function dynamicTopicView(){
 const t=state.integrations?.topics?.find(t=>t.topic_id===state.selectedTopicId);
 if(!t)return '<main class="screen">'+brand('学習ノート')+'<section class="card empty">この学習ノートはまだ生成されていません。</section></main>'+nav();
 const html=renderTemplateNotebook({
  id:t.topic_id,title:t.title,category:t.category,mode:state.mode,
  modeHtml:modeControl(),links:t.links||[],fragmentForLink:l=>proposalSnippet(l),
  historyHtml:state.mode==='study'?classifiedHistory(t.weekly_refs||[],6):''
 });
 const extra=state.mode==='study'?REVIEW_TEXTBOOKS.find(e=>e.related.includes(t.topic_id)):null;
 const htmlWithTextbook=extra?html.replace('</main>',
  '<section class="card integrated-card"><h2>📘 詳しい教科書も読む</h2>'+
  '<button type="button" class="primary-btn" data-open-textbook="'+esc(extra.id)+'">'+esc(extra.title)+' ›</button>'+
  '<p class="small-note">医学的未承認の学習用解説です。</p></section></main>'):html;
 if(state.mode==='study'&&t.topic_id==='cross-antifungal-spectrum'){
  return htmlWithTextbook.replace('</main>','<section class="card spectrum-home-link"><div class="eyebrow">💊 10月17日の学習表</div><h2>抗真菌薬スペクトル一覧</h2><p>MCFG／CPFG・FLCZ・VRCZ・ITCZ・PSCZ・ISCZ・L-AMB・5-FC を6菌種で比較。</p><button type="button" class="primary-btn" data-open-spectrum>スペクトル表を見る ›</button><p class="small-note">◎○△×をタップして薬剤別・菌種別に確認できます（学習用）。</p></section></main>')+nav();
 }
 return htmlWithTextbook+nav();
}
function integrationReviewView(){
 const all=state.integrations;
 if(!all)return `<main class="screen">${brand('原典確認待ち')}<section class="card empty">統合候補のデータがまだありません。公開後に画面を再読み込みしてください。</section></main>${nav()}`;
 const flagged=all.facts.filter(f=>f.risk==='review_required');
 return `<main class="screen">${brand('学習内容の確認待ち')}
 <section class="card organizer-info"><h2>🔎 原典確認待ち ${flagged.length}件</h2><p>医学的判断に関係する学習内容を整理しました。確認済みKnowledgeへの自動反映は行いません。</p><p class="small-note">原典確認・承認操作は今後の機能です。ここでは元のWeeklyを確認できます。</p></section>
 ${flagged.map(f=>{const links=all.topics.filter(t=>t.links.some(x=>x.fact_id===f.id));return `<article class="card classified-item"><div class="proposal-meta"><span class="draft-label">原典照合待ち</span><small>関連：${esc(links.map(t=>t.title).slice(0,4).join('／'))}</small></div>${proposalSnippet({fact_id:f.id})}</article>`}).join('')||'<section class="card empty">確認待ちの学習項目はありません。</section>'}</main>${nav()}`;
}
function libraryView(){
 const data=state.organized;
 if(!data)return `<main class="screen">${brand('分野別学習ノート')}<section class="card empty">自動分類データを取得できませんでした。</section></main>${nav()}`;
 const cat=state.libraryCategory,topics=data.topics.filter(t=>cat==='all'||t.category===cat);
 const categoryControls=[{id:'all',label:'すべて',icon:'📚'},...data.categories].map(c=>`<button type="button" data-library-cat="${esc(c.id)}" class="chip ${cat===c.id?'active':''}">${c.icon} ${esc(c.label)}${c.id==='all'?'':` (${data.topics.filter(t=>t.category===c.id).length})`}</button>`).join('');
 const cards=topics.map(t=>{
  const hasNote=t.note&&state.notes.some(n=>n.path===t.note);
  const integrated=state.integrations?.topics?.find(x=>x.topic_id===t.id);
  const label=data.categories.find(c=>c.id===t.category)?.label||t.category;
  return `<article class="card classified-item"><div class="eyebrow">${esc(label)} · ${t.refs.length}件の学習記録</div><h3>${esc(t.title)}</h3><div class="classified-status"><span class="draft-label">自動分類・未検証</span><span class="pill">${hasNote?'統合ノートあり':'自動学習ノート'}</span>${integrated?.links?.length?`<span class="pill">追記候補 ${integrated.links.length}件</span>`:''}</div><details class="detail-panel"><summary>どの学習から分類された？</summary>${classifiedHistory(t.refs,6)}</details>
 ${hasNote?`<button type="button" class="primary-btn open-classified-note" data-note="${esc(t.note)}">統合ノートを開く ›</button>`:`<button type="button" class="primary-btn open-generated-topic" data-topic-id="${esc(t.id)}">学習ノートを開く ›</button>`}</article>`;
 }).join('');
 return `<main class="screen">${brand('6分類で学習を蓄積')}
 <section class="card organizer-info"><strong>🗂 Weeklyの自動整理と追記候補</strong><p>${data.stats.weekly_count}週分から${data.stats.classified_topics}テーマを検出。学習メモの追記候補は自動作成します。</p><p class="small-note">ルールによる処理です。臨床推奨の原典照合・自動更新は行いません。</p>${state.integrations?`<button id="openReviewQueue" class="review-queue-button">医学的な確認待ち ${state.integrations.stats.review_required}件を見る ›</button>`:''}</section>
 ${state.mode==='study'?`<section class="card spectrum-home-link"><div class="eyebrow">💊 10月17日の学習表</div><h2>抗真菌薬スペクトル一覧</h2><p>MCFG／CPFG・FLCZ・VRCZ・ITCZ・PSCZ・ISCZ・L-AMB・5-FC を6菌種で比較。</p><button type="button" class="primary-btn" data-open-spectrum>スペクトル表を見る ›</button><p class="small-note">◎○△×をタップして薬剤別・菌種別に確認できます（学習用）。</p></section>`:''}${textbookShelf()}<div class="tabs organizer-tabs">${categoryControls}</div><p class="small-note">分類されたテーマ ${topics.length}件</p>${cards||'<section class="card empty">この分類に学習記録はありません。</section>'}</main>${nav()}`;
}
function searchResults(){
  return `<main class="screen">${brand()}${searchBox()}<div id="searchPanel">${searchPanelHtml()}</div></main>${nav()}`;
}

function updateSearchPanel(){
  const panel=$('#searchPanel');
  if(!panel)return;
  panel.innerHTML=searchPanelHtml();
  bindSearchPanel();
}

function bindSearchPanel(){
  document.querySelectorAll('[data-open-spectrum]').forEach(el=>el.onclick=openSpectrum);
  document.querySelectorAll('[data-search-ampc]').forEach(b=>b.onclick=()=>openAmpc(false));
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
    state.filter=b.dataset.filter;
    updateSearchPanel();
  });
  document.querySelectorAll('.open-note').forEach(b=>b.onclick=()=>{
    const note=state.notes.find(n=>n.path===b.dataset.note);
    if(note)navigate('note',{selectedNote:note,noteOrigin:'search'});
  });
  document.querySelectorAll('[data-weekly-open]').forEach(b=>b.onclick=()=>{
    navigate('weekly',{selectedWeeklyPath:b.dataset.weeklyOpen});
  });
}

function resultCard(r,top){
  if(r.type==='抗真菌薬スペクトル')return '<section class="card result-card"><div class="result-head"><span class="icon-bubble teal">💊</span><div class="result-title"><h3>抗真菌薬スペクトル一覧</h3><p>8薬剤×6菌種：10月17日の比較表</p></div></div><button type="button" class="primary-btn" data-open-spectrum>スペクトル表を見る ›</button></section>';
  if(r.type==='AmpC学習')return '<section class="card result-card"><div class="result-head"><span class="icon-bubble purple">🧬</span><div class="result-title"><h3>AmpC βラクタマーゼ</h3><p>最新IDSAを基に学ぶ8章・集中復習10問</p></div></div><button type="button" class="primary-btn" data-search-ampc>AmpCを学ぶ ›</button></section>';
  if(r.type==='ノート')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble pink">📖</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub||'')} · 統合ノート</p><span class="draft-label">原典確認待ち</span></div></div><button class="primary-btn open-note" data-note="${esc(r.obj.path)}">統合ノートを開く ›</button></section>`;
  if(r.type==='菌')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble teal">🦠</span><div class="result-title"><h3>${esc(r.title)} ${top?'<span class="verified">✓ 候補</span>':''}</h3><p>${esc(r.sub||'')}</p><div class="tags">${(r.obj.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div></div></div><div class="summary">${r.obj.id==='stenotrophomonas-maltophilia'?'カルバペネムは基本的に期待しにくい / ST使用時はK・腎機能を確認':'菌名・別名・関連タグから一致しました。'}</div>${r.obj.note?'<button class="primary-btn open-note" data-note="'+r.obj.note+'">菌ノートを開く ›</button>':''}</section>`;
  if(r.type==='抗菌薬')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble">💊</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub)}</p><div class="tags">${[...(r.obj.brands||[]),...(r.obj.abbr||[])].slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></div><div class="summary">一般名・商品名・略語・入力ゆれから検索できます。</div></section>`;
  return `<section class="card result-card"><div class="result-head"><span class="icon-bubble purple">📅</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub||'')}</p></div></div><button class="primary-btn" data-weekly-open="${esc(r.obj.path)}">Weeklyを開く ›</button></section>`
}
function noteView(){
 const n=state.selectedNote||state.notes[0];
 if(!n)return '<main class="screen"><p>ノートを読み込めませんでした。</p></main>'+nav();
 if(n.fm.layout==='integrated')return integratedNoteView(n);
 const matches=state.integrations?.topics?.filter(t=>t.note_path===n.path)||[];
 const topics=state.organized?.topics?.filter(t=>t.note===n.path)||[];
 const cat=n.fm.category||'organism';
 const html=renderTemplateNotebook({
  id:n.fm.id||n.path,title:n.fm.title,subtitle:n.fm.ja||'',category:cat,
  mode:state.mode,modeHtml:modeControl(),sections:n.sections,
  links:matches.flatMap(t=>t.links),fragmentForLink:l=>proposalSnippet(l),
  historyHtml:state.mode==='study'&&topics.length?classifiedHistory(topics.flatMap(t=>t.refs),8):'',
  notesMeta:n.fm
 });
 return html+nav();
}
function integratedNoteView(n){
  if(n.path===MSSA_PATH){
    const integratedTopic=state.integrations?.topics?.find(t=>t.note_path===n.path);
    const linkedTopics=(state.organized?.topics||[]).filter(t=>t.note===n.path);
    const related=mdList(n.sections['関連ノート']);
    const study=state.mode==='study';
    const weeklyHtml=study&&integratedTopic?.links?.length?topicIntegrationDetails(integratedTopic):'';
    const classifiedHtml=study&&linkedTopics.length?classifiedHistory(linkedTopics.flatMap(t=>t.refs),8)+
      '<button type="button" class="primary-btn" id="openOrganizerFromNote">分野別一覧を見る ›</button>':'';
    const relatedHtml=study?'<div class="related-links">'+related.map(t=>
      '<button type="button" class="related-link" data-related="'+esc(t)+'">'+esc(t)+' ›</button>').join('')+'</div>':'';
    return renderMssaNotebook(n,{
      mode:state.mode,modeHtml:modeControl(),weeklyHtml,classifiedHtml,relatedHtml
    })+nav();
  }
  const clinical=state.mode==='clinical';
  const sections=['初期評価・感染源','再血培と持続菌血症','感染性心内膜炎・深部感染','抗菌薬の評価','治療期間とフォロー'];
  const related=mdList(n.sections['関連ノート']);
  const summary=mdList(n.sections['30秒要約']);
  const check=mdList(n.sections['ASTで確認']);
  const qa=parseQA(n.sections['ミニ復習']);
  const integratedTopic=state.integrations?.topics?.find(t=>t.note_path===n.path);
  const tags=(n.fm.tags||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,6);
  const details=sections.map(s=>`<details class="detail-panel"><summary>${esc(s)}</summary><ul>${mdList(n.sections[s]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`).join('');
  return `<main class="screen integrated-screen"><div class="note-head"></div>${modeControl()}<header class="integrated-heading"><div class="eyebrow">感染症 ＞ 血流感染</div><h1>${esc(n.fm.title)}</h1><p>${esc(n.fm.ja||'')}</p><div class="tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></header><div class="draft-alert" role="note"><strong>⚠️ 学習用ノート・原典確認待ち（draft）</strong><p>治療推奨の確定版ではありません。具体的な投与量・期間は原典や施設基準を別途確認してください。</p></div>
  ${clinical?`
  <section class="card integrated-card"><h2>⚡ 30秒で確認</h2><ol class="brief-points">${summary.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></section>
  <section class="card integrated-card"><h2>📋 ASTチェックリスト</h2><p class="small-note">この画面内だけの確認欄です。患者情報は入力しないでください。</p><ul class="quick-checks">${check.map(t=>`<li><label><input type="checkbox"/> <span>${esc(t)}</span></label></li>`).join('')}</ul></section>
  <section class="card integrated-card"><h2>🔎 判断に迷ったら</h2><p>持続菌血症の評価・感染源コントロール・投与設計を、詳細ノートで確認できます。</p><button type="button" class="primary-btn" data-mode="study">詳細ノートで学ぶ ›</button></section>`
  :`
  <section class="card integrated-card"><h2>📚 詳細ノート</h2><p class="small-note">学習内容を整理した下書きです。タップすると各項目を表示します。</p>${details}</section>
  <section class="card integrated-card"><h2>🧠 ミニ復習</h2><p class="small-note">練習用・回答記録なし。正式な採点と理解度管理は次の段階で実装します。</p>${qa.map(x=>`<details class="detail-panel"><summary>Q. ${esc(x.q)}</summary><p class="model-answer">A. ${esc(x.a)}</p></details>`).join('')}</section>
  ${integratedTopic?.links?.length?`<section class="card integrated-card"><h2>🗂 Weeklyからの学習メモ</h2><p class="small-note">既存の本文は保持したまま、学習内容を項目ごとに整理して追加表示します。原典確認前の内容です。</p>${topicIntegrationDetails(integratedTopic)}</section>`:''}
  <section class="card integrated-card"><h2>⚡ 30秒要約も確認</h2><ul>${summary.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`
  }
  ${(state.organized?.topics||[]).some(t=>t.note===n.path)?`<section class="card integrated-card"><h2>🗂 Weeklyから自動整理した学習</h2><p class="small-note">機械的な分類結果です。未確認の学習メモを臨床上の推奨として扱わないでください。</p>${classifiedHistory(state.organized.topics.filter(t=>t.note===n.path).flatMap(t=>t.refs),8)}<button type="button" class="primary-btn" id="openOrganizerFromNote">分野別一覧を見る ›</button></section>`:''}
  <section class="card integrated-card"><h2>🔗 関連ノート・検索</h2><div class="related-links">${related.map(t=>`<button type="button" class="related-link" data-related="${esc(t)}">${esc(t)} ›</button>`).join('')}</div><p class="small-note">関連項目から辞書・既存ノートの検索へ移動します。</p></section>
  <section class="card integrated-card"><h2>📚 根拠・更新状況</h2><p>${esc(n.fm.source||'未設定')}</p><p class="small-note">最終原典確認：${esc(n.fm.last_reviewed||'未確認')} ／ 状態：${esc(n.fm.status||'draft')}</p></section></main>${nav()}`;
}
function noteSection(title,items){return `<section class="card note-section"><h2>${title}</h2><div class="body"><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></section>`}
function checkSection(title,items){return `<section class="card note-section"><h2>${title}</h2><div class="body"><ul class="checklist">${items.map(x=>`<li><input type="checkbox"/> ${esc(x)}</li>`).join('')}</ul></div></section>`}
function noteText(title,text,cls=''){return `<section class="card note-section ${cls}"><h2>${title}</h2><div class="body">${esc(text||'')}</div></section>`}
function sourceSection(n){return `<section class="card note-section"><h2>📚 根拠</h2><div class="body sources"><div>• ${esc(n.fm.source||'出典未設定')}</div><div>• 最終確認：${esc(n.fm.last_reviewed||'')}</div><br><button class="primary-btn" id="latestBtn">最新情報を確認 ›</button></div></section>`}

function weeklyView(){
  const w=state.weekly.find(x=>x.path===state.selectedWeeklyPath)||state.weekly[0];
  if(!w)return '<main class="screen">'+brand('週間学習まとめ')+'<section class="card empty">Weeklyはまだありません。</section></main>'+nav();
  const learning=mdList(w.sections['今週の学習']);
  const points=(w.sections['今週の重要ポイント']||'').split('\n').filter(Boolean).map(x=>x.replace(/^\d+\.\s*/,''));
  const rev=parseQA(w.sections['今週の復習']);
  const candidates=mdList(w.sections['正式ノート候補']);
  const options=state.weekly.map(x=>'<option value="'+esc(x.path)+'" '+(x.path===w.path?'selected':'')+'>'+esc(x.fm.week||x.fm.title||x.path)+'</option>').join('');
  return '<main class="screen">'+brand('週間学習まとめ')+
    '<section class="card weekly-picker-card"><label for="weeklyPicker">📅 表示する週を選択</label><select id="weeklyPicker" aria-label="表示する週">'+options+'</select><p class="weekly-disclaimer">学習履歴です。最新の診療推奨・出典確認済みKnowledgeとは異なります。</p></section>'+
    '<section class="card weekly-section"><h2>🎓 今週の学習</h2><div class="body"><strong>📅 '+esc(w.fm.week||'')+'</strong><ul>'+learning.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div></section>'+
    '<section class="card weekly-section"><h2>💡 今週の重要ポイント</h2><div class="body"><ol class="numbered">'+points.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></div></section>'+
    '<section class="card weekly-section"><h2>📘 今週の復習</h2><div class="body">'+rev.map(x=>'<div class="q-row"><strong>Q '+esc(x.q)+'</strong><div class="answer">'+esc(x.a)+'</div></div>').join('')+'</div></section>'+
    '<section class="card weekly-section"><h2>📓 正式ノート候補</h2><div class="body">'+candidates.map(x=>'<div class="list-row"><span>'+esc(x)+'</span><span class="pill">要確認</span></div>').join('')+'</div></section>'+
    '</main>'+nav();
}
function parseQA(s=''){const lines=s.split('\n');const out=[];let cur=null;for(const line of lines){if(line.startsWith('- Q:')){cur={q:line.replace('- Q:','').trim(),a:''};out.push(cur)}else if(line.trim().startsWith('A:')&&cur)cur.a=line.trim().replace(/^A:\s*/,'')}return out}
function reviewView(){
 if(state.mode==='study')return `<main class="screen">${brand('復習')}<section class="card ampc-landing"><h2>🧬 AmpCを集中復習</h2><p>以前勉強したECKH、CTRXの耐性化、CFPMとMEPMの判断を10問で確認。</p><button id="ampcQuizOpen" class="primary-btn">AmpCの10問に挑戦する ›</button></section><div id="reviewFeature" aria-live="polite"><section class="card review-panel">復習問題を準備しています…</section></div></main>${nav()}`;

 if(state.mode!=='study')return `<main class="screen">${brand('復習')}<section class="card review-panel"><h2>📘 学習モードで復習します</h2><p>臨床モードには原典未確認の練習問題を表示しません。学習モードへ切り替えてください。</p><button class="primary-btn" type="button" data-mode="study">学習モードへ切り替える ›</button></section></main>${nav()}`;
 return `<main class="screen">${brand('復習')}<div id="reviewFeature" aria-live="polite"><section class="card review-panel">復習問題を準備しています…</section></div></main>${nav()}`;
}
function openMemo(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="memoModal"><div class="sheet"><h2>今日覚えたこと</h2><textarea id="memoText" placeholder="あとで整理したいことを短くメモ"></textarea><div class="sheet-actions"><button class="cancel" id="memoCancel">キャンセル</button><button class="save" id="memoSave">保存</button></div></div></div>`);$('#memoCancel').onclick=()=>$('#memoModal').remove();$('#memoSave').onclick=()=>{const t=$('#memoText').value.trim();if(t){const arr=JSON.parse(localStorage.getItem('astPocketInbox')||'[]');arr.unshift({text:t,at:new Date().toISOString()});localStorage.setItem('astPocketInbox',JSON.stringify(arr))}$('#memoModal').remove()}}
function bindPage(){
  bindCommon();
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.mode;if(m!==state.mode&&(m==='clinical'||m==='study')){state.mode=m;try{localStorage.setItem('astPocketModeV2',m)}catch(e){}render(false);if(m==='study')void loadTextbooks().then(()=>{if(state.mode==='study')render(false)})}}));
  $('#openFeaturedNote')?.addEventListener('click',()=>{const n=state.notes.find(n=>n.fm.layout==='integrated');if(n)navigate('note',{selectedNote:n,noteOrigin:'home'});});
  $('#openReviewHome')?.addEventListener('click',()=>navigate('review'));
  $('#updateAppBtn')?.addEventListener('click',()=>{void checkLatestRelease(true)});
  $('#ampcStudyOpen')?.addEventListener('click',()=>openAmpc(false));
  $('#ampcQuizOpen')?.addEventListener('click',()=>openAmpc(true));
  if(state.view!=='search')document.querySelectorAll('[data-open-spectrum]').forEach(el=>el.addEventListener('click',openSpectrum));
  document.querySelectorAll('[data-spectrum-organism]').forEach(el=>el.addEventListener('click',()=>{
   if(state.mode!=='study'||!state.spectrumData)return;
   const id=el.dataset.spectrumOrganism;
   if(id!=='all'&&!state.spectrumData.columns.some(c=>c.id===id))return;
   state.spectrumOrganism=id;
   state.spectrumCell=null;
   render(false);
  }));
  document.querySelectorAll('[data-spectrum-cell]').forEach(el=>el.addEventListener('click',()=>{
   if(state.mode!=='study'||!state.spectrumData)return;
   const [drug,organism]=(el.dataset.spectrumCell||'').split(':');
   if(!state.spectrumData.rows.some(r=>r.id===drug)||!state.spectrumData.columns.some(c=>c.id===organism))return;
   state.spectrumCell=drug+':'+organism;
   render(false);
  }));
  document.querySelector('[data-spectrum-clear]')?.addEventListener('click',()=>{state.spectrumCell=null;render(false)});
  
  document.querySelectorAll('[data-open-textbook]').forEach(b=>b.addEventListener('click',()=>{
   if(state.mode!=='study')return;
   const id=b.dataset.openTextbook;
   if(!REVIEW_TEXTBOOKS.some(entry=>entry.id===id))return;
   navigate('textbook',{selectedTextbookId:id});
   if(!state.textbooks[id])void loadTextbooks().then(()=>{if(state.view==='textbook'&&state.mode==='study')render(false)});
  }));
  $('#openOrganizer')?.addEventListener('click',()=>navigate('library',{libraryCategory:'all'}));
  $('#openReviewQueue')?.addEventListener('click',()=>navigate('integration'));
  document.querySelectorAll('.open-generated-topic').forEach(b=>b.addEventListener('click',()=>navigate('topic',{selectedTopicId:b.dataset.topicId})));
  $('#openOrganizerFromNote')?.addEventListener('click',()=>navigate('library',{libraryCategory:'all'}));
  document.querySelectorAll('[data-library-cat]').forEach(b=>b.addEventListener('click',()=>{state.libraryCategory=b.dataset.libraryCat;render(false);}));
  document.querySelectorAll('.open-classified-note').forEach(b=>b.addEventListener('click',()=>{
    const note=state.notes.find(n=>n.path===b.dataset.note);
    if(note)navigate('note',{selectedNote:note,noteOrigin:'library'});
  }));
  document.querySelectorAll('.open-weekly-ref').forEach(b=>b.addEventListener('click',()=>{
    navigate('weekly',{selectedWeeklyPath:b.dataset.weeklyPath});
  }));
  document.querySelectorAll('[data-go-back]').forEach(b=>b.addEventListener('click',goBack));
  document.querySelectorAll('[data-ampc-tab]').forEach(b=>b.addEventListener('click',()=>{
   state.ampcTab=b.dataset.ampcTab;if(state.ampcTab==='quiz'&&!state.ampcOrder.length&&state.ampcQuestions.length)
    state.ampcOrder=rankAmpcQuestions(state.ampcQuestions,state.ampcProgress);
   render(false);
  }));
  document.querySelectorAll('input[name="ampcChoice"]').forEach(b=>b.addEventListener('change',()=>{
   state.ampcChoice=Number(b.value);render(false);
  }));
  document.querySelector('[data-ampc-reveal]')?.addEventListener('click',()=>{
   if(state.ampcChoice!==null){state.ampcRevealed=true;render(false)}
  });
  document.querySelectorAll('[data-ampc-rating]').forEach(b=>b.addEventListener('click',()=>{
   const rating=b.dataset.ampcRating;
   const id=state.ampcOrder[state.ampcIndex];
   if(!state.ampcRevealed||!id||!['again','hard','good','easy'].includes(rating))return;
   state.ampcProgress[id]={rating,completed_at:new Date().toISOString()};
   try{localStorage.setItem('astPocketAmpcStudyV1',JSON.stringify(state.ampcProgress))}catch(e){console.warn('Could not save AmpC progress',e)}
   state.ampcIndex++;state.ampcChoice=null;state.ampcRevealed=false;render(false);
  }));
  document.querySelector('[data-ampc-repeat]')?.addEventListener('click',()=>{
   state.ampcOrder=rankAmpcQuestions(state.ampcQuestions,state.ampcProgress);
   state.ampcIndex=0;state.ampcChoice=null;state.ampcRevealed=false;render(false);
  });
  document.querySelectorAll('[data-related]').forEach(b=>b.addEventListener('click',()=>navigate('search',{query:b.dataset.related,filter:'all'})));
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>navigate('search',{query:b.dataset.cat,filter:'all'}));
  $('#goWeekly')?.addEventListener('click',()=>navigate('weekly',{selectedWeeklyPath:null}));
  $('#weeklyPicker')?.addEventListener('change',e=>{state.selectedWeeklyPath=e.target.value;render(false)});
  if(state.view==='search')bindSearchPanel();
  $('#latestBtn')?.addEventListener('click',()=>alert('Ver.1では「最新情報を確認」の導線まで実装。次段階でWeb検索・差分確認を接続します。'));
  document.querySelectorAll('.q-row').forEach(q=>q.onclick=()=>q.classList.toggle('open'));
  if(state.view==='review'&&state.mode==='study')void reviewFeature.mount();
  if((state.view==='topic'||state.view==='note'||state.view==='textbook')&&document.querySelector('.template-screen')&&state.mode==='study'){
    bindTemplateReader(document.querySelector('.template-screen'),{rerender:()=>render(false)});
  }
  if(state.view==='note'&&state.selectedNote?.path===MSSA_PATH&&state.mode==='study'){
    bindMssaReader(document.querySelector('.mssa-screen'),{rerender:()=>render(false)});
  }
}

function render(scroll=true){stopMssaReader();stopTemplateReader();let html='';if(state.view==='home')html=home();else if(state.view==='search')html=searchResults();else if(state.view==='note')html=noteView();else if(state.view==='library')html=libraryView();else if(state.view==='topic')html=dynamicTopicView();else if(state.view==='textbook')html=textbookView();else if(state.view==='ampc')html=ampcView();else if(state.view==='spectrum')html=spectrumView();else if(state.view==='integration')html=integrationReviewView();else if(state.view==='weekly')html=weeklyView();else html=reviewView();app.innerHTML=html;
 const main=app.querySelector('main.screen');
 if(main && navigationStack.length){
  const place=main.querySelector('.mode-toggle');
  if(place)place.insertAdjacentHTML('afterend',backMarkup());
  else main.insertAdjacentHTML('afterbegin',backMarkup());
  if(state.view==='weekly')main.insertAdjacentHTML('beforeend',backMarkup());
 }
 if(scroll)window.scrollTo({top:0,behavior:'instant'});
 // Reset scrolling before reader listeners attach, or opening the page could overwrite the prior bookmark.
 bindPage()}
if(typeof window.addEventListener==='function'){
 window.addEventListener('pageshow',()=>{void checkLatestRelease(false)});
}
if(typeof document.addEventListener==='function'){
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkLatestRelease(false)});
}
load().catch(err=>{console.error(err);app.innerHTML='<div class="screen"><div class="card empty">AST Pocketの読み込みに失敗しました。ローカルではHTTPサーバー経由で開いてください。</div></div>'});
