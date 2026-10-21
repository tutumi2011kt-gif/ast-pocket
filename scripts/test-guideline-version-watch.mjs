import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractSourceUpdateDate,observeIDSAEdition} from './watch-official-sab-guideline.mjs';
const ledger=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
const html=date=>'<html><head></head><body><h1>IDSA SAB Part 1</h1><p>Published September 09, 2026</p><p>Last Updated '+date+'</p><h2>Statement 2</h2></body></html>';
assert.equal(extractSourceUpdateDate(html('September 09, 2026')),'2026-09-09');
assert.equal(extractSourceUpdateDate(html('October 20, 2026')),'2026-10-20');
assert.equal(extractSourceUpdateDate(html('February 30, 2026')),null);
assert.equal(extractSourceUpdateDate('<html><body>Published September 09, 2026</body></html>'),null);
const fake=date=>async(url,opts)=>{
 assert.ok(url.startsWith('https://www.idsociety.org/practice-guideline/'));
 assert.equal(opts.redirect,'manual');
 return {ok:true,status:200,headers:{get:n=>n==='content-type'?'text/html':null},
  text:async()=>html(date)};
};
const unchanged=await observeIDSAEdition(ledger,{fetchImpl:fake('September 09, 2026')});
assert.equal(unchanged.status,'no_new_version_observed');
assert.equal(unchanged.medical_approval,false);
const newer=await observeIDSAEdition(ledger,{fetchImpl:fake('October 20, 2026')});
assert.equal(newer.status,'recheck_required');
assert.ok(newer.affected_claim_ids.includes('mssa_tte'));
assert.ok(newer.affected_claim_ids.includes('gpc_repeat_cultures'));
assert.ok(!newer.affected_claim_ids.includes('mssa_cez'),'JAMA-based claim should not inherit IDSA change');
const older=await observeIDSAEdition(ledger,{fetchImpl:fake('January 01, 2025')});
assert.equal(older.status,'unconfirmed');
const noDate=await observeIDSAEdition(ledger,{fetchImpl:fake('February 30, 2026')});
assert.equal(noDate.status,'unconfirmed');
const blocked=await observeIDSAEdition(ledger,{fetchImpl:async()=>{throw Error('offline')}});
assert.equal(blocked.status,'unconfirmed');
const redirected=await observeIDSAEdition(ledger,{fetchImpl:async()=>({ok:false,status:302})});
assert.equal(redirected.status,'unconfirmed');
const changed={...ledger,sources:ledger.sources.map(x=>x.id==='idsa_sab2026'?
 {...x,url:'https://www.example.com/fake'}:x)};
await assert.rejects(()=>observeIDSAEdition(changed,{fetchImpl:fake('October 20, 2026')}),/Unsafe IDSA target/);
console.log('Official source revision watcher passed: stable edition, changed edition, malformed date, redirects, offline, and no medical auto-approval.');
