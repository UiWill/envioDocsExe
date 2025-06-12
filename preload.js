const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Expõe funcionalidades seguras para o renderer process
contextBridge.exposeInMainWorld('electron', {
  // Funções relacionadas a arquivos
  fileSystem: {
    selectFile: () => ipcRenderer.invoke('select-file'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    getFileName: (filePath) => path.basename(filePath),
  },
  
  // Funções de comunicação
  notifications: {
    showNotification: (message) => {
      new Notification('EnvioDocsAPI', { body: message });
    }
  }
});

// Captura de eventos de arrastar/soltar do sistema de arquivos
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = [];
    for (const file of e.dataTransfer.files) {
      if (file.path.toLowerCase().endsWith('.pdf')) {
        files.push(file.path);
      }
    }
    
    if (files.length > 0) {
      // Envia evento para o renderer sobre arquivos soltos
      window.postMessage({
        type: 'drop-files',
        payload: files
      });
    }
  });
}); 