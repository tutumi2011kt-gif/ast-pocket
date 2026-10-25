/**
 * AST Pocket: original 2026-10-17 antifungal spectrum teaching grid.
 * Safe, study-mode-only rendering. Ratings express simplified learning
 * associations, NOT susceptibility testing or clinical recommendations.
 */
export const ANTIFUNGAL_SPECTRUM_PATH='content/spectrum/antifungal-2026-10.json';
const KEY_RE=/^[a-z0-9][a-z0-9-]*$/;
const SYMBOLS=['◎','○','△','×','○※','◎※'];
const ALLOWED_URLS=new Set([
 'https://www.idsociety.org/practice-guideline/candidiasis/',
 'https://www.idsociety.org/practice-guideline/aspergillosis/',
 'https://www.idsociety.org/practice-guideline/Diagnosis-and-Management-of-Cryptococcosis/',
 'https://www.ecmm.info/guidelines/mucormycoses-2019/'
]);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(s,max=330)=>typeof s==='string'&&s.length>0&&s.length<=max&&
 !/(?:<|>|\bjavascript:|https?:\/\/|患者名|患者ID|院内限定|@)/i.test(s);
export function validateSpectrum(data){
 if(!data||data.schema_version!==1||data.review_status!=='educational_draft_human_medical_review_pending')throw Error('Invalid spectrum review state');
 if(data.origin!=='ChatGPT learning table 2026-10-17')throw Error('Source table changed unexpectedly');
 if(!Array.isArray(data.columns)||data.columns.length!==6||!Array.isArray(data.rows)||data.rows.length!==8)throw Error('Expected original 8 by 6 teaching table');
 if(!Array.isArray(data.notes)||data.notes.length<5||!Array.isArray(data.sources)||data.sources.length!==4)throw Error('Spectrum notes/evidence required');
 const ids=new Set();
 for(const c of data.columns){
  if(!KEY_RE.test(c.id)||ids.has(c.id)||!text(c.label,100)||!text(c.group,40))throw Error('Invalid spectrum column');
  ids.add(c.id);
 }
 const rowIds=new Set();
 for(const r of data.rows){
  if(!KEY_RE.test(r.id)||rowIds.has(r.id)||!text(r.label,60)||!text(r.generic,120)||!text(r.group,40))throw Error('Invalid spectrum drug');
  rowIds.add(r.id);
  if(!r.cells||Object.keys(r.cells).length!==6)throw Error('Missing spectrum cell');
  for(const c of data.columns){
   const cell=r.cells[c.id];
   if(!cell||!SYMBOLS.includes(cell.rating)||!text(cell.note,330))throw Error('Invalid cell: '+r.id+'/'+c.id);
  }
 }
 for(const source of data.sources){
  if(!text(source.title,140)||!text(source.published,20)||!text(source.scope,200)||!ALLOWED_URLS.has(source.url))
   throw Error('Unapproved spectrum citation');
 }
 return true;
}
export function renderSpectrum({data=null,mode='study',selectedOrganism='all',selectedCell=null,modeHtml=''}={}){
 let out='<main class="screen spectrum-screen">'+modeHtml+
  '<header class="spectrum-header"><div class="eyebrow">💊 以前学んだスペクトル一覧</div>'+
  '<h1>抗真菌薬スペクトル</h1><p>2026年10月17日の学習表を再掲・補足</p></header>';
 if(mode!=='study')return out+
  '<section class="card spectrum-warning"><strong>臨床モードでは学習用の一覧を表示しません</strong>'+
  '<p>個別の治療選択は菌種・感受性・感染臓器・国内添付文書に基づいてください。</p>'+
  '<button type="button" class="primary-btn" data-mode="study">学習モードへ切り替える</button></section></main>';
 out+='<section class="card spectrum-warning"><strong>学習用の簡略表・医学的最終承認待ち</strong>'+
  '<p>記号は暗記用の目安で、感受性試験・臨床効果・全病型での第一選択を保証しません。各セルをタップすると根拠上の注意点が読めます。</p></section>';
 if(!data)return out+'<section class="card empty"><p>一覧を読み込めませんでした。オンラインで開き直して確認してください。</p></section></main>';
 const col=data.columns.find(c=>c.id===selectedOrganism);
 const shown=col?[col]:data.columns;
 out+='<section class="card spectrum-panel"><h2>菌種で絞り込み</h2>'+
  '<div class="spectrum-filters" role="group" aria-label="抗真菌薬スペクトルの菌種">'+
  [{id:'all',label:'すべて（比較表）'},...data.columns.map(x=>({id:x.id,label:x.label}))].map(x=>
   '<button type="button" data-spectrum-organism="'+esc(x.id)+'" aria-pressed="'+(selectedOrganism===x.id)+'" class="'+
   (selectedOrganism===x.id?'selected':'')+'">'+esc(x.label)+'</button>').join('')+'</div>'+
  '<p class="small-note">画面の横スクロールで全ての菌種を比較できます。左の薬剤名は固定されます。</p>'+
  '<div class="spectrum-legend" aria-label="記号の意味"><span><strong>◎</strong> 有力</span><span><strong>○</strong> 活性あり</span>'+
  '<span><strong>△</strong> 限定的</span><span><strong>×</strong> 期待しない</span><span><strong>※</strong> 条件あり</span></div>'+
  '<div class="spectrum-scroll" tabindex="0" role="region" aria-label="抗真菌薬のスペクトル対応表 横スクロール">'+
  '<table class="spectrum-table"><caption>抗真菌薬8分類×主要真菌6分類：10月17日の学習表</caption>'+
  '<thead><tr><th scope="col" class="spectrum-sticky">薬剤</th>'+
  shown.map(c=>'<th scope="col" title="'+esc(c.group)+'">'+esc(c.short||c.label)+'</th>').join('')+
  '</tr></thead><tbody>'+data.rows.map(r=>'<tr><th scope="row" class="spectrum-sticky"><span>'+esc(r.label)+
   '</span><small>'+esc(r.group)+'</small></th>'+shown.map(c=>{
    const cell=r.cells[c.id],symbol=cell.rating[0],extra=cell.rating.includes('※')?'※':'';
    return '<td><button type="button" data-spectrum-cell="'+esc(r.id+':'+c.id)+'" '+
     'aria-label="'+esc(r.label+' 対 '+c.label+' '+cell.rating+'。補足を表示')+
     '" class="spectrum-rating grade-'+({ '◎':'high','○':'active','△':'limited','×':'none'}[symbol]||'limited')+'">'+
     esc(symbol)+'<small>'+esc(extra)+'</small></button></td>';
   }).join('')+'</tr>').join('')+
  '</tbody></table></div></section>';
 let chosen=null,drug=null,org=null;
 if(selectedCell&&typeof selectedCell==='string'){
  const [d,c]=selectedCell.split(':');
  drug=data.rows.find(x=>x.id===d);
  org=data.columns.find(x=>x.id===c);
  if(drug&&org)chosen=drug.cells[org.id];
 }
 if(chosen){
  out+='<section class="card spectrum-detail" role="status"><div class="eyebrow">選択した組み合わせ</div>'+
   '<h2>'+esc(drug.label)+' × '+esc(org.label)+' <span class="spectrum-detail-grade">'+esc(chosen.rating)+'</span></h2>'+
   '<p>'+esc(chosen.note)+'</p><button type="button" data-spectrum-clear>閉じる</button></section>';
 }
 out+='<section class="card spectrum-reference"><h2>覚えるポイント</h2><ul>'+
  data.notes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
  '<h2>原典・改訂年</h2><ul>'+data.sources.map(x=>
   '<li><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a>'+
   '（'+esc(x.published)+'）<p>'+esc(x.scope)+'</p></li>').join('')+'</ul>'+
  '<p class="small-note">原表：'+esc(data.origin)+' ／ 更新：'+esc(data.updated)+' ／ 医学的確認：未完了</p>'+
  '</section></main>';
 return out;
}
