import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ANTIFUNGAL_SPECTRUM_PATH,validateSpectrum,renderSpectrum} from '../antifungal-spectrum.mjs';

const raw=fs.readFileSync(ANTIFUNGAL_SPECTRUM_PATH,'utf8');
const data=JSON.parse(raw);
assert.equal(validateSpectrum(data),true);
assert.equal(data.origin,'ChatGPT learning table 2026-10-17');
assert.equal(data.review_status,'educational_draft_human_medical_review_pending');
assert.equal(data.rows.length,8);
assert.equal(data.columns.length,6);
assert.deepEqual(data.columns.map(x=>x.id),['albicans','glabrata','krusei','aspergillus','cryptococcus','mucorales']);
const expected={
 echinocandin:['◎','◎','◎','△','×','×'],
 flcz:['◎','△','×','×','○','×'],
 vrcz:['○','△','○','◎','△','×'],
 itcz:['○','△','○','○','△','×'],
 pscz:['○','○','○','○','△','○'],
 iscz:['○','△','○','○','△','○'],
 lamb:['◎','◎','◎','○※','◎','◎'],
 '5fc':['○※','○※','△','×','◎※','×']
};
assert.deepEqual(Object.keys(expected),data.rows.map(x=>x.id));
for(const row of data.rows)assert.deepEqual(data.columns.map(c=>row.cells[c.id].rating),expected[row.id]);
assert.ok(data.rows.every(row=>data.columns.every(c=>row.cells[c.id].note.length>10)));
const find=(drug,organism)=>data.rows.find(x=>x.id===drug).cells[organism].note;
for(const term of ['単剤','標準的'])assert.ok(find('echinocandin','aspergillus').includes(term));
assert.ok(find('flcz','krusei').includes('本質的耐性'));
assert.ok(find('vrcz','mucorales').includes('活性がなく'));
assert.ok(find('5fc','cryptococcus').includes('併用'));
assert.ok(find('lamb','albicans').includes('エキノキャンディン'));
assert.equal(data.sources.length,4);
const full=renderSpectrum({data,mode:'study'});
assert.ok(full.includes('原表：ChatGPT learning table 2026-10-17'));
assert.ok(full.includes('data-spectrum-organism="all"'));
assert.equal((full.match(/data-spectrum-organism=/g)||[]).length,7);
assert.equal((full.match(/data-spectrum-cell=/g)||[]).length,48);
assert.equal((full.match(/<th scope="row" class="spectrum-sticky"/g)||[]).length,8);
assert.ok(full.includes('role="region"'));
assert.ok(full.includes('aria-label="抗真菌薬のスペクトル対応表'));
assert.ok(full.includes('target="_blank" rel="noopener noreferrer"'));
assert.ok(full.includes('医学的最終承認待ち'));
assert.ok(full.includes('Candida'));
assert.ok(full.includes('Mucorales'));
const compact=renderSpectrum({data,mode:'study',selectedOrganism:'krusei',selectedCell:'flcz:krusei'});
assert.equal((compact.match(/data-spectrum-cell=/g)||[]).length,8);
assert.ok(compact.includes('FLCZ × C. krusei'));
assert.ok(compact.includes('本質的耐性'));
assert.ok(compact.includes('data-spectrum-clear'));
assert.ok(compact.includes('aria-pressed="true"'));
const clinical=renderSpectrum({data,mode:'clinical',selectedCell:'vrcz:aspergillus'});
assert.ok(clinical.includes('臨床モードでは学習用の一覧を表示しません'));
assert.ok(!clinical.includes('spectrum-table'));
assert.ok(!clinical.includes('data-spectrum-cell'));
assert.ok(!clinical.includes('data-spectrum-organism'));
assert.ok(!clinical.includes('◎'));
const failed=renderSpectrum({data:null,mode:'study'});
assert.ok(failed.includes('読み込めませんでした'));
assert.ok(!failed.includes('spectrum-table'));
const tamper=structuredClone(data);
tamper.rows[0].cells.albicans.rating='verified';
assert.throws(()=>validateSpectrum(tamper),/Invalid cell/);
const forged=structuredClone(data);
forged.sources[0].url='https://chatgpt.com/c/private';
assert.throws(()=>validateSpectrum(forged),/Unapproved/);
const incorrect=structuredClone(data);
incorrect.rows[0].cells.mucorales.note='<script>unsafe</script>';
assert.throws(()=>validateSpectrum(incorrect),/Invalid cell/);
const app=fs.readFileSync('app.js','utf8');
assert.ok(app.includes("state.view==='spectrum'"));
assert.ok(app.includes('data-open-spectrum'));
assert.ok(app.includes("state.mode!=='study')return"));
assert.ok(app.includes('data-spectrum-cell'));
assert.ok(app.includes('data-spectrum-organism'));
const bank=JSON.parse(fs.readFileSync('content/review/bank-v2.json','utf8'));
assert.equal(bank.length,50,'Daily quiz bank must be untouched');
console.log('Antifungal spectrum passed: original 8×6 October matrix, 48 explanatory cells, clinical isolation and source allowlist.');
