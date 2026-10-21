import fs from 'node:fs';import {launchFor} from './games.mjs';
export function gameStatus(game,config){
 if(game.demo)return {status:'NEEDS_REVIEW',problems:['NO_LOCAL_FILE']};const problems=[];try{if(!fs.statSync(game.path).isFile())problems.push('FILE_MISSING');}catch{problems.push('FILE_MISSING');}
 if(game.needsReview)problems.push('NEEDS_REVIEW');if(!problems.includes('FILE_MISSING'))try{launchFor(game,config,process.execPath);}catch{problems.push('EMULATOR_MISSING');}
 if(!game.bindings?.[config.account])problems.push('STEAM_NOT_ADDED');if(!game.metadata?.summary||!game.art?.cover)problems.push('METADATA_INCOMPLETE');return {status:problems[0]||'READY',problems};
}
