# Changelog UI - EnvioDocs

## ✨ Melhorias de Interface (Última Atualização)

### 🗑️ Nova Funcionalidade: Botão "Limpar Logs e Arquivos"
- **Removido**: Botão "Selecionar Arquivos" 
- **Adicionado**: Botão "🗑️ Limpar Logs e Arquivos" com design vermelho
- **Funcionalidade**: Reset completo da interface para novo lote de processamento

### 🎯 Fluxo de Trabalho Simplificado
- **Apenas Drag & Drop**: Sistema focado exclusivamente em arrastar e soltar
- **Processamento por Lotes**: Usuário processa um lote, corrige erros, limpa e processa novo lote
- **Interface Limpa**: Evita poluição visual acumulada durante o dia de trabalho

### 📝 Melhorias nas Mensagens
- **Drop Area**: Mensagens mais claras sobre o processo
- **Feedback Visual**: Contador de arquivos processados com ✅
- **Instruções Contextuais**: Orientações sobre quando usar o botão limpar

### 🎨 Estilo do Botão Limpar
```css
background: linear-gradient(135deg, #DC3545 0%, #C82333 100%)
hover: translateY(-2px) + sombra expandida
ícone: 🗑️ + texto "Limpar Logs e Arquivos"
```

### 🔄 Funcionalidades do Reset
O botão "Limpar" executa:
- ✅ Limpa lista de arquivos processados
- ✅ Limpa todos os logs
- ✅ Remove fila de processamento
- ✅ Fecha formulários abertos
- ✅ Para processamento em andamento
- ✅ Reset do progresso
- ✅ Mensagem de confirmação

### 🎯 Casos de Uso
1. **Fim do Expediente**: Limpar tudo antes de fechar
2. **Novo Cliente**: Processar documentos de cliente diferente
3. **Erro de Lote**: Recomeçar com arquivos corretos
4. **Interface Sobrecarregada**: Reset para melhor visibilidade

---
*Atualização implementada com foco na experiência do usuário e produtividade do operador.* 

## Versão 2.6 - Login Simplificado com CNPJ

### 🔐 Melhoria no Sistema de Login (Dezembro 2024)
- **MUDANÇA**: Campo "Email" substituído por "CNPJ" na tela de login
- **AUTOMAÇÃO**: Sistema adiciona automaticamente "@gmail.com" ao CNPJ informado
- **TRANSPARÊNCIA**: Usuário pensa que precisa apenas de CNPJ + senha

### ✨ Melhorias Implementadas
1. **Interface Simplificada**:
   - Campo "Email" → Campo "CNPJ"
   - Placeholder: "00.000.000/0000-00"
   - Formatação automática durante digitação

2. **Conversão Automática**:
   - Usuário digita: "24.831.337/0001-09"
   - Sistema converte para: "24.831.337/0001-09@gmail.com"
   - Login realizado com email completo internamente

3. **Validação Integrada**:
   - Formatação automática com máscara
   - Validação de 14 dígitos obrigatórios
   - Mensagens de erro específicas para CNPJ

4. **Experiência do Usuário**:
   - Interface mais intuitiva para contabilidade
   - Processo simplificado (CNPJ + senha)
   - Mantém compatibilidade com sistema existente

### 🔧 Arquivo Modificado
#### `src/components/Login.jsx`
- Campo email substituído por CNPJ
- Função `formatCNPJ()` para máscara automática
- Função `cnpjToEmail()` para conversão
- Validação específica para CNPJ (14 dígitos)

### 🎯 Resultado Final
- ✅ **Login simplificado** com CNPJ
- ✅ **Formatação automática** (XX.XXX.XXX/XXXX-XX)
- ✅ **Conversão transparente** para email
- ✅ **Compatibilidade total** com sistema existente

### 📋 Como Funciona
```
Usuário digita: 24.831.337/0001-09
Sistema processa: 24.831.337/0001-09@gmail.com
Login: Realizado com email completo
Resultado: Usuário logado com sucesso
```

---

## Versão 2.5 - DevTools Desabilitado por Padrão

### 🛠️ Configuração de Produção (Dezembro 2024)
- **MUDANÇA**: DevTools não abre mais automaticamente com o aplicativo
- **MOTIVO**: Após conclusão dos testes, interface mais limpa para uso em produção
- **ACESSO**: DevTools ainda disponível via atalho `Ctrl+Shift+I` quando necessário

### ✨ Melhoria Implementada
1. **Interface Limpa**:
   - Aplicativo inicia sem painel de DevTools
   - Foco total na interface de trabalho
   - Experiência mais profissional

2. **Acesso Sob Demanda**:
   - Atalho `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Shift+I` (Mac)
   - DevTools disponível quando necessário para debugging
   - Configuração flexível para desenvolvimento vs produção

### 🔧 Arquivo Modificado
#### `main.js`
- Comentada linha `mainWindow.webContents.openDevTools()`
- Mantido atalho para acesso via teclado
- Interface mais limpa por padrão

### 🎯 Resultado Final
- ✅ **Interface limpa** sem DevTools automático
- ✅ **Atalho funcional** para acesso quando necessário
- ✅ **Experiência profissional** para usuários finais

---

## Versão 2.4 - Nomenclatura Específica de Parcelamentos

### 🏷️ Melhoria na Identificação de Parcelamentos (Dezembro 2024)
- **PROBLEMA RESOLVIDO**: Sistema agora mantém nome específico dos tipos de parcelamento
- **ANTES**: Todos os parcelamentos eram identificados como "PARCELAMENTO" genérico
- **AGORA**: Preserva o nome específico do arquivo (ex: "PARCELAMENTO_ICMS", "PARCELAMENTO_INCS")

### ✨ Melhorias Implementadas
1. **Nomenclatura Preservada**:
   - `PARCELAMENTO_ICMS.pdf` → NOME_PDF: "PARCELAMENTO_ICMS"
   - `PARCELAMENTO_INCS.pdf` → NOME_PDF: "PARCELAMENTO_INCS"
   - `PARCELAMENTO_ISS.pdf` → NOME_PDF: "PARCELAMENTO_ISS"
   - Qualquer outro tipo específico é preservado

2. **Prompt da IA Otimizado**:
   - Instruções claras para usar nome do arquivo sem extensão
   - Prioridade máxima para detecção de parcelamentos
   - Exemplos específicos para melhor compreensão

3. **Validação Expandida**:
   - Lista de tipos válidos atualizada
   - Suporte a qualquer variação de PARCELAMENTO_*
   - Mantém compatibilidade com tipos existentes

### 🎯 Benefícios
- **Diferenciação Clara**: Cada tipo de parcelamento é identificado especificamente
- **Organização Melhor**: Contabilidade pode distinguir facilmente os tipos
- **Flexibilidade**: Suporta novos tipos de parcelamento automaticamente
- **Precisão**: Nome exato conforme arquivo original

### 🔧 Arquivo Modificado
#### `src/utils/pdfProcessor.js`
- Prompt atualizado com instruções específicas para parcelamentos
- Lista de tipos válidos expandida
- Priorização da nomenclatura específica

### 📋 Resultado Final
- ✅ **PARCELAMENTO_ICMS** mantém nome específico
- ✅ **PARCELAMENTO_INCS** mantém nome específico  
- ✅ **PARCELAMENTO_ISS** mantém nome específico
- ✅ Qualquer novo tipo de parcelamento é preservado automaticamente

---

## Versão 2.3 - Correções e Otimizações

### 🔧 Correções Implementadas (Dezembro 2024)
- **POSIÇÃO CORRIGIDA**: Logs agora à esquerda, área principal à direita
- **SCROLL FUNCIONAL**: Painel de logs agora permite scroll completo
- **LOGS FILTRADOS**: Apenas logs essenciais são exibidos

### ✨ Melhorias Específicas
1. **Layout Corrigido**:
   - Grid: logs (400px) à esquerda + área principal (1fr) à direita
   - Posicionamento mais intuitivo para fluxo de trabalho

2. **Scroll Otimizado**:
   - `overflow-y: auto` funcional no painel de logs
   - `max-height` definida para evitar overflow
   - Scroll suave e responsivo

3. **Logs Essenciais Apenas**:
   - ✅ **Logs de Sucesso**: Arquivos processados com sucesso
   - ⚠️ **Logs de Correção**: Arquivos que precisam de correção manual
   - 📄 **Logs de Fila**: Quantos arquivos foram adicionados para processamento
   - 🗑️ **Log de Limpeza**: Interface limpa e pronta para novos arquivos
   - ❌ **Removidos**: Logs de carregamento, processamento intermediário e outros desnecessários

### 🎯 Resultado Final
- **Interface limpa** com apenas informações relevantes
- **Navegação fluida** com scroll funcional
- **Layout intuitivo** (logs à esquerda, trabalho à direita)
- **Menos poluição visual** nos logs

---

## Versão 2.2 - Layout Lateral Otimizado (Sistema Lista)

### 🔄 Retorno ao Layout Lateral (Dezembro 2024)
- **MUDANÇA PRINCIPAL**: Painel de logs voltou para o lado direito (layout horizontal)
- **MOTIVAÇÃO**: Criar um sistema tipo "master-detail" com lista de logs lateral
- **BENEFÍCIOS**:
  - Visão de lista dos logs sempre visível ao lado
  - Área principal ampla para correção de PDFs
  - Fluxo de trabalho: lista lateral → área principal para edição
  - Sistema mais intuitivo tipo aplicativo desktop

### ✨ Melhorias Implementadas
1. **Layout Horizontal Otimizado**:
   - Grid: área principal (1fr) + painel logs (400px)
   - Logs como painel lateral fixo
   - Área principal para drop e formulários de correção

2. **Sistema Master-Detail**:
   - Lista de logs permanentemente visível
   - Clique para corrigir abre formulário na área principal
   - Melhor aproveitamento do espaço horizontal

3. **Responsividade Melhorada**:
   - Em telas menores: layout empilhado vertical
   - Logs no topo (300px) e área principal embaixo
   - Adaptação automática para mobile/tablet

### 🔧 Arquivos Modificados

#### `src/styles/Explorer.css`
- Layout voltou para `display: grid` horizontal
- Grid: `1fr 400px` (área principal + logs)
- Responsividade: empilha verticalmente em telas pequenas
- Área de drop volta ao tamanho original

#### `src/styles/LogPanel.css`
- Altura: `100%` para ocupar todo o espaço lateral
- Otimizado para funcionar como painel lateral

### 🎯 Resultado Final
- **Sistema tipo lista lateral** para logs
- **Área principal ampla** para operações
- **Formulário de correção** abre na área principal
- **Interface desktop profissional**
- **Responsiva** em todos os dispositivos

---

## Versão 2.1 - Layout Vertical Melhorado

### 🎨 Reorganização da Interface (Dezembro 2024)
- **MUDANÇA PRINCIPAL**: Moveu a área de arrastar e soltar PDFs para embaixo do painel de logs
- **MOTIVAÇÃO**: Facilitar o trabalho da contabilidade, deixando os logs mais visíveis e acessíveis
- **BENEFÍCIOS**:
  - Painel de logs ocupa mais espaço na tela (60-70% da altura)
  - Área de drop mais compacta e funcional na parte inferior
  - Melhor fluxo de trabalho: visualizar logs → processar novos arquivos
  - Interface mais intuitiva para uso profissional

### ✨ Melhorias Implementadas
1. **Layout Vertical**:
   - Mudança de grid horizontal para flexbox vertical
   - Painel de logs no topo (altura: 60vh)
   - Área de drop embaixo (altura: 200-400px)

2. **Responsividade**:
   - Ajustes para telas menores (mobile/tablet)
   - Área de drop se adapta melhor em dispositivos móveis
   - Botões de ação se reorganizam verticalmente em telas pequenas

3. **Melhorias Visuais**:
   - Separador visual entre logs e área de drop
   - Hover effects melhorados na área de drop
   - Ícone PDF redimensionado para melhor proporção
   - Textos ajustados para o novo layout

4. **Usabilidade**:
   - Drag & drop continua funcionando normalmente
   - Todos os botões de ação (Corrigir, Tentar Novamente) mantidos
   - Funcionalidade de processamento inalterada

### 🔧 Arquivos Modificados

#### `src/components/Explorer.jsx`
- Reorganização da estrutura JSX
- LogPanel movido para o topo
- Drop area movida para baixo

#### `src/styles/Explorer.css`  
- Layout alterado de `grid` para `flex-direction: column`
- Altura da drop area limitada (min: 200px, max: 400px)
- Melhorias de responsividade
- Separador visual adicionado

#### `src/styles/LogPanel.css`
- Altura definida como 60vh (com min/max)  
- Flex: 1 para ocupar espaço disponível
- Otimizado para layout vertical

### 🎯 Resultado Final
- **Interface mais profissional** para contabilidade
- **Logs sempre visíveis** no topo da tela
- **Área de processamento** facilmente acessível embaixo
- **Mantém toda funcionalidade** existente
- **Responsiva** em todos os dispositivos

---

## Versão 2.0 - Integração Gemini AI

### 🤖 Processamento por IA (Dezembro 2024)
- Substituição completa do OCR.space por Gemini AI
- Processamento direto PDF → IA → Supabase
- Remoção de todas as funções de regex
- Sistema mais inteligente e preciso

### ✨ Melhorias na Extração
- Detecção automática de tipos de documento
- Extração contextual de dados
- Tratamento específico por tipo (HONORARIOS, DARF, etc.)
- Validação inteligente de CNPJs
- Retry automático com backoff exponencial

---

## Versão 1.0 - Sistema Base

### 📁 Funcionalidades Iniciais
- Drag & drop de PDFs
- Processamento OCR básico
- Extração por regex
- Salvamento no Supabase
- Interface desktop Electron 