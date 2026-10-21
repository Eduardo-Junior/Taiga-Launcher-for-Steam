// Existing integration scenarios now explicitly confirm their reviewed candidates.
export async function importScanned(api,body){
 const preview=await api('scan',{...body,preview:true});
 if(!preview.items.length)return {...preview,added:0,addedIds:[]};
 const result=await api('import-confirm',{scanId:preview.scanId,items:preview.items});
 return {...result,skipped:(result.skipped||0)+(preview.skipped||0),errors:[...preview.errors,...result.errors]};
}
