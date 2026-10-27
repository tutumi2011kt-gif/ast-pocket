import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 VERSION_URL,embeddedBuild,fetchPublishedBuild,compareBuilds,freshLaunchUrl
} from '../app-update.mjs';
import {preparePagesVersion} from './prepare-pages-version.mjs';

const a='a'.repeat(40),b='b'.repeat(40);
assert.equal(VERSION_URL,'version.json');
assert.equal(compareBuilds(a,a),'up_to_date');
assert.equal(compareBuilds(a,b),'new_release');
assert.equal(compareBuilds(null,b),'unknown_local');
assert.equal(compareBuilds(a,'not-sha'),'unconfirmed');
assert.equal(embeddedBuild({querySelector:()=>({getAttribute:()=>a})}),a);
assert.equal(embeddedBuild({querySelector:()=>null}),null);
const good=await fetchPublishedBuild({fetchImpl:async(url,opts)=>{
 assert.match(url,/^version\.json\?check=1234$/);
 assert.equal(opts.cache,'no-store');
 assert.equal(opts.redirect,'error');
 return {ok:true,json:async()=>({schema_version:1,commit:b})};
},now:()=>1234});
assert.equal(good,b);
await assert.rejects(()=>fetchPublishedBuild({fetchImpl:async()=>({ok:false})}),/公開バージョン/);
await assert.rejects(()=>fetchPublishedBuild({fetchImpl:async()=>({ok:true,json:async()=>({commit:'fake'})})}),/不正/);
const refresh=freshLaunchUrl('https://tutumi2011kt-gif.github.io/ast-pocket/index.html',b,1234);
assert.equal(refresh,'https://tutumi2011kt-gif.github.io/ast-pocket/?refresh=bbbbbbbbbbbb&t=1234');
assert.throws(()=>freshLaunchUrl('https://test.local/app/', 'bad',1234),/Unverified/);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'ast-pocket-build-'));
try{
 for(const name of ['index.html','app.js','review-feature.mjs','review-store.mjs']){
  fs.copyFileSync(name,path.join(root,name));
 }
 const first=preparePagesVersion({root,sha:a,builtAt:'2026-10-27T00:00:00.000Z'});
 assert.equal(first.sha,a);
 assert.ok(first.updatedBrowserModules.includes('app.js'));
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(index,/href="styles\.css\?v=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
 assert.match(index,/src="app\.js\?v=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
 assert.match(index,/meta name="ast-pocket-build" content="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.ok(app.includes("./app-update.mjs?v="+a));
 assert.ok(app.includes("./ampc-study.mjs?v="+a));
 assert.ok(app.includes("./antifungal-spectrum.mjs?v="+a));
 const feature=fs.readFileSync(path.join(root,'review-feature.mjs'),'utf8');
 assert.ok(feature.includes('?v='+a),'Imports inside nested browser module must be stamped');
 const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
 assert.deepEqual(version,{schema_version:1,commit:a,built_at:'2026-10-27T00:00:00.000Z'});
 preparePagesVersion({root,sha:b,builtAt:'2026-10-27T01:00:00.000Z'});
 const next=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(next.includes('app.js?v='+b));
 assert.ok(!next.includes('app.js?v='+a));
 assert.equal((next.match(/name="ast-pocket-build"/g)||[]).length,1);
 assert.ok(fs.readFileSync(path.join(root,'app.js'),'utf8').includes('./app-update.mjs?v='+b));
 assert.ok(!fs.readFileSync(path.join(root,'app.js'),'utf8').includes('./app-update.mjs?v='+a));
 assert.throws(()=>preparePagesVersion({root,sha:'invalid'}),/GITHUB_SHA/);
}finally{fs.rmSync(root,{recursive:true,force:true})}

const appText=fs.readFileSync('app.js','utf8');
const source=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert.ok(appText.includes('id="updateAppBtn"'));
assert.ok(appText.includes('id="appUpdateStatus"'));
assert.ok(appText.includes('window.location.replace(freshLaunchUrl'));
assert.ok(appText.includes("window.addEventListener('pageshow'"));
assert.ok(appText.includes("document.addEventListener('visibilitychange'"));
assert.ok(appText.includes('checkLatestRelease(true)'));
assert.ok(appText.includes('新しい版があります'));
assert.ok(appText.includes("fetch('content/index.json',{cache:'no-store'})"));
assert.ok(source.includes('node scripts/prepare-pages-version.mjs'));
assert.ok(source.indexOf('node scripts/prepare-pages-version.mjs')<source.indexOf('actions/upload-pages-artifact@v3'));
const pwa=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(pwa.display,'standalone');
assert.equal(pwa.start_url,'./');
console.log('PWA cache version tests passed: version manifest, CSS/JS/module busting, installed-app check, and one-tap refresh.');
