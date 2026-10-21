import path from 'node:path';
import {titleKey} from './metadata.mjs';
// Exact title + compatible platform is deliberately stricter than fuzzy art search.
export function exactIdentity(item, results){
 const platform=item.platformName, known=platform&&platform!=='Não informada';
 if(!known||item.auxiliary)return null;
 const matches=(results.igdb||[]).filter(g=>(g.platforms||[]).some(p=>p.name===platform)&&[g.name,...(g.alternative_names||[]).map(a=>a.name)].some(n=>titleKey(n)===titleKey(item.title)));
 const unique=[...new Map(matches.map(g=>[g.id,g])).values()];
 if(unique.length!==1)return null;
 const igdb=unique[0],arts=(results.sgdb||[]).filter(g=>titleKey(g.name)===titleKey(igdb.name));
 return {name:igdb.name,igdb,sgdb:arts.length===1?arts[0]:undefined,platforms:igdb.platforms};
}
export function identityKey(g){
 // A sampled fingerprint is useful for moves, never sufficient to remember a choice.
 if(g.fingerprintKind!=='full'||!g.fingerprint)return null;
 // Shared launcher binaries can occur in unrelated Windows installations.
 const context=g.profile==='pc'?':'+path.basename(g.gameRoot||g.suggestedRoot||path.dirname(g.path||'')).toLowerCase():'';
 return 'sha256:'+g.fingerprint+context;
}
export function internallyIdentified(g){
 return !!(g.identitySource&&g.internalTitle&&g.discId&&!g.auxiliary&&!g.needsReview);
}
