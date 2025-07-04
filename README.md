# EnvioDocsAPI - Sistema de Processamento de Documentos Fiscais

Sistema inteligente para processamento automático de documentos fiscais brasileiros usando IA Gemini 2.0 Flash.

## 🚀 Funcionalidades

- ✅ **Processamento via IA**: Extração automática de dados usando Gemini 2.0 Flash
- ✅ **Documentos Suportados**: DARF, FGTS, DAE, PGDAS, eSocial, Honorários, Alvará, GPS, Parcelamentos
- ✅ **Correção Manual**: Interface para correção de dados quando necessário
- ✅ **Armazenamento**: Integração com Supabase para persistência de dados
- ✅ **Drag & Drop**: Interface intuitiva para upload de PDFs

## 🌐 Versões Disponíveis

### **Versão Web** (GitHub Pages)
- **URL**: [https://seu-usuario.github.io/seu-repositorio](https://seu-usuario.github.io/seu-repositorio)
- **Acesso**: Direto pelo navegador, sem instalação
- **Atualizações**: Automáticas a cada commit

### **Versão Desktop** (Electron)
- **Plataformas**: Windows, macOS, Linux
- **Instalação**: Arquivo executável
- **Funcionalidades**: Idênticas à versão web

## 🛠️ Tecnologias

- **Frontend**: React 18 + Vite
- **IA**: Google Gemini 2.0 Flash API
- **Banco de Dados**: Supabase
- **Desktop**: Electron
- **Deploy**: GitHub Pages + GitHub Actions

## 📋 Pré-requisitos

- Node.js 18+
- Conta no Supabase
- API Key do Google Gemini

## 🚀 Instalação e Uso

### Desenvolvimento Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev

# Acesse: http://localhost:5173
```

### Build para Produção

```bash
# Build para web
npm run build

# Preview da build
npm run preview

# Build para desktop (Electron)
npm run package
```

## 🔧 Configuração

### Supabase
1. Crie um projeto no [Supabase](https://supabase.com)
2. Configure as tabelas necessárias (veja `create_document_types_table.sql`)
3. Atualize as credenciais em `src/utils/supabaseClient.js`

### Gemini API
1. Obtenha uma API Key no [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Configure a chave em `src/utils/pdfProcessor.js`

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── Explorer.jsx     # Interface principal
│   ├── PDFForm.jsx      # Formulário de correção
│   └── LogPanel.jsx     # Painel de logs
├── utils/               # Utilitários
│   ├── pdfProcessor.js  # Processamento via IA
│   ├── fileManager.js   # Gerenciamento de arquivos
│   └── supabaseClient.js # Cliente Supabase
└── styles/              # Estilos CSS
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para suporte e dúvidas, entre em contato através dos issues do GitHub. #   e n v i o D o c s E x e  
 