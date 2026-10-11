/**
 * AST Pocket detailed MSSA notebook.
 * Draft Markdown is reorganized for reading, never certified as clinical advice.
 * Bookmarks contain only known chapter IDs, chosen detail level and scroll offset.
 */
export const MSSA_PATH='content/notes/mssa-bacteremia.md';
export const MSSA_CHAPTERS=[
 {id:'basics',title:'1. 基礎知識・病態',sub:'MSSAとMRSA、菌血症の基本',sections:['30秒要約']},
 {id:'culture',title:'2. 検査・診断・再血培',sub:'培養結果・持続菌血症・陰性化',sections:['再血培と持続菌血症']},
 {id:'antibiotics',title:'3. 抗菌薬の選択と考え方',sub:'標的治療と抗菌薬評価',sections:['抗菌薬の評価']},
 {id:'source',title:'4. 感染源・合併症',sub:'感染源コントロール・心内膜炎',sections:['初期評価・感染源','感染性心内膜炎・深部感染']},
 {id:'duration',title:'5. 治療期間・フォロー',sub:'陰性化・合併症・感染源を考慮',sections:['治療期間とフォロー']},
 {id:'ast',title:'6. AST介入の実務',sub:'確認事項と提案の組み立て',sections:['ASTで確認']},
 {id:'cases',title:'7. 架空症例で考える',sub:'臨床推論の練習',sections:['ミニ復習']},
 {id:'evidence',title:'8. エビデンス・更新履歴',sub:'確認状況・外部原典・更新情報',sections:['安全上の注意']}
];
const known=new Set(MSSA_CHAPTERS.map(c=>c.id));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=s=>String(s||'').split('\n').filter(x=>/^[-*]\s/.test(x)).map(x=>x.replace(/^[-*]\s+/,''));
const key=id=>'astPocketNoteReaderV1:'+String(id||'').replace(/[^a-z0-9-]/gi,'').slice(0,64);
export function readMssaPrefs(id,storage=globalThis.localStorage){
 const def={depth:'deep',open:['culture'],lastChapter:null,scrollY:0};
 try{
  const v=JSON.parse(storage.getItem(key(id))||'null');
  if(v?.v!==1)return def;
  return {depth:v.depth==='simple'?'simple':'deep',
   open:Array.isArray(v.open)?[...new Set(v.open.filter(x=>known.has(x)))]:['culture'],
   lastChapter:known.has(v.lastChapter)?v.lastChapter:null,
   scrollY:Number.isFinite(v.scrollY)?Math.max(0,Math.min(100000,v.scrollY)):0};
 }catch{return def}
}
export function saveMssaPrefs(id,prefs,storage=globalThis.localStorage){
 const safe={v:1,depth:prefs.depth==='simple'?'simple':'deep',
  open:Array.isArray(prefs.open)?[...new Set(prefs.open.filter(x=>known.has(x)))]:[],
  lastChapter:known.has(prefs.lastChapter)?prefs.lastChapter:null,
  scrollY:Number.isFinite(prefs.scrollY)?Math.max(0,Math.min(100000,prefs.scrollY)):0,
  updatedAt:new Date().toISOString()};
 try{storage.setItem(key(id),JSON.stringify(safe));return true}catch{return false}
}
const ul=arr=>'<ul>'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
function qa(s){
 const matches=[...String(s||'').matchAll(/(?:^|\n)[-*]\s*Q:\s*(.+)\n\s*A:\s*(.+)/g)];
 return matches.length?matches.map((m,i)=>'<details class="detail-panel"><summary>Q'+(i+1)+'. '+esc(m[1])+'</summary><p class="model-answer">'+esc(m[2])+'</p></details>').join(''):'<p>復習問題の準備中です。</p>';
}
function expanded(ch,n){
 const s=n.sections||{};
 if(ch.id==='cases')return '<p class="small-note">架空症例です。実際の患者情報は使用していません。</p>'+
  '<div class="mssa-case"><strong>架空症例</strong><p>MSSA菌血症の標的治療中も再血培が陽性。さらに背部痛がある。ASTで追加確認することは？</p>'+
  '<details class="detail-panel"><summary>考え方の例を開く</summary><p>感染源コントロール、深部感染・感染性心内膜炎の可能性、血培の推移、感受性・投与設計などを再評価する。</p>'+
  '<p class="small-note">既存の原典未確認ノートから構成した学習用の例です。</p></details></div><h4>ミニ復習</h4>'+qa(s['ミニ復習']);
 if(ch.id==='evidence')return '<div class="mssa-evidence"><p><strong>ノート状態：</strong>'+esc(n.fm.status||'draft')+
  '（原典照合待ち）</p><p><strong>出典：</strong>'+esc(n.fm.source||'未設定')+
  '</p><p><strong>医学的原典の最終確認：</strong>'+esc(n.fm.last_reviewed||'未実施')+
  '</p><p><strong>画面・構造の更新：</strong>'+esc(n.fm.last_structural_update||'未記録')+
  '（医学的な承認日ではありません）</p><p><a href="https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/" rel="noopener noreferrer" target="_blank">原典候補：IDSA/ESCMID菌血症コンセンサス ↗</a></p>'+
  '<p class="small-note">原典リンクの掲載だけで本文の医学的な正しさを保証するものではありません。</p></div>'+
  '<h4>安全上の注意</h4>'+ul(lines(s['安全上の注意']));
 let out=ch.sections.map(section=>'<div class="mssa-chapter-block"><h4>'+esc(section)+'</h4>'+ul(lines(s[section]))+'</div>').join('');
 if(ch.id==='antibiotics')out+='<h4>比較して考える（原典未確認）</h4><div class="mssa-table-wrap"><table class="mssa-compare">'+
  '<thead><tr><th scope="col">分類</th><th scope="col">確認すること</th></tr></thead><tbody>'+
  '<tr><th scope="row">MSSA</th><td>感受性・感染部位に応じてβラクタム薬などの標的治療を検討。既存ノートではCEZを候補として記載。</td></tr>'+
  '<tr><th scope="row">MRSA</th><td>MSSAと区別して感受性・感染部位・患者背景に基づく治療選択を検討。</td></tr></tbody></table></div>'+
  '<p class="small-note">学習用の比較表です。臨床処方の推奨ではありません。</p>';
 if(ch.id==='culture'||ch.id==='ast')out+='<h4>判断の流れ（教育用）</h4><ol class="mssa-flow">'+
  '<li>菌種・培養結果・経過を確認</li><li>感染源と合併症の可能性を整理</li>'+
  '<li>治療と感染源コントロールを再評価</li><li>確認した事実と提案を区別してまとめる</li></ol>'+
  '<p class="small-note">概念的な確認順です。実際の患者への診療アルゴリズムではありません。</p>';
 if(ch.id==='duration')out+='<p class="small-note">具体的な治療日数はこの原典未確認のノートでは確定していません。</p>';
 return out;
}
function chapter(ch,n,prefs){
 const brief=ch.sections.flatMap(section=>lines(n.sections?.[section])).slice(0,2);
 const body=prefs.depth==='simple'?'<h4>まず覚える</h4>'+ul(brief):expanded(ch,n);
 return '<details id="mssa-'+esc(ch.id)+'" data-mssa-chapter="'+esc(ch.id)+'" class="mssa-chapter" '+(prefs.open.includes(ch.id)?'open':'')+'>'+
  '<summary><strong>'+esc(ch.title)+'</strong><small>'+esc(ch.sub)+'</small></summary>'+
  '<div class="mssa-chapter-body">'+body+'</div></details>';
}
export function renderMssaNotebook(n,config={}){
 const clinical=config.mode==='clinical',id=n.fm?.id||'mssa',prefs=readMssaPrefs(id);
 const tags=String(n.fm?.tags||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,6);
 const heading='<div class="note-head"></div>'+(config.modeHtml||'')+
  '<header class="integrated-heading"><div class="eyebrow">感染症 ＞ 血流感染</div><h1>'+esc(n.fm?.title||'MSSA菌血症')+'</h1>'+
  '<p>'+esc(n.fm?.ja||'')+'</p><div class="tags">'+tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div></header>'+
  '<div class="draft-alert" role="note"><strong>⚠️ 学習用ノート・原典確認待ち（draft）</strong>'+
  '<p>最新の原典・添付文書・施設基準の確認が必要です。治療推奨の確定版ではありません。</p></div>';
 const check=lines(n.sections?.['ASTで確認']),summary=lines(n.sections?.['30秒要約']);
 if(clinical)return '<main class="screen integrated-screen mssa-screen" data-mssa-note="'+esc(id)+'">'+heading+
  '<section class="card integrated-card"><h2>⚡ 30秒で確認（正式版準備中）</h2>'+
  '<p>このMSSAノートは医学的な原典確認が済んでいません。確認済みの臨床用要約はまだありません。</p>'+
  '<button type="button" class="primary-btn" data-mode="study">詳細ノートで学ぶ ›</button></section>'+
  '<section class="card integrated-card"><h2>📋 ASTで情報収集する項目案</h2>'+
  '<p class="small-note">以下は原典未確認のチェックリストです。患者情報は入力・保存されません。</p>'+
  '<ul class="quick-checks">'+check.map(s=>'<li><label><input type="checkbox"/> <span>'+esc(s)+'</span></label></li>').join('')+'</ul></section>'+
  '<section class="card integrated-card"><h2>📚 根拠と更新状態</h2><p>原典確認待ち。臨床用の推奨事項として使用しないでください。</p></section></main>';
 const toc=MSSA_CHAPTERS.map(c=>'<button type="button" data-mssa-jump="'+esc(c.id)+'" class="mssa-toc-button">'+esc(c.title)+' <span>›</span></button>').join('');
 return '<main class="screen integrated-screen mssa-screen" data-mssa-note="'+esc(id)+'">'+heading+
  '<section class="card integrated-card"><h2>⚡ 30秒で全体像</h2><ol class="brief-points">'+summary.map(x=>'<li>'+esc(x)+'</li>').join('')+
  '</ol><p class="small-note">既存のdraft内容に基づく学習用の要約です。臨床推奨ではありません。</p></section>'+
  '<section class="card integrated-card"><h2>📋 ASTで確認すること</h2><p class="small-note">確認項目の下書き。患者情報は入力しないでください。</p>'+ul(check)+'</section>'+
  '<section class="card integrated-card mssa-reading-controls"><h2>📖 詳細学習</h2>'+
  '<p class="small-note">要点と詳しい解説を切り替えられます。開いた章・前回読んだ位置はこの端末だけに保存します。</p>'+
  '<div class="mssa-depth" role="group" aria-label="学習ノートの詳しさ">'+
  '<button type="button" data-mssa-depth="simple" aria-pressed="'+(prefs.depth==='simple')+'" class="'+(prefs.depth==='simple'?'selected':'')+'">要点</button>'+
  '<button type="button" data-mssa-depth="deep" aria-pressed="'+(prefs.depth==='deep')+'" class="'+(prefs.depth==='deep'?'selected':'')+'">詳しく</button></div>'+
  '<button type="button" class="mssa-resume" id="mssaResume" '+(prefs.lastChapter?'':'disabled')+'>'+
  (prefs.lastChapter?'↩ 前回の続きから再開':'まだ再開位置はありません')+'</button>'+
  '<nav class="mssa-toc" aria-label="ノートの目次">'+toc+'</nav></section>'+
  '<section class="card integrated-card mssa-chapters"><h2>📚 8章の学習ノート</h2>'+
  MSSA_CHAPTERS.map(c=>chapter(c,n,prefs)).join('')+'</section>'+
  (config.weeklyHtml?'<section class="card integrated-card"><h2>🗂 Weeklyからの学習メモ</h2>'+
  '<p class="small-note">原典未確認の追加候補。正式な医学的Knowledgeには自動統合しません。</p>'+config.weeklyHtml+'</section>':'')+
  (config.classifiedHtml?'<section class="card integrated-card"><h2>🗂 Weeklyから自動整理した学習</h2>'+
  '<p class="small-note">未確認の学習ログです。臨床用の推奨として扱わないでください。</p>'+config.classifiedHtml+'</section>':'')+
  (config.relatedHtml?'<section class="card integrated-card"><h2>🔗 関連ノート・検索</h2>'+config.relatedHtml+'</section>':'')+
  '</main>';
}
let cleanReader=()=>{};
export function stopMssaReader(){cleanReader();cleanReader=()=>{}}
export function bindMssaReader(root,{rerender,win=globalThis.window,storage=globalThis.localStorage}={}){
 stopMssaReader();
 if(!root?.dataset?.mssaNote)return;
 const id=root.dataset.mssaNote;
 let prefs=readMssaPrefs(id,storage),timer=null;
 const save=()=>{
  prefs={...prefs,open:[...root.querySelectorAll('[data-mssa-chapter]')].filter(x=>x.open).map(x=>x.dataset.mssaChapter),
   scrollY:win.scrollY||0};
  saveMssaPrefs(id,prefs,storage);
 };
 const jump=(name)=>{
  if(!known.has(name))return;
  const node=root.querySelector('[data-mssa-chapter="'+name+'"]');
  if(!node)return;
  node.open=true;prefs.lastChapter=name;save();
  node.scrollIntoView({block:'start',behavior:'smooth'});
 };
 const previouslyOpen=new Set(prefs.open);
 root.querySelectorAll('[data-mssa-chapter]').forEach(el=>el.addEventListener('toggle',()=>{
  const chapterId=el.dataset.mssaChapter;
  // Initial <details open> can dispatch a toggle event. It must not overwrite a bookmark.
  if(previouslyOpen.has(chapterId)===el.open)return;
  if(el.open)previouslyOpen.add(chapterId);else previouslyOpen.delete(chapterId);
  if(el.open)prefs.lastChapter=chapterId;
  save();
 }));
 root.querySelectorAll('[data-mssa-jump]').forEach(el=>el.addEventListener('click',()=>jump(el.dataset.mssaJump)));
 root.querySelector('#mssaResume')?.addEventListener('click',()=>{
  const saved=readMssaPrefs(id,storage);
  if(!saved.lastChapter)return;
  const node=root.querySelector('[data-mssa-chapter="'+saved.lastChapter+'"]');
  if(node)node.open=true;
  if(saved.scrollY>0)win.scrollTo({top:saved.scrollY,behavior:'smooth'});
  else jump(saved.lastChapter);
 });
 root.querySelectorAll('[data-mssa-depth]').forEach(el=>el.addEventListener('click',()=>{
  const depth=el.dataset.mssaDepth;
  if(depth===prefs.depth||!['simple','deep'].includes(depth))return;
  prefs.depth=depth;save();
  const y=win.scrollY||0;
  rerender?.();
  win.requestAnimationFrame?.(()=>win.scrollTo({top:y,behavior:'instant'}));
 }));
 const onScroll=()=>{
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{
   timer=null;if(!root.isConnected)return;
   for(const el of root.querySelectorAll('[data-mssa-chapter]')){
    const box=el.getBoundingClientRect();
    if(box.top<=180&&box.bottom>130)prefs.lastChapter=el.dataset.mssaChapter;
   }
   save();
  },250);
 };
 win.addEventListener?.('scroll',onScroll,{passive:true});
 cleanReader=()=>{win.removeEventListener?.('scroll',onScroll);if(timer!==null)clearTimeout(timer);};
}
