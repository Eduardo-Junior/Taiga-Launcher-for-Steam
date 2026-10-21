// Ponte mínima para a página: só o caminho de arquivos soltos na janela (arrastar e soltar jogos).
const {contextBridge,webUtils}=require('electron');
contextBridge.exposeInMainWorld('taigaDesktop',{pathForFile:file=>{try{return webUtils.getPathForFile(file)||'';}catch{return '';}}});
