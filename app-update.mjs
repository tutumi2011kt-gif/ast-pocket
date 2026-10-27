/**
 * GitHub Pages / iPhone home-screen app update detection.
 * This checks a published deployment marker; it does not claim changes
 * until the deployment manifest actually becomes accessible.
 */
export const VERSION_URL='version.json';
const shaRx=/^[a-f0-9]{40}$/;
export const validCommitSha=x=>typeof x==='string'&&shaRx.test(x);
export function embeddedBuild(doc){
 const sha=doc?.querySelector?.('meta[name="ast-pocket-build"]')?.getAttribute?.('content');
 return validCommitSha(sha)?sha:null;
}
export async function fetchPublishedBuild({fetchImpl=fetch,now=Date.now}={}){
 const result=await fetchImpl(VERSION_URL+'?check='+encodeURIComponent(now()),{
  cache:'no-store',headers:{'Cache-Control':'no-cache'},redirect:'error'
 });
 if(!result?.ok)throw Error('公開バージョン情報を取得できませんでした');
 const data=await result.json();
 if(!validCommitSha(data?.commit))throw Error('公開バージョン情報が不正です');
 return data.commit;
}
export function compareBuilds(local,remote){
 if(!validCommitSha(remote))return 'unconfirmed';
 if(!validCommitSha(local))return 'unknown_local';
 return local===remote?'up_to_date':'new_release';
}
export function freshLaunchUrl(currentUrl,remote,nonce){
 if(!validCommitSha(remote))throw Error('Unverified deployment');
 if(!Number.isSafeInteger(nonce)||nonce<0)throw Error('Invalid update nonce');
 const url=new URL('./',currentUrl);
 url.searchParams.set('refresh',remote.slice(0,12));
 url.searchParams.set('t',String(nonce));
 return url.href;
}
