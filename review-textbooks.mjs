/**
 * AST Pocket source-document textbook reader.
 * Public de-identified learning DRAFTS only; never clinical Knowledge.
 * No external Markdown renderer, AI API calls or auto-approval.
 */
import {getChapters,readNotebookPrefs} from './notebook-templates.mjs';

export const REVIEW_TEXTBOOKS=Object.freeze([
 {id:'gpc-clusters',title:'GPC clusters：血液培養の初期評価',
  category:'culture',path:'docs/review-drafts/gpc-clusters-2026-10-21.md',updated:'2026-10-21',
  short:'汚染・S. aureus・CoNSの区別から再血培まで',
  related:['culture-gpc-clusters']},
 {id:'mssa-bacteremia',title:'MSSA菌血症：根拠から学ぶ8章',
  category:'infection',path:'docs/review-drafts/mssa-bacteremia-2026-10-21.md',updated:'2026-10-21',
  short:'再血培、CEZ、感染源、心エコー、治療期間',
  related:['infection-mssa-bacteremia']},
 {id:'antifungal',title:'抗真菌薬・真菌感染症の総合ノート',
  category:'cross',path:'docs/review-drafts/antifungal-week-study-2026-10-21.md',updated:'2026-10-21',
  short:'Candida・Aspergillus・Cryptococcus・Mucorales・Pneumocystis',
  related:['infection-candidemia','infection-invasive-aspergillosis','infection-cryptococcosis',
   'infection-mucormycosis','infection-pneumocystis','cross-antifungal-spectrum']}
]);
const h=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const trusted=['idsociety.org','pubmed.ncbi.nlm.nih.gov','ncbi.nlm.nih.gov','ecmm.info','escardio.org'];
function safeUrl(x){
 try{
  const u=new URL(x);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
   trusted.some(host=>u.hostname===host||u.hostname.endsWith('.'+host))?u.href:null;
 }catch{return null}
}
const bold=s=>h(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
export function markdownInline(source){
 const s=String(source||''),re=/\[([^\]\n]{1,200})\]\((https:\/\/[^\s)]+)\)/g;
 let out='',position=0,match;
 while((match=re.exec(s))){
  out+=bold(s.slice(position,match.index));
  const url=safeUrl(match[2]);
  out+=url?'<a href="'+h(url)+'" target="_blank" rel="noopener noreferrer">'+bold(match[1])+'</a>':
   bold(match[1]+'（リンク要確認）');
  position=re.lastIndex;
 }
 return out+bold(s.slice(position));
}
const cells=s=>s.trim().startsWith('|')&&s.trim().endsWith('|')
 ?s.trim().slice(1,-1).split('|').map(x=>x.trim()):null;
export function renderTextbookMarkdown(input){
 const arr=Array.isArray(input)?input:String(input||'').split('\n'),out=[];let list=null;
 const close=()=>{if(list){out.push('</'+list+'>');list=null}};
 for(let i=0;i<arr.length;i++){
  const l=arr[i].trim();
  if(!l){close();continue}
  const row=cells(l),sep=cells(arr[i+1]||'');
  if(row&&sep&&sep.length===row.length&&sep.every(x=>/^:?-{3,}:?$/.test(x))){
   close();
   out.push('<div class="textbook-table-scroll"><table class="textbook-table"><thead><tr>'+
    row.map(x=>'<th scope="col">'+markdownInline(x)+'</th>').join('')+'</tr></thead><tbody>');
   i++;
   while(i+1<arr.length){
    const vals=cells(arr[i+1]);if(!vals||vals.length!==row.length)break;
    i++;out.push('<tr>'+vals.map(x=>'<td>'+markdownInline(x)+'</td>').join('')+'</tr>');
   }
   out.push('</tbody></table></div>');continue;
  }
  if(/^#{3,5} /.test(l)){
   close();const depth=l.match(/^#+/)[0].length;
   out.push('<h'+depth+'>'+markdownInline(l.slice(depth+1))+'</h'+depth+'>');continue;
  }
  if(l.startsWith('> ')){close();out.push('<blockquote>'+markdownInline(l.slice(2))+'</blockquote>');continue}
  let item=l.match(/^[-*]\s+(.+)$/),tag='ul';
  if(!item){item=l.match(/^\d+\.\s+(.+)$/);tag='ol'}
  if(item){if(tag!==list){close();list=tag;out.push('<'+tag+'>')}out.push('<li>'+markdownInline(item[1])+'</li>');continue}
  close();out.push('<p>'+markdownInline(l)+'</p>');
 }
 close();
 return out.join('');
}
export function parseReviewTextbook(entry,markdown){
 if(!REVIEW_TEXTBOOKS.some(x=>x.id===entry?.id&&x.path===entry.path))
  throw Error('Unregistered review textbook');
 if(typeof markdown!=='string'||markdown.length<1000||markdown.length>45000)
  throw Error('Empty/oversized review textbook');
 if(/(?:患者ID[：:]|患者名[：:]|院内限定|https:\/\/(?:chatgpt\.com|chat\.openai\.com)\/c\/)/i.test(markdown))
  throw Error('Private material cannot be displayed');
 const chapters=getChapters(entry.category),arr=markdown.replace(/\r\n/g,'\n').split('\n'),starts=[];
 arr.forEach((line,index)=>{const m=line.match(/^## ([1-8])\. (.+)$/);if(m)starts.push({line:index,n:Number(m[1]),title:m[2]})});
 if(starts.length!==8)throw Error('Expected exactly eight source chapters');
 const parsed=chapters.map((ch,i)=>{
  const v=starts[i];
  if(v.n!==i+1||v.title!==ch.title)throw Error('Chapter heading mismatch: '+ch.id);
  const end=i===7?arr.length:starts[i+1].line;
  return {...ch,body:arr.slice(v.line+1,end).join('\n').trim()};
 });
 return {id:entry.id,sourcePath:entry.path,title:entry.title,category:entry.category,
  updated:entry.updated,reviewStatus:'medical_review_pending',chapters:parsed};
}
function simpleLines(body){
 const picked=[];for(const line of body.split('\n')){
  const t=line.trim();
  if(!t||t.startsWith('|')||/^#{3,5} /.test(t)||t.startsWith('**参照'))continue;
  if(t.startsWith('- ')||t.startsWith('* ')||t.startsWith('**')||t.length>45){
   picked.push(line);if(picked.length>=2)break;
  }
 }
 return picked.length?picked:['詳しい内容は「詳しく」で確認してください。'];
}
export function renderReviewTextbook({entry,textbook,mode='study',modeHtml=''}={}){
 const clinical=mode!=='study',title=entry?.title||'詳細教科書';
 let out='<main class="screen integrated-screen template-screen textbook-screen"'+
  (!clinical&&textbook?' data-template-reader="textbook:'+h(entry.id)+'" data-template-category="'+h(entry.category)+'"':'')+'>'+
  '<div class="note-head"></div>'+modeHtml+
  '<header class="integrated-heading"><div class="eyebrow">📘 8章の教科書 ／ 原典確認待ち</div><h1>'+h(title)+'</h1>'+
  '<p>2026年10月の学習に基づく、確認用の詳細草案です。</p></header>'+
  '<div class="draft-alert textbook-safety" role="note"><strong>⚠️ 学習専用・医学的未承認</strong>'+
  '<p>一部の原典照合は未完了です。臨床用Knowledge、国内添付文書の確定版、個別患者の治療指示ではありません。</p></div>';
 if(clinical)return out+'<section class="card integrated-card"><h2>臨床モードでは非表示です</h2>'+
  '<p>未承認の詳細草案は学習モードでのみ閲覧できます。</p>'+
  '<button type="button" class="primary-btn" data-mode="study">学習モードへ切り替える ›</button></section></main>';
 if(!textbook||textbook.reviewStatus!=='medical_review_pending')return out+
  '<section class="card integrated-card"><h2>ノートを確認できませんでした</h2><p>原稿の形式・読込状態を確認してください。</p></section></main>';
 const prefs=readNotebookPrefs('textbook:'+entry.id,entry.category);
 out+='<section class="card integrated-card template-controls"><h2>📚 詳細ノートを読む</h2>'+
  '<p class="small-note">要点／詳しくを切替。章の開閉・読書位置はこの端末内だけに保存します。</p>'+
  '<div class="mssa-depth"><button type="button" data-template-depth="simple" aria-pressed="'+(prefs.depth==='simple')+'" class="'+(prefs.depth==='simple'?'selected':'')+'">要点</button>'+
  '<button type="button" data-template-depth="deep" aria-pressed="'+(prefs.depth==='deep')+'" class="'+(prefs.depth==='deep'?'selected':'')+'">詳しく</button></div>'+
  '<button type="button" id="templateResume" class="mssa-resume" '+(prefs.lastChapter?'':'disabled')+'>'+
  (prefs.lastChapter?'↩ 前回の続きから再開':'前回の読書位置はありません')+'</button>'+
  '<nav class="mssa-toc" aria-label="詳細教科書 8章の目次">'+textbook.chapters.map(c=>
   '<button type="button" class="mssa-toc-button" data-template-jump="'+h(c.id)+'">'+(c.index+1)+'. '+h(c.title)+' ›</button>').join('')+'</nav></section>';
 out+='<section class="card integrated-card"><h2>📖 章ごとの詳しい解説</h2>';
 for(const chapter of textbook.chapters){
  const lines=prefs.depth==='simple'?simpleLines(chapter.body):chapter.body.split('\n');
  out+='<details class="mssa-chapter" data-template-chapter="'+h(chapter.id)+'" '+(prefs.open.includes(chapter.id)?'open':'')+'>'+
   '<summary><strong>'+(chapter.index+1)+'. '+h(chapter.title)+'</strong>'+
   '<small>原典照合・医学的確認待ち</small></summary>'+
   '<div class="mssa-chapter-body textbook-body">'+renderTextbookMarkdown(lines)+
   (prefs.depth==='simple'?'<p class="small-note">詳しい出典・説明は「詳しく」で確認できます。</p>':'')+
   '</div></details>';
 }
 return out+'</section><section class="card integrated-card"><h2>🔎 出典確認について</h2>'+
  '<p>文献リンクは第8章にまとめています。発行・更新日、対象患者、国内添付文書との整合は別途確認してください。</p>'+
  '<p class="small-note">元資料：'+h(entry.path)+' ／ 草案：'+h(entry.updated)+' ／ 医学的承認：未実施</p></section></main>';
}
