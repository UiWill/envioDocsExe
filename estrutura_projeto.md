# Estrutura do Projeto EnvioDocsAPI

```
/EnvioDocsAPIexe
  ├── package.json
  ├── main.js               # Ponto de entrada principal Electron
  ├── preload.js            # Script de pré-carregamento Electron
  ├── src/
  │   ├── components/       # Componentes React
  │   │   ├── Login.jsx     # Tela de login
  │   │   ├── Explorer.jsx  # Explorador estilo Windows
  │   │   ├── PDFForm.jsx   # Formulário para edição manual
  │   │   └── LogPanel.jsx  # Painel de logs
  │   ├── utils/
  │   │   ├── supabaseClient.js  # Cliente Supabase
  │   │   ├── pdfProcessor.js    # Extração de dados do PDF
  │   │   └── fileManager.js     # Gerenciamento de arquivos
  │   ├── App.jsx           # Componente principal
  │   ├── index.html        # HTML principal
  │   └── index.js          # Ponto de entrada React
  └── electron-builder.json  # Configuração para empacotamento
``` 