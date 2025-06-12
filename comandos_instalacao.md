# Comandos para Instalação e Execução

## Instalação para Desenvolvimento

1. Primeiro, instale as dependências:

```
npm install
```

2. Para executar em modo de desenvolvimento:

```
npm run dev
```

## Compilação e Geração do Executável

1. Compile o código React:

```
npm run build
```

2. Gere o executável para Windows:

```
npm run make
```

3. O executável será gerado na pasta `dist/win-unpacked` e o instalador na pasta `dist`.

## Passos Adicionais Necessários

1. Antes de executar o aplicativo, crie uma pasta `assets` na raiz do projeto e adicione:
   - `icon.ico` - Ícone para Windows
   - `icon.png` - Ícone para Linux
   - `logo.png` - Logo para exibir no aplicativo

2. Verifique as credenciais do Supabase no arquivo `src/utils/supabaseClient.js` 