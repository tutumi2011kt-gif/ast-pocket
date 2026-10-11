/**
 * AST Pocket reusable reading templates for six topic categories.
 *
 * Medical content remains in public, de-identified source Markdown.
 * These chapter titles, routing hints and reading bookmarks are UI metadata,
 * never evidence of clinical correctness or approval.
 */
export const NOTE_TEMPLATES={
 organism:[
 ['basics','菌の特徴・分類'],['colonization','感染・定着・汚染の見極め'],
 ['infections','代表的な感染症'],['resistance','自然耐性・耐性機序'],
 ['treatment','感受性・抗菌薬の考え方'],['ast','ASTでの確認事項'],
 ['cases','検査結果・症例で学ぶ'],['evidence','根拠・更新履歴']
 ],
 drug:[
 ['basics','作用機序・薬剤の特徴'],['spectrum','抗菌スペクトラム'],
 ['treatment','適応・使い分け'],['dosing','用量・投与設計'],
 ['renal','腎機能・肝機能・透析'],['pkpd','PK/PD・TDM'],
 ['safety','副作用・相互作用'],['evidence','根拠・更新履歴']
 ],
 infection:[
 ['basics','病態・原因菌'],['diagnosis','検査・診断'],
 ['treatment','抗菌薬の選択と根拠'],['source','感染源・合併症'],
 ['duration','治療期間・フォロー'],['ast','AST介入のポイント'],
 ['cases','症例で考える'],['evidence','根拠・更新履歴']
 ],
 culture:[
 ['basics','検査の目的・基本'],['sampling','検体採取と汚染'],
 ['microscopy','Gram染色・迅速検査'],['identification','菌種の同定'],
 ['interpretation','陽性結果の解釈'],['followup','再検査・フォロー'],
 ['ast','ASTでの相談と提案'],['evidence','根拠・更新履歴']
 ],
 ast:[
 ['initial','相談の初期対応'],['patient','必要な患者情報'],
 ['interpretation','培養・感受性の解釈'],['treatment','抗菌薬評価の手順'],
 ['source','感染源コントロール'],['proposal','医師への提案'],
 ['cases','架空症例・判断演習'],['evidence','根拠・更新履歴']
 ],
 cross:[
 ['basics','横断テーマの基本'],['mechanism','背景・機序'],
 ['diagnosis','検査と評価'],['treatment','薬剤・治療での注意'],
 ['dosing','腎機能・投与設計'],['safety','副作用・リスク'],
 ['ast','ASTでの応用'],['evidence','根拠・更新履歴']
 ]
};
export const NOTE_CATEGORIES=Object.freeze(Object.keys(NOTE_TEMPLATES));
export const getChapters=category=>(NOTE_TEMPLATES[category]||NOTE_TEMPLATES.cross).map(([id,title],index)=>({id,title,index}));
export const getCategory=category=>NOTE_TEMPLATES[category]?category:'cross';

const RULES=[
 [/ガイドライン|論文|原著|根拠|改訂|文献/i,{organism:'evidence',drug:'evidence',infection:'evidence',culture:'evidence',ast:'evidence',cross:'evidence'}],
 [/高K|高カリウム|副作用|有害事象|相互作用|禁忌|腎毒性/i,{drug:'safety',cross:'safety'}],
 [/腎機能|腎障害|透析|肝機能|Ccr|eGFR/i,{drug:'renal',cross:'dosing'}],
 [/TDM|AUC|PK\/PD|トラフ|MIC/i,{drug:'pkpd',cross:'dosing'}],
 [/用量|投与量|投与間隔|投与設計/i,{drug:'dosing',cross:'dosing',ast:'treatment'}],
 [/心内膜炎|深部感染|感染源|ドレナージ|デバイス抜去|カテーテル/i,{infection:'source',ast:'source',organism:'infections'}],
 [/再血培|再血液培養|血培陰性化|培養再検|フォローアップ血液培養/i,{infection:'diagnosis',culture:'followup',ast:'interpretation'}],
 [/持続菌血症|持続陽性|血液培養|血培|グラム染色|GPC|GNR|CoNS/i,{infection:'diagnosis',culture:'interpretation',organism:'cases',ast:'interpretation'}],
 [/汚染|コンタミ|保菌|定着|colonization/i,{organism:'colonization',culture:'sampling'}],
 [/ESBL|AmpC|CRE|耐性|感受性/i,{organism:'resistance',cross:'mechanism',culture:'interpretation',ast:'interpretation',drug:'spectrum'}],
 [/治療期間|終了日|中止時期|陰性化後|日数|14日/i,{infection:'duration',ast:'treatment'}],
 [/症例|相談|提案|介入/i,{infection:'ast',organism:'ast',ast:'proposal',cross:'ast'}],
 [/抗菌薬|抗真菌薬|CEZ|MEPM|VCM|ST合剤|de.?escalation|経口切替|投与|治療/i,{infection:'treatment',organism:'treatment',drug:'treatment',ast:'treatment',cross:'treatment'}]
];
const MSSA_SECTION_CHAPTER={
 '初期評価・感染源':'source','再血培と持続菌血症':'diagnosis',
 '感染性心内膜炎・深部感染':'source','抗菌薬の評価':'treatment',
 '治療期間とフォロー':'duration'
};
/** Abstain (unclassified) when deterministic keywords cannot assign a safe chapter. */
export function routeLearningChapter(category,text,{notePath='',targetSection=''}={}){
 const kind=getCategory(category);
 if(kind==='infection'&&notePath==='content/notes/mssa-bacteremia.md'&&MSSA_SECTION_CHAPTER[targetSection]){
  return {chapter_id:MSSA_SECTION_CHAPTER[targetSection],routing:'section_rule_v1'};
 }
 const source=String(text||'');
 for(const [pattern,targets] of RULES){
  if(pattern.test(source)&&targets[kind]&&getChapters(kind).some(c=>c.id===targets[kind])){
   return {chapter_id:targets[kind],routing:'keyword_rule_v1'};
  }
 }
 return {chapter_id:'unclassified',routing:'needs_classification'};
}
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bullets=s=>String(s||'').split('\n').filter(x=>/^[-*]\s+/.test(x)).map(x=>x.replace(/^[-*]\s+/,''));
const ordered=entries=>'<ul>'+entries.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>';
const k=id=>'astPocketNotebookV1:'+String(id).replace(/[^a-z0-9:-]/gi,'').slice(0,96);
export function readNotebookPrefs(id,category,storage=globalThis.localStorage){
 const chapterIds=new Set(getChapters(category).map(x=>x.id));
 const def={depth:'deep',open:[],lastChapter:null,scrollY:0};
 try{
  const v=JSON.parse(storage.getItem(k(id))||'null');if(v?.version!==1)return def;
  return {depth:v.depth==='simple'?'simple':'deep',
   open:Array.isArray(v.open)?[...new Set(v.open.filter(x=>chapterIds.has(x)))]:[],
   lastChapter:chapterIds.has(v.lastChapter)?v.lastChapter:null,
   scrollY:Number.isFinite(v.scrollY)?Math.max(0,Math.min(100000,v.scrollY)):0};
 }catch{return def}
}
export function writeNotebookPrefs(id,category,prefs,storage=globalThis.localStorage){
 const valid=new Set(getChapters(category).map(x=>x.id));
 const value={version:1,depth:prefs.depth==='simple'?'simple':'deep',
  open:Array.isArray(prefs.open)?[...new Set(prefs.open.filter(x=>valid.has(x)))]:[],
  lastChapter:valid.has(prefs.lastChapter)?prefs.lastChapter:null,
  scrollY:Number.isFinite(prefs.scrollY)?Math.max(0,Math.min(100000,prefs.scrollY)):0};
 try{storage.setItem(k(id),JSON.stringify(value));return true}catch{return false}
}
function sectionChapter(category,section){
 const name=String(section||'');
 if(/^安全上|^落とし穴|^根拠|^関連ノート/.test(name))return 'evidence';
 if(/^まず覚える|^30秒要約/.test(name))return 'basics';
 if(/^ASTで確認/.test(name))return 'ast';
 return routeLearningChapter(category,name).chapter_id;
}
export function renderTemplateNotebook({
 id,title,category,mode='study',subtitle='',sections={},links=[],fragmentForLink=()=>'',historyHtml='',modeHtml='',notesMeta={}
}={}){
 const kind=getCategory(category),chapters=getChapters(kind),prefs=readNotebookPrefs(id,kind),clinical=mode==='clinical';
 const matched=chapters.map(c=>({...c,sourceSections:Object.keys(sections).filter(name=>sectionChapter(kind,name)===c.id),
  assignments:links.filter(l=>l.chapter_id===c.id)}));
 const unknown=links.filter(l=>l.chapter_id==='unclassified'||!chapters.some(c=>c.id===l.chapter_id));
 const warning='<div class="draft-alert" role="note"><strong>⚠️ 原典確認待ち・学習用</strong>'+
  '<p>自動分類はルールベースです。内容の正しさ、引用先との一致、国内での適用は未確認です。</p></div>';
 let out='<main class="screen integrated-screen template-screen" data-template-reader="'+h(id)+'" data-template-category="'+h(kind)+'">'+
  '<div class="note-head"></div>'+modeHtml+
  '<header class="integrated-heading"><div class="eyebrow">'+h(kind)+' ／ 詳細型ノート</div><h1>'+h(title||'学習ノート')+'</h1>'+
  (subtitle?'<p>'+h(subtitle)+'</p>':'')+'</header>'+warning;
 if(clinical)return out+
  '<section class="card integrated-card"><h2>⚡ 臨床用の要約は原典確認待ち</h2><p>学習用の自動整理内容は臨床モードに表示しません。確認済みの推奨を独立した原典で確認してください。</p>'+
  '<button type="button" class="primary-btn" data-mode="study">学習モードで確認する ›</button></section></main>';
 out+='<section class="card integrated-card"><h2>⚡ 全体像</h2><p class="small-note">テーマ別の学習メモを章ごとに整理しています。自動要約や医学的な妥当性認定は行いません。</p>'+
  '<p class="small-note">章を選ぶと、元のWeeklyの情報源までたどれます。</p></section>';
 out+='<section class="card integrated-card template-controls"><h2>📖 詳しく学ぶ</h2>'+
  '<p class="small-note">章の開閉と読書位置は端末内だけに保存。医学的な確認状態とは無関係です。</p>'+
  '<div class="mssa-depth"><button type="button" data-template-depth="simple" aria-pressed="'+(prefs.depth==='simple')+'" class="'+(prefs.depth==='simple'?'selected':'')+'">要点</button>'+
  '<button type="button" data-template-depth="deep" aria-pressed="'+(prefs.depth==='deep')+'" class="'+(prefs.depth==='deep'?'selected':'')+'">詳しく</button></div>'+
  '<button type="button" id="templateResume" class="mssa-resume" '+(prefs.lastChapter?'':'disabled')+'>'+
  (prefs.lastChapter?'↩ 前回の続きから再開':'前回の読書位置はありません')+'</button>'+
  '<nav class="mssa-toc" aria-label="章の目次">'+chapters.map(c=>'<button type="button" class="mssa-toc-button" data-template-jump="'+h(c.id)+'">'+h(c.index+1)+'. '+h(c.title)+' ›</button>').join('')+'</nav></section>';
 out+='<section class="card integrated-card"><h2>📚 分野別の詳細ノート</h2>';
 for(const c of matched){
  const count=c.sourceSections.length+c.assignments.length;
  out+='<details class="mssa-chapter" data-template-chapter="'+h(c.id)+'" '+(prefs.open.includes(c.id)?'open':'')+'>'+
   '<summary><strong>'+h(c.index+1)+'. '+h(c.title)+'</strong><small>関連資料・学習候補 '+count+'件</small></summary><div class="mssa-chapter-body">';
  if(c.id==='evidence')out+='<p class="small-note">ノートの原典照合は未完了。リンクの存在や分類は医学的な承認を意味しません。</p>'+
   (notesMeta.source?'<p>登録された出典の表記：'+h(notesMeta.source)+'</p>':'')+
   (notesMeta.last_reviewed?'<p>登録上の最終確認日：'+h(notesMeta.last_reviewed)+'（原典照合の証跡は別途必要）</p>':'');
  if(!count)out+='<p class="small-note">この章の内容はまだ登録されていません。</p>';
  else{
   for(const name of c.sourceSections){
    const list=bullets(sections[name]);
    out+='<div class="template-source-note"><h4>'+h(name)+'</h4>'+
     (list.length?ordered(prefs.depth==='simple'?list.slice(0,2):list):'<p class="small-note">'+h(sections[name])+'</p>')+'</div>';
   }
   for(const link of (prefs.depth==='simple'?c.assignments.slice(0,2):c.assignments)){
    out+='<div class="template-sourced-item">'+fragmentForLink(link)+'</div>';
   }
   if(prefs.depth==='simple'&&c.assignments.length>2)out+='<p class="small-note">ほかに'+(c.assignments.length-2)+'件。詳しく表示で確認できます。</p>';
  }
  out+='</div></details>';
 }
 out+='</section>';
 if(unknown.length)out+='<section class="card integrated-card"><h2>🗂 未分類・確認待ち '+unknown.length+'件</h2>'+
  '<p class="small-note">安全な章の推定ができないため、無理に分類せず保留しました。</p>'+
  unknown.map(l=>'<div class="template-sourced-item">'+fragmentForLink(l)+'</div>').join('')+'</section>';
 if(historyHtml)out+='<section class="card integrated-card"><h2>🗓 元の学習履歴</h2>'+historyHtml+'</section>';
 return out+'</main>';
}
let stop=()=>{};
export function stopTemplateReader(){stop();stop=()=>{}}
export function bindTemplateReader(root,{rerender,win=globalThis.window,storage=globalThis.localStorage}={}){
 stopTemplateReader();
 if(!root?.dataset?.templateReader)return;
 const id=root.dataset.templateReader,cat=root.dataset.templateCategory;
 let prefs=readNotebookPrefs(id,cat,storage),scrollTimer=null;
 const capture=()=>{
  prefs.open=[...root.querySelectorAll('[data-template-chapter]')].filter(x=>x.open).map(x=>x.dataset.templateChapter);
  prefs.scrollY=win.scrollY||0;writeNotebookPrefs(id,cat,prefs,storage);
 };
 const initial=new Set(prefs.open);
 root.querySelectorAll('[data-template-chapter]').forEach(el=>el.addEventListener('toggle',()=>{
  const chapter=el.dataset.templateChapter;
  if(initial.has(chapter)===el.open)return;
  if(el.open)initial.add(chapter);else initial.delete(chapter);
  if(el.open)prefs.lastChapter=chapter;
  capture();
 }));
 const jump=chapter=>{
  const node=[...root.querySelectorAll('[data-template-chapter]')].find(x=>x.dataset.templateChapter===chapter);
  if(!node)return;
  node.open=true;prefs.lastChapter=chapter;capture();
  node.scrollIntoView({block:'start',behavior:'smooth'});
 };
 root.querySelectorAll('[data-template-jump]').forEach(btn=>btn.addEventListener('click',()=>jump(btn.dataset.templateJump)));
 root.querySelector('#templateResume')?.addEventListener('click',()=>{
  const saved=readNotebookPrefs(id,cat,storage);
  if(!saved.lastChapter)return;
  const el=[...root.querySelectorAll('[data-template-chapter]')].find(x=>x.dataset.templateChapter===saved.lastChapter);
  if(el)el.open=true;
  if(saved.scrollY>0)win.scrollTo({top:saved.scrollY,behavior:'smooth'});
  else jump(saved.lastChapter);
 });
 root.querySelectorAll('[data-template-depth]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!['simple','deep'].includes(btn.dataset.templateDepth)||btn.dataset.templateDepth===prefs.depth)return;
  prefs.depth=btn.dataset.templateDepth;capture();
  const y=win.scrollY||0;rerender?.();
  win.requestAnimationFrame?.(()=>win.scrollTo({top:y,behavior:'instant'}));
 }));
 const onScroll=()=>{
  if(scrollTimer!==null)clearTimeout(scrollTimer);
  scrollTimer=setTimeout(()=>{
   scrollTimer=null;if(!root.isConnected)return;
   for(const el of root.querySelectorAll('[data-template-chapter]')){
    const r=el.getBoundingClientRect();
    if(r.top<=180&&r.bottom>130)prefs.lastChapter=el.dataset.templateChapter;
   }
   capture();
  },250);
 };
 win.addEventListener?.('scroll',onScroll,{passive:true});
 stop=()=>{win.removeEventListener?.('scroll',onScroll);if(scrollTimer!==null)clearTimeout(scrollTimer)};
}
