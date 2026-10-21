#!/usr/bin/env node
/**
 * AST Pocket evidence gap triage.
 *
 * Processes only public educational review drafts + existing evidence ledger.
 * Sentence/keyword matching is NOT medical verification or proof of contradiction.
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {getChapters} from '../notebook-templates.mjs';
import {checkLedger} from './check-evidence-ledger.mjs';

const clinicalCues=[
 [/再血培|血培再検|血液培養|陰性化|持続陽性|48時間|24.?48時間|血培/,5,'blood_cultures'],
 [/14日|治療期間|起算日|治療終了|投与期間/,5,'duration'],
 [/心エコー|TTE|TEE|心内膜炎|感染性心内膜炎|深部感染/,5,'endocarditis_and_foci'],
 [/MSSA|MRSA|VCM|CEZ|抗菌薬|βラクタム|感受性|投与設計|薬剤/,4,'antibiotic_selection'],
 [/カテーテル|人工弁|デバイス|感染源コントロール|ドレナージ|抜去/,4,'source_control'],
 [/CoNS|コンタミ|汚染|定着|臨床所見/,3,'contamination']
];
const headingRx=/^## ([1-8])\. (.+)$/;
const normalize=s=>s.normalize('NFKC').replace(/[\s*_[\]#]/g,'').toLowerCase();
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex').slice(0,14);
const bullet=line=>/^\s*(?:[-*]\s+|\d+\.\s+)/.test(line);
const trimBullet=line=>line.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/,'').trim();

export function triageEvidenceGaps(ledger,{readDocument}){
 checkLedger(ledger,readDocument);
 const cases=[];
 for(const file of [...new Set(ledger.claims.map(c=>c.document))].sort()){
  const related=ledger.claims.filter(c=>c.document===file);
  const category=related[0].category;
  const chapterMap=new Map(getChapters(category).map(ch=>[ch.index+1,ch]));
  const text=readDocument(file).replace(/\r\n/g,'\n');
  let active=null,ordinal=0;
  for(const line of text.split('\n')){
   const m=line.match(headingRx);
   if(m){active=chapterMap.get(Number(m[1]))?.id||null;ordinal=0;continue;}
   // Skip references tables and quote blocks. Claim anchors elsewhere are tracked by the main ledger.
   if(!active||active==='evidence'||!bullet(line))continue;
   const item=trimBullet(line);
   if(item.length<25)continue;
   ordinal++;
   const matched=clinicalCues.filter(([pattern])=>pattern.test(item));
   if(!matched.length)continue;  // This is not a clinical completeness certification.
   const linked=related.filter(c=>c.chapter_id===active&&
     normalize(item).includes(normalize(c.anchor)));
   const strongestRisk=matched.reduce((x,v)=>Math.max(x,v[1]),0);
   cases.push({
    id:'line_'+sha(file+'\n'+active+'\n'+item),document:file,chapter_id:active,
    ordinal,priority:linked.length===0?strongestRisk+2:strongestRisk,
    risk_group:matched.sort((a,b)=>b[1]-a[1])[0][2],
    tracking:linked.length?'some_claim_anchor_linked':'no_claim_anchor',
    linked_claim_ids:linked.map(x=>x.id),
    excerpt:item.length>185?item.slice(0,185)+'…':item,
    status:'medical_human_review_required'
   });
  }
 }
 cases.sort((a,b)=>b.priority-a.priority||a.document.localeCompare(b.document)||a.chapter_id.localeCompare(b.chapter_id)||a.ordinal-b.ordinal);
 const grouped={};
 for(const c of cases)grouped[c.tracking]=(grouped[c.tracking]||0)+1;
 return {schema_version:1,medical_approval:false,auto_publishing:false,
  inventory:{scanned_high_priority_lines:cases.length,with_some_anchor:grouped.some_claim_anchor_linked||0,
   without_anchor:grouped.no_claim_anchor||0,
   caution:'Single linked claim does not verify an entire line or chapter'},
  ranked_candidates:cases};
}
export function renderEvidenceGapReport(report,{limit=25}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid limit');
 const out=['# AST Pocket 根拠不足箇所・優先順位（レビュー用）','',
  '> **機械的なキーワード分類のみ。医学的承認、真偽判定、全文章の網羅ではありません。**','',
  '- 対象：GPC clusters・MSSA菌血症の既存の公開済み8章草案',
  '- 検査対象となった重要な箇条書き：'+report.inventory.scanned_high_priority_lines+'件',
  '- 同じ箇条書き内に根拠アンカーがあるもの：'+report.inventory.with_some_anchor+'件（本文全体の検証を意味しない）',
  '- 根拠アンカー未登録：'+report.inventory.without_anchor+'件（優先レビュー候補）','',
  '## 優先して原典を確認する文',''];
 for(const c of report.ranked_candidates.slice(0,limit))
  out.push('### '+c.id+'：'+c.risk_group+'（優先度'+c.priority+'）','',
   '- ノート・章：'+c.document+' ／ '+c.chapter_id,
   '- 根拠追跡：'+c.tracking+'（'+(c.linked_claim_ids.join(', ')||'なし')+'）',
   '- 抜粋（草案そのまま）：'+c.excerpt,
   '- 必要な作業：該当する原典の節・推奨の適用条件を人が確認し、正しければ台帳に新規claimを記録する。','');
 out.push('## 注意','','- 日付・公開URL・原典章との対応があっても医療的に正しいとは証明できません。',
  '- 元の草案や正式ノートを自動編集・承認しません。','');
 return out.join('\n');
}
if(process.argv[1]?.endsWith('/triage-evidence-gaps.mjs')){
 const ledger=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
 const result=triageEvidenceGaps(ledger,{readDocument:p=>fs.readFileSync(p,'utf8')});
 console.log(renderEvidenceGapReport(result,{limit:15}));
}
