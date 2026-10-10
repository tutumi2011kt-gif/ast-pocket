const state={mode:'clinical',noteOrigin:'search',view:'home',query:'',filter:'all',notes:[],weekly:[],organisms:[],antibiotics:[],review:[],selectedNote:null,selectedWeeklyPath:null};
const $=s=>document.querySelector(s); const app=$('#app');
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

async function load(){
  const [org,abx,idx,review]=await Promise.all([
    fetch('data/organisms.json').then(r=>r.json()),fetch('data/antibiotics.json').then(r=>r.json()),fetch('content/index.json').then(r=>r.json()),fetch('content/review/questions.json').then(r=>r.json())
  ]); state.organisms=org;state.antibiotics=abx;state.review=review;
  state.notes=await Promise.all(idx.notes.map(async p=>parseMD(await fetch(p).then(r=>r.text()),p)));
  state.weekly=await Promise.all(idx.weekly.map(async p=>parseMD(await fetch(p).then(r=>r.text()),p)));
  state.weekly.sort((a,b)=>b.path.localeCompare(a.path));
  render();
}
function brand(sub='感染症ナレッジ'){return `<div class="brand"><div><h1><span class="ast">AST</span> Pocket</h1><p>${sub}</p></div><div class="brand-mark">🩺</div></div>${modeControl()}`}
function modeControl(){return `<div class="mode-toggle" role="group" aria-label="AST Pocket表示モード"><button type="button" data-mode="clinical" class="${state.mode==='clinical'?'selected':''}" aria-pressed="${state.mode==='clinical'}">🩺 臨床モード</button><button type="button" data-mode="study" class="${state.mode==='study'?'selected':''}" aria-pressed="${state.mode==='study'}">📘 学習モード</button></div>`}
function searchBox(){return `<div class="searchbox"><span class="search-icon">⌕</span><input id="searchInput" value="${esc(state.query)}" placeholder="菌・抗菌薬・感染症を検索" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"/><button class="clear-btn ${state.query?'':'hidden'}" id="clearSearch" type="button">×</button></div>`}
function nav(){return `<nav class="bottom-nav"><div class="inner">${[['home','Home'],['search','Search'],['weekly','Weekly'],['review','Review']].map(([v,l])=>`<button class="nav-btn ${state.view===v?'active':''}" data-nav="${v}"><span class="nav-icon">${icons[v]}</span>${l}</button>`).join('')}</div></nav><button class="fab" id="fab">＋</button>`}
function bindCommon(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    clearTimeout(searchTimer);
    state.view=b.dataset.nav;
    state.query='';
    render();
  });
  $('#fab').onclick=openMemo;
  const inp=$('#searchInput');
  if(!inp)return;

  // On the Home screen, move to Search as soon as the field receives focus,
  // before the user starts flick input. Once on Search, the input node is kept alive.
  inp.addEventListener('focus',()=>{
    if(state.view==='home'){
      state.view='search';
      render(false);
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
  const fcard=featured?`<section class="card featured-note"><div class="eyebrow">📖 分野別統合ノート・第1号</div><h2>${esc(featured.fm.title)}</h2><p>30秒要約／詳細学習／関連する菌・抗菌薬</p><span class="draft-label">学習用・原典確認待ち</span><button type="button" id="openFeaturedNote" class="primary-btn">MSSA菌血症ノートを開く ›</button></section>`:'';
  const weekCard=w?`<div class="section-title">🎓 今週の学習</div><section class="card weekly-card"><strong>📅 ${esc(w.fm.week||'今週')}</strong><ul>${mdList(w.sections['今週の学習']).slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><button class="primary-btn" id="goWeekly">今週のまとめを見る ›</button></section>`:'';
  if(state.mode==='study')return `<main class="screen">${brand('感染症を学び、ASTの判断力を育てる')}${searchBox()}<section class="hero-card study-hero"><div class="hero-title">🎓 学習モード</div><p>統合ノートで知識を整理し、復習で定着を目指す</p></section><section class="card study-landing"><div class="section-title compact">🧠 今日の復習</div><p>まずは既存の復習問題を確認できます。</p><button class="primary-btn" id="openReviewHome">Reviewを開く ›</button><p class="small-note">毎日5問・理解度保存は第2段階で実装予定です。</p></section>${fcard}${weekCard}<section class="card notice">💾 回答履歴の保存とバックアップ案内は次の段階で追加します。</section></main>${nav()}`;
  return `<main class="screen">${brand()}${searchBox()}<section class="hero-card"><div class="hero-title">💡 AST重要ポイント</div><p>明日からの診療に役立つ<br>感染症診療・ASTのキーポイントを確認</p></section>${fcard}<div class="grid"><button class="category" data-cat="菌"><span class="icon-bubble teal">🦠</span><strong>菌</strong></button><button class="category" data-cat="抗菌薬"><span class="icon-bubble">💊</span><strong>抗菌薬</strong></button></div><div class="grid three"><button class="category" data-cat="感染症"><span class="icon-bubble pink">🧫</span><strong>感染症</strong></button><button class="category" data-cat="血培"><span class="icon-bubble purple">🧪</span><strong>血培</strong></button><button class="category" data-cat="AST介入"><span class="icon-bubble teal">👥</span><strong>AST介入</strong></button></div>${weekCard}<section class="card notice">🔔 更新確認が必要 <strong>${staleCount()}件</strong></section></main>${nav()}`;
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
  if(!q){
    results=[
      ...state.organisms.slice(0,4).map(o=>({type:'菌',score:50,title:o.canonical,sub:o.ja,obj:o})),
      ...state.antibiotics.slice(0,3).map(a=>({type:'抗菌薬',score:50,title:a.generic,sub:a.english,obj:a}))
    ];
  }
  results.sort((a,b)=>b.score-a.score);
  if(state.filter!=='all')results=results.filter(r=>r.type===state.filter);
  return results;
}

function searchPanelHtml(){
  const q=state.query.trim();
  const results=getSearchResults();
  return `<div class="tabs">${[['all','すべて'],['菌','菌'],['抗菌薬','抗菌薬'],['ノート','ノート'],['Weekly','Weekly']].map(([k,l])=>`<button class="chip ${state.filter===k?'active':''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div class="suggest">${q?'もしかして？':'検索候補'}</div>
    ${results.length?results.slice(0,8).map((r,i)=>resultCard(r,i===0&&q)).join(''):'<div class="card empty">候補が見つかりません。別名・略語・商品名でも検索できます。</div>'}`;
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
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
    state.filter=b.dataset.filter;
    updateSearchPanel();
  });
  document.querySelectorAll('.open-note').forEach(b=>b.onclick=()=>{
    state.selectedNote=state.notes.find(n=>n.path===b.dataset.note);
    state.noteOrigin='search';
    state.view='note';
    render();
  });
  document.querySelectorAll('[data-weekly-open]').forEach(b=>b.onclick=()=>{
    state.selectedWeeklyPath=b.dataset.weeklyOpen;
    state.view='weekly';
    render();
  });
}

function resultCard(r,top){
  if(r.type==='ノート')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble pink">📖</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub||'')} · 統合ノート</p><span class="draft-label">原典確認待ち</span></div></div><button class="primary-btn open-note" data-note="${esc(r.obj.path)}">統合ノートを開く ›</button></section>`;
  if(r.type==='菌')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble teal">🦠</span><div class="result-title"><h3>${esc(r.title)} ${top?'<span class="verified">✓ 候補</span>':''}</h3><p>${esc(r.sub||'')}</p><div class="tags">${(r.obj.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div></div></div><div class="summary">${r.obj.id==='stenotrophomonas-maltophilia'?'カルバペネムは基本的に期待しにくい / ST使用時はK・腎機能を確認':'菌名・別名・関連タグから一致しました。'}</div>${r.obj.note?'<button class="primary-btn open-note" data-note="'+r.obj.note+'">菌ノートを開く ›</button>':''}</section>`;
  if(r.type==='抗菌薬')return `<section class="card result-card"><div class="result-head"><span class="icon-bubble">💊</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub)}</p><div class="tags">${[...(r.obj.brands||[]),...(r.obj.abbr||[])].slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></div><div class="summary">一般名・商品名・略語・入力ゆれから検索できます。</div></section>`;
  return `<section class="card result-card"><div class="result-head"><span class="icon-bubble purple">📅</span><div class="result-title"><h3>${esc(r.title)}</h3><p>${esc(r.sub||'')}</p></div></div><button class="primary-btn" data-weekly-open="${esc(r.obj.path)}">Weeklyを開く ›</button></section>`
}
function noteView(){const n=state.selectedNote||state.notes[0];if(n?.fm.layout==='integrated')return integratedNoteView(n);const tags=(n.fm.tags||'').split(',').map(x=>x.trim()).filter(Boolean);const imp=Number(n.fm.importance||0);return `<main class="screen"><div class="note-head"><button class="back" id="backSearch">‹ 戻る</button>${modeControl()}<div style="text-align:center;font-weight:800">菌のノート</div><h1>${esc(n.fm.title)}</h1><div class="meta"><span class="verified">✓ ${n.fm.status==='verified'?'確認済み':esc(n.fm.status)}</span><span class="pill stars">${'★'.repeat(imp)}${'☆'.repeat(Math.max(0,5-imp))}</span><span class="pill">最終確認：${esc(n.fm.last_reviewed||'')}</span></div><div class="tags">${tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div></div>
  ${noteSection('💡 まず覚える',mdList(n.sections['まず覚える']))}
  ${checkSection('📋 ASTで確認',mdList(n.sections['ASTで確認']))}
  ${noteText('⚠️ 落とし穴',n.sections['落とし穴'],'warning')}
  ${sourceSection(n)}
  </main>${nav()}`}
function integratedNoteView(n){
  const clinical=state.mode==='clinical';
  const sections=['初期評価・感染源','再血培と持続菌血症','感染性心内膜炎・深部感染','抗菌薬の評価','治療期間とフォロー'];
  const related=mdList(n.sections['関連ノート']);
  const summary=mdList(n.sections['30秒要約']);
  const check=mdList(n.sections['ASTで確認']);
  const qa=parseQA(n.sections['ミニ復習']);
  const tags=(n.fm.tags||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,6);
  const details=sections.map(s=>`<details class="detail-panel"><summary>${esc(s)}</summary><ul>${mdList(n.sections[s]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`).join('');
  return `<main class="screen integrated-screen"><div class="note-head"><button class="back" id="backSearch" type="button">‹ 戻る</button></div>${modeControl()}<header class="integrated-heading"><div class="eyebrow">感染症 ＞ 血流感染</div><h1>${esc(n.fm.title)}</h1><p>${esc(n.fm.ja||'')}</p><div class="tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></header><div class="draft-alert" role="note"><strong>⚠️ 学習用ノート・原典確認待ち（draft）</strong><p>治療推奨の確定版ではありません。具体的な投与量・期間は原典や施設基準を別途確認してください。</p></div>
  ${clinical?`
  <section class="card integrated-card"><h2>⚡ 30秒で確認</h2><ol class="brief-points">${summary.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></section>
  <section class="card integrated-card"><h2>📋 ASTチェックリスト</h2><p class="small-note">この画面内だけの確認欄です。患者情報は入力しないでください。</p><ul class="quick-checks">${check.map(t=>`<li><label><input type="checkbox"/> <span>${esc(t)}</span></label></li>`).join('')}</ul></section>
  <section class="card integrated-card"><h2>🔎 判断に迷ったら</h2><p>持続菌血症の評価・感染源コントロール・投与設計を、詳細ノートで確認できます。</p><button type="button" class="primary-btn" data-mode="study">詳細ノートで学ぶ ›</button></section>`
  :`
  <section class="card integrated-card"><h2>📚 詳細ノート</h2><p class="small-note">学習内容を整理した下書きです。タップすると各項目を表示します。</p>${details}</section>
  <section class="card integrated-card"><h2>🧠 ミニ復習</h2><p class="small-note">練習用・回答記録なし。正式な採点と理解度管理は次の段階で実装します。</p>${qa.map(x=>`<details class="detail-panel"><summary>Q. ${esc(x.q)}</summary><p class="model-answer">A. ${esc(x.a)}</p></details>`).join('')}</section>
  <section class="card integrated-card"><h2>⚡ 30秒要約も確認</h2><ul>${summary.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`
  }
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
function reviewView(){return `<main class="screen">${brand('復習')}<div class="section-title">🧠 今日の復習</div><section class="card weekly-card">${state.review.map(x=>`<div class="q-row"><strong>Q ${esc(x.q)}</strong><div class="answer">${esc(x.a)}</div></div>`).join('')}</section></main>${nav()}`}
function openMemo(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="memoModal"><div class="sheet"><h2>今日覚えたこと</h2><textarea id="memoText" placeholder="あとで整理したいことを短くメモ"></textarea><div class="sheet-actions"><button class="cancel" id="memoCancel">キャンセル</button><button class="save" id="memoSave">保存</button></div></div></div>`);$('#memoCancel').onclick=()=>$('#memoModal').remove();$('#memoSave').onclick=()=>{const t=$('#memoText').value.trim();if(t){const arr=JSON.parse(localStorage.getItem('astPocketInbox')||'[]');arr.unshift({text:t,at:new Date().toISOString()});localStorage.setItem('astPocketInbox',JSON.stringify(arr))}$('#memoModal').remove()}}
function bindPage(){
  bindCommon();
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.mode;if(m!==state.mode&&(m==='clinical'||m==='study')){state.mode=m;try{localStorage.setItem('astPocketModeV2',m)}catch(e){}render(false)}}));
  $('#openFeaturedNote')?.addEventListener('click',()=>{state.selectedNote=state.notes.find(n=>n.fm.layout==='integrated');state.noteOrigin='home';if(state.selectedNote){state.view='note';render();}});
  $('#openReviewHome')?.addEventListener('click',()=>{state.view='review';render();});
  document.querySelectorAll('[data-related]').forEach(b=>b.addEventListener('click',()=>{state.query=b.dataset.related;state.filter='all';state.view='search';render();}));
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{
    state.view='search';
    state.query=b.dataset.cat;
    render();
  });
  $('#goWeekly')?.addEventListener('click',()=>{state.selectedWeeklyPath=null;state.view='weekly';render()});
  $('#weeklyPicker')?.addEventListener('change',e=>{state.selectedWeeklyPath=e.target.value;render(false)});
  if(state.view==='search')bindSearchPanel();
  $('#backSearch')?.addEventListener('click',()=>{state.view=state.noteOrigin||'search';render()});
  $('#latestBtn')?.addEventListener('click',()=>alert('Ver.1では「最新情報を確認」の導線まで実装。次段階でWeb検索・差分確認を接続します。'));
  document.querySelectorAll('.q-row').forEach(q=>q.onclick=()=>q.classList.toggle('open'));
}

function render(scroll=true){let html='';if(state.view==='home')html=home();else if(state.view==='search')html=searchResults();else if(state.view==='note')html=noteView();else if(state.view==='weekly')html=weeklyView();else html=reviewView();app.innerHTML=html;bindPage();if(scroll)window.scrollTo({top:0,behavior:'instant'})}
load().catch(err=>{console.error(err);app.innerHTML='<div class="screen"><div class="card empty">AST Pocketの読み込みに失敗しました。ローカルではHTTPサーバー経由で開いてください。</div></div>'});
