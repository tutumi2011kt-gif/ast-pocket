import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderSpectrum,validateSpectrum} from '../antifungal-spectrum.mjs';
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const data=JSON.parse(fs.readFileSync('content/spectrum/antifungal-2026-10.json','utf8'));
assert.ok(validateSpectrum(data));
const required=[
 "import {ANTIFUNGAL_SPECTRUM_PATH,validateSpectrum,renderSpectrum}",
 'spectrumData:null',
 "function openSpectrum(){",
 "if(state.mode!=='study')return;",
 "navigate('spectrum'",
 "function spectrumView(){",
 "state.mode==='study'?state.spectrumData:null",
 "if(state.mode==='study'&&q&&['抗真菌'",
 "r.type==='抗真菌薬スペクトル'",
 "state.view==='spectrum'",
 "function bindSearchPanel(){",
 "document.querySelectorAll('[data-open-spectrum]').forEach(el=>el.onclick=openSpectrum)",
 "if(state.view!=='search')document.querySelectorAll('[data-open-spectrum]')",
 "document.querySelectorAll('[data-spectrum-organism]')",
 "document.querySelectorAll('[data-spectrum-cell]')",
 "document.querySelector('[data-spectrum-clear]')",
 "t.topic_id==='cross-antifungal-spectrum'",
 "state.spectrumOrganism=previous.spectrumOrganism",
 "if(state.view==='spectrum')return '抗真菌薬スペクトル'"
];
for(const phrase of required)assert.ok(app.includes(phrase),'Missing UI link/guard: '+phrase);
assert.ok(app.includes('data-open-spectrum'));
assert.ok(app.includes('spectrum-home-link'));
assert.ok(css.includes('position:sticky'),'Pinned row titles expected');
assert.ok(css.includes('.spectrum-scroll'));
assert.ok(css.includes('overflow-x:auto'));
assert.ok(css.includes('.spectrum-filters'));
const all=renderSpectrum({mode:'study',data,selectedOrganism:'all'});
const one=renderSpectrum({mode:'study',data,selectedOrganism:'cryptococcus'});
assert.equal((all.match(/data-spectrum-cell=/g)||[]).length,48);
assert.equal((one.match(/data-spectrum-cell=/g)||[]).length,8);
assert.ok(one.includes('aria-pressed="true"'));
assert.ok(all.includes('同日の学習表')===false); // Source date is stated, not invented.
const clinical=renderSpectrum({mode:'clinical',data,selectedCell:'5fc:cryptococcus'});
assert.ok(!clinical.includes('data-spectrum-cell'));
assert.ok(!clinical.includes('data-spectrum-organism'));
assert.ok(!clinical.includes('Cryptococcus'));
assert.ok(!clinical.includes('L-AMB'));
console.log('Spectrum UI contract passed: Study Home/Library/Topic/Search link, filtering, browser-safe scroll, clinical redaction.');
