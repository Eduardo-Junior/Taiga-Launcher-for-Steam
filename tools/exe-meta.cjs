// Ícone e dados do .exe (versão, nome, direitos) gravados no executável do Electron. Usa o resedit (MIT, jet2jet):
// npm i resedit  |  node tools/exe-meta.cjs "Taiga Launcher.exe" saida.exe resources/app/desktop/icon.ico 2.3.8
const fs=require('fs');let R;try{R=require('resedit');}catch{R=require('./resedit.cjs');}
const [,,input,output,ico,version]=process.argv;
const exe=R.NtExecutable.from(fs.readFileSync(input),{ignoreCert:true});
const res=R.NtExecutableResource.from(exe);
const iconFile=R.Data.IconFile.from(fs.readFileSync(ico));
const groups=R.Resource.IconGroupEntry.fromEntries(res.entries);
const gid=groups.length?groups[0].id:1,lang=groups.length?groups[0].lang:1033;
R.Resource.IconGroupEntry.replaceIconsForResource(res.entries,gid,lang,iconFile.icons.map(i=>i.data));
const vis=R.Resource.VersionInfo.fromEntries(res.entries);const vi=vis[0]||R.Resource.VersionInfo.createEmpty();
const [a,b,c]=version.split('.').map(Number);
vi.setFileVersion(a,b,c,0,1033);vi.setProductVersion(a,b,c,0,1033);
const langs=vi.getAllLanguagesForStringValues();const lang2=langs[0]||{lang:1033,codepage:1200};
vi.setStringValues(lang2,{ProductName:'Taiga Launcher',FileDescription:'Taiga Launcher',CompanyName:'Taiga',LegalCopyright:'© 2026 Taiga (GabrielTaiga). Apache License 2.0.',OriginalFilename:'Taiga Launcher.exe',InternalName:'Taiga Launcher',FileVersion:version,ProductVersion:version});
vi.outputToResourceEntries(res.entries);res.outputResource(exe);
fs.writeFileSync(output,Buffer.from(exe.generate()));
const check=R.Resource.VersionInfo.fromEntries(R.NtExecutableResource.from(R.NtExecutable.from(fs.readFileSync(output),{ignoreCert:true})).entries)[0];
console.log(JSON.stringify(check.getStringValues(lang2)));
