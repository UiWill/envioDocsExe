# Configuração de Ícones - EnvioDocs

## Localização dos Ícones

Os ícones do aplicativo estão localizados em:
- `./assets/icon.png` - Ícone principal (formato PNG)
- `./assets/icon.ico` - Ícone para Windows (formato ICO)
- `./assets/icon.icns` - Ícone para macOS (formato ICNS)

## Como os Ícones são Usados

### 1. Janela do Aplicativo (main.js)
```javascript
icon: path.join(__dirname, 'assets/icon.png')
```

### 2. Build do Electron Forge (forge.config.js)
```javascript
packagerConfig: {
  icon: './assets/icon', // auto-adiciona .ico/.icns/.png
  executableName: 'EnvioDocs'
}
```

### 3. Instaladores (electron-builder.json)
- **Windows**: `assets/icon.ico`
- **macOS**: `assets/icon.icns`
- **Linux**: `assets/icon.png`

## Fonte do Ícone

O ícone é baseado na logo oficial da EnvioDocs:
- Arquivo original: `./public/assets/IMG/imagem.png`
- Tamanho recomendado: 1024x1024 px mínimo

## Como Atualizar o Ícone

1. Substitua o arquivo `./public/assets/IMG/imagem.png` com a nova logo
2. Execute os comandos:
   ```bash
   # Copiar para assets
   Copy-Item "./public/assets/IMG/imagem.png" "./assets/icon.png"
   Copy-Item "./public/assets/IMG/imagem.png" "./assets/icon.ico"
   Copy-Item "./public/assets/IMG/imagem.png" "./assets/icon.icns"
   
   # Rebuild
   npm run build
   npm start
   ```

## Notas Técnicas

- O Windows pode usar PNG como ICO em versões recentes do Electron
- Para melhor compatibilidade, converta PNG para ICO usando ferramentas específicas
- O arquivo ICNS é necessário para builds do macOS
- Todos os ícones devem ter proporção 1:1 (quadrados) 