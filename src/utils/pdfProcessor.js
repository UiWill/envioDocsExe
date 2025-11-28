import { SHA256 } from 'crypto-js';
import axios from 'axios';
import { supabase, clientesAPI } from './supabaseClient';
import { ajustarDataParaDiaUtil } from './businessDays';

// Calcula o hash SHA-256
export const calculateHash = (buffer) => {
  return SHA256(buffer.toString()).toString();
};

// Busca tipos de documentos personalizados no banco
const getCustomDocumentTypes = async () => {
  try {
    const { data, error } = await supabase
      .from('DocumentTypes')
      .select('*');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar tipos de documentos personalizados:', error);
    return [];
  }
};

// Salva um novo tipo de documento no banco
export const saveNewDocumentType = async (typeName, keywords, sampleText) => {
  try {
    const { data, error } = await supabase
      .from('DocumentTypes')
      .insert([
        { 
          name: typeName,
          keywords: keywords,
          sample_text: sampleText
        }
      ]);
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Erro ao salvar novo tipo de documento:', error);
    return { success: false, error };
  }
};

// Função principal para processar o PDF usando Gemini AI
export const processPDF = async (pdfData, fileName = '') => {
  const MAX_RETRIES = 10; // Aumentado para permitir testar todas as combinações de modelos e chaves
  const INITIAL_DELAY = 2000; // 2 segundos

  // Lista de chaves API com fallback (usando variáveis de ambiente)
  const API_KEYS = [
    import.meta.env.VITE_GEMINI_API_KEY_1 || 'AIzaSyDDH2CMELlWqf2RRY5LkrHoY-QyZoYOEDs', // Chave principal
    import.meta.env.VITE_GEMINI_API_KEY_2 || 'AIzaSyDlXvRLEzSGML_CUrIztXNcgKArh7z1s_s'  // Chave de backup
  ].filter(key => key); // Remove chaves vazias

  // Lista de modelos para fallback (em ordem de preferência)
  const MODELS = [
    { name: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
    { name: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash Latest' },
    { name: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { name: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro Latest' },
    { name: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ];

  let currentKeyIndex = 0;
  let currentModelIndex = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${MAX_RETRIES} - Processamento do PDF via Gemini AI`);

      // Enviar PDF diretamente para Gemini API
      const apiKey = API_KEYS[currentKeyIndex];
      const model = MODELS[currentModelIndex];
      console.log(`🤖 Enviando PDF para ${model.label}... (chave ${currentKeyIndex + 1}/${API_KEYS.length}, modelo ${currentModelIndex + 1}/${MODELS.length})`);
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model.name}:generateContent`;
      
      const prompt = `
        Você é um especialista em extração de dados de documentos fiscais brasileiros.
        
        NOME DO ARQUIVO: ${fileName}
        
        Analise este PDF de documento fiscal e extraia as informações exatamente como aparecem.
        IMPORTANTE: Para documentos de PARCELAMENTO, extraia apenas a parte relevante do nome do arquivo (sem .pdf) como NOME_PDF.
        
        EXEMPLOS DE PARCELAMENTO:
        - Nome arquivo: "PARCELAMENTO INSS CAIU COMO DARF.pdf" → NOME_PDF: "PARCELAMENTO INSS"
        - Nome arquivo: "PARCELAMENTO IINSS CAIU COMO DARF.pdf" → NOME_PDF: "PARCELAMENTO INSS"
        - Nome arquivo: "PARCELAMENTO ICMS.pdf" → NOME_PDF: "PARCELAMENTO ICMS"
        - SEMPRE ignore palavras como "CAIU COMO DARF", "TESTE", "COPIA"
        
        Retorne APENAS um objeto JSON com estes campos:
        {
          "NOME_CLIENTE": string (nome completo da empresa/pessoa),
          "DATA_ARQ": string (data de vencimento no formato DD/MM/YYYY),
          "VALOR_PFD": string (valor total em formato numérico com ponto),
          "CNPJ_CLIENTE": string (CNPJ no formato XX.XXX.XXX/XXXX-XX),
          "NOME_PDF": string (DARF, FGTS, DAE, PGDAS, ESOCIAL, HONORARIOS, ALVARA, FOLHA DE PAG, RECIBO parcela 13  SALARIO, FOLHA DE ADIANTAMENTO, GPS, PARCELAMENTO_ICMS, PARCELAMENTO_INCS, PARCELAMENTO ou outros tipos específicos de parcelamento),
          "STATUS": "N"
        }
        
        Instruções específicas:
        1. Para VALOR_PFD: 
           - Converta valores com vírgula para ponto (ex: "1.234,56" -> "1234.56")
           - Para folha de pagamento, use o valor líquido
           - Para outros documentos, use o valor total/a pagar
        
        2. Para CNPJ_CLIENTE - ATENÇÃO ESPECIAL:
           - **Para FGTS - REGRA PRIORITÁRIA**:
             * SEMPRE procure no campo "CPF/CNPJ do Empregador"
             * ACEITE CNPJ PARCIAL mesmo com apenas 8 dígitos (ex: "57.611.495" ou "43.155.559")
             * Retorne EXATAMENTE como aparece no PDF, mantendo pontos e formatação
             * Exemplos válidos: "57.611.495", "43.155.559", "43155559"
           - **Para DAE (Documento de Arrecadação Estadual) - REGRA PRIORITÁRIA**:
             * ATENÇÃO: No rodapé do DAE SEMPRE aparece uma sequência de 14 dígitos SEM formatação - ESSE É O CNPJ!
             * PASSO A PASSO para encontrar o CNPJ em DAE:
               1. Varra TODO o documento procurando por qualquer sequência de EXATAMENTE 14 dígitos numéricos consecutivos
               2. Essa sequência pode aparecer em QUALQUER lugar: meio do documento, rodapé, antes de "ATENÇÃO: PAGAMENTO COM PIX"
               3. A sequência de 14 dígitos pode estar:
                  - Formatada: "41.894.000/0001-60" ou "54.539.129/0001-00"
                  - SEM NENHUMA formatação: "41894000000160", "51587654000102", "54539129000100", "57611495000102"
               4. Quando encontrar, FORMATE no padrão XX.XXX.XXX/XXXX-XX antes de retornar

             * IGNORE ESTES PADRÕES:
               - CNPJs mascarados no cabeçalho: "41.***.000/****-**", "51.***.654/****-**", "57.***.495/****-**"
               - "Número Documento" com formato "00.XXXXXXXXX-XX" (tem 13 dígitos, NÃO é CNPJ!)
               - Sequências que começam com "00." (são números de documento)

             * EXEMPLOS PRÁTICOS DE BUSCA:
               - Encontrou "41894000000160" no rodapé? → Retorne "41.894.000/0001-60"
               - Encontrou "51587654000102" no rodapé? → Retorne "51.587.654/0001-02"
               - Encontrou "54539129000100" no rodapé? → Retorne "54.539.129/0001-00"
               - Encontrou "57611495000102" no rodapé? → Retorne "57.611.495/0001-02"
               - Encontrou "41.894.000/0001-60" já formatado? → Retorne "41.894.000/0001-60"

             * IMPORTANTE: Procure por TODA sequência de 14 dígitos no documento. Ignore os campos "CNPJ" mascarados do cabeçalho.
           - **Para outros documentos**:
             * APENAS use CNPJs COMPLETOS e VISÍVEIS (14 dígitos)
             * Se o CNPJ estiver mascarado/oculto (ex: "56.***.*853.***-**"), retorne ""
             * Se aparecer apenas um número de documento que NÃO seja CNPJ, retorne ""
             * NUNCA use número de documento ou código de identificação como CNPJ
             * Mantenha a formatação XX.XXX.XXX/XXXX-XX para CNPJs completos
           - **Para HONORARIOS**: Se houver CNPJ válido (ex: "CNPJ/CPF: 27.894.767/0001-68"), use-o. Se só houver CPF, deixe ""
           - Para folha de pagamento, use o CNPJ do empregador (se visível)
           - Para documentos fiscais, use o CNPJ do contribuinte/empresa (se visível)
        
        3. Para DATA_ARQ:
           - Use a data de vencimento no formato DD/MM/YYYY
           - Para FOLHA DE PAG/FOLHA DE ADIANTAMENTO: SEMPRE use a data de recebimento/assinatura (geralmente aparece após "Vencimento:" ou "Data do Recebimento ASSINATURA"), NUNCA use a data de competência
           - Para documentos fiscais, use a data de vencimento
        
        4. Para NOME_PDF, siga EXATAMENTE estas regras na ordem de prioridade:
        
           **REGRA 1 - PARCELAMENTO (PRIORIDADE MÁXIMA - USA NOME DO ARQUIVO):**
           Se o nome do arquivo contém "PARCELAMENTO" OU código da receita 1124 OU número de referência começando com "021100":
           - Arquivo "PARCELAMENTO INSS CAIU COMO DARF.pdf" → retorne "PARCELAMENTO INSS"
           - Arquivo "PARCELAMENTO IINSS CAIU COMO DARF.pdf" → retorne "PARCELAMENTO INSS" 
           - Arquivo "PARCELAMENTO ICMS.pdf" → retorne "PARCELAMENTO ICMS"
           - Arquivo "PARCELAMENTO SIMPLES.pdf" → retorne "PARCELAMENTO SIMPLES"
           - SEMPRE ignore palavras como "CAIU COMO DARF", "TESTE", "COPIA"
           
           **REGRA 2 - HONORARIOS (PRIORIDADE MUITO ALTA - USA CONTEÚDO DO DOCUMENTO):**
           Se o documento é um BOLETO BANCÁRIO de escritório de contabilidade:
           - Contém "CONTABILIDADE" no beneficiário (ex: "AM CONTABILIDADE LTDA")
           - Tem "Boleto Pix" ou código de barras bancário
           - Tem campos típicos de boleto: "Nosso Número", "Agência", "Vencimento", "Valor do Documento"
           - Pagador/Sacado é uma EMPRESA DIFERENTE do beneficiário contabilidade
           - NÃO contém "Documento de Arrecadação" nem códigos de receita federal
           - SEMPRE retorne "HONORARIOS"
           
           **REGRA 3 - PGDAS (PRIORIDADE MUITO ALTA - USA CONTEÚDO DO DOCUMENTO):**
           Se o documento contém "Documento de Arrecadação do Simples Nacional" OU códigos "IRPJ - SIMPLES NACIONAL":
           - SEMPRE retorne "PGDAS" (baseado no conteúdo, ignore o nome do arquivo completamente)
           - Mesmo que o arquivo se chame "PGDAS CAIU COMO DARF.pdf", retorne apenas "PGDAS"
           
           **REGRA 4 - DARF (PRIORIDADE MÉDIA - USA CONTEÚDO DO DOCUMENTO):**
           Se o documento contém "Documento de Arrecadação de Receitas Federais" mas NÃO é parcelamento nem PGDAS:
           - SEMPRE retorne "DARF" (baseado no conteúdo, ignore o nome do arquivo)
           
           **OUTROS TIPOS:**
           - HONORARIOS: Boleto de honorários de escritório de contabilidade
           - FGTS: Guia de Recolhimento do FGTS ou GRF Digital
           - DAE: Documento de Arrecadação Estadual
           - ESOCIAL: Documento de Arrecadação do eSocial
           - ALVARA: Documento de Arrecadação Municipal (DAM)
           - FOLHA DE PAG: Recibo de pagamento/contracheque (contém "RECIBO DE PAGAMENTO DE CONTRIBUINTE INDIVIDUAL")
           - RECIBO parcela 13  SALARIO: Recibo de pagamento do 13º salário (contém "13º SALÁRIO" ou "13° SALÁRIO" ou "DECIMO TERCEIRO" ou "DÉCIMO TERCEIRO")
           - FOLHA DE ADIANTAMENTO: Recibo de adiantamento de salário (contém "RECIBO DE ADIANTAMENTO DE SALÁRIO")
           - GPS: Guia da Previdência Social
        
        5. Para NOME_CLIENTE - INSTRUÇÕES ESPECÍFICAS POR TIPO:
           - **Para HONORARIOS/BOLETOS de contabilidade**:
             * SEMPRE busque a seção "Pagador" ou "Sacado" no documento
             * Use APENAS o nome da pessoa/empresa que está PAGANDO pelos serviços
             * IGNORE dados da contabilidade/beneficiário/sacador (ex: "AM CONTABILIDADE")
             * REMOVA qualquer CPF/CNPJ do nome (ex: "41.894.000 ADITUS COMERCIO" -> "ADITUS COMERCIO ELETRONICO DE CALCADOS L")
             * Para boletos bancários: procure por "Pagador" no corpo do boleto
             * Exemplo: "Pagador: ADITUS COMERCIO ELETRONICO DE CALCADOS L" use "ADITUS COMERCIO ELETRONICO DE CALCADOS L"
           - **Para outros documentos**: 
             * Use a razão social completa da empresa contribuinte
             * Para folha de pagamento, use o nome do empregador
             * Para documentos fiscais, use o nome do contribuinte
        
        6. VALIDAÇÕES IMPORTANTES:
           - Se CNPJ estiver mascarado/incompleto, deixe CNPJ_CLIENTE como ""
           - Se não conseguir identificar claramente o pagador em honorários, deixe NOME_CLIENTE como ""
           - Não inclua campos adicionais além dos especificados
           - Não inclua explicações ou texto adicional, apenas o JSON
           - Se não encontrar alguma informação, retorne o campo como string vazia ("")
        
        7. EXEMPLOS PRÁTICOS DE CLASSIFICAÇÃO:

           **HONORARIOS vs DARF - COMO DISTINGUIR:**
           - HONORARIOS: Boleto bancário com beneficiário "CONTABILIDADE", pagador é cliente
           - DARF: Documento oficial com "Documento de Arrecadação de Receitas Federais"

           **Exemplo HONORARIOS:**
           Se vir: "AM CONTABILIDADE LTDA" como beneficiário + "Boleto Pix" + código de barras + "Pagador: EMPRESA X"
           → SEMPRE retorne "HONORARIOS"
           
           **Exemplo DARF:**
           Se vir: "Documento de Arrecadação de Receitas Federais" + código da receita
           → Retorne "DARF"
        
        8. EXEMPLOS DE CNPJs INVÁLIDOS (retornar ""):
           - "56.***.*853.***-**" (mascarado)
           - "00.259329450-36" (número de documento DAE, não CNPJ - tem 13 dígitos)
           - "00.273497564-88" (número de documento DAE, não CNPJ - tem 13 dígitos)
           - "123456789" (incompleto)
           - Qualquer número que não seja um CNPJ completo de 14 dígitos

        9. EXEMPLOS PRÁTICOS - DAE (Documento de Arrecadação Estadual):

           **Exemplo 1 - DAE com CNPJ formatado:**
           - Cabeçalho: "CNPJ: 41.***.000/****-**" ← IGNORAR (mascarado)
           - Número Documento: "00.273497564-88" ← IGNORAR (não é CNPJ, tem 13 dígitos)
           - Meio do documento: "41.894.000/0001-60" ← USAR ESTE (CNPJ completo e visível)
           Resposta: { "CNPJ_CLIENTE": "41.894.000/0001-60" }

           **Exemplo 2 - DAE com CNPJ SEM formatação:**
           - Cabeçalho: "CNPJ: 51.***.654/****-**" ← IGNORAR (mascarado)
           - Número Documento: "00.273374558-87" ← IGNORAR (não é CNPJ, tem 13 dígitos)
           - Rodapé: "51587654000102" ← USAR ESTE (14 dígitos, é o CNPJ!)
           Resposta: { "CNPJ_CLIENTE": "51.587.654/0001-02" } (formatado)

           **Exemplo 3 - DAE com CNPJ SEM formatação:**
           - Cabeçalho: "CNPJ: 54.***.129/****-**" ← IGNORAR (mascarado)
           - Número Documento: "00.273427645-07" ← IGNORAR (não é CNPJ, tem 13 dígitos)
           - Rodapé: "54539129000100" ← USAR ESTE (14 dígitos, é o CNPJ!)
           Resposta: { "CNPJ_CLIENTE": "54.539.129/0001-00" } (formatado)

           **Exemplo 4 - DAE com CNPJ SEM formatação (AZA CALCADOS):**
           - Cabeçalho: "CNPJ: 57.***.495/****-**" ← IGNORAR (mascarado)
           - Número Documento: "00.273428943-89" ← IGNORAR (não é CNPJ, tem 13 dígitos)
           - Rodapé: "57611495000102" ← USAR ESTE (14 dígitos, é o CNPJ!)
           Resposta: { "CNPJ_CLIENTE": "57.611.495/0001-02" } (formatado)
      `;

      const response = await axios.post(`${endpoint}?key=${apiKey}`, {
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfData
              }
            }
          ]
        }]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Processar resposta da IA
      console.log('✅ Processando resposta da IA');
      const geminiResponse = response.data.candidates[0].content.parts[0].text;
      console.log('📝 Resposta da Gemini:', geminiResponse);
      
      // Extrair JSON da resposta
      const start = geminiResponse.indexOf('{');
      const end = geminiResponse.lastIndexOf('}') + 1;
      const extractedData = JSON.parse(geminiResponse.slice(start, end));

      console.log('🎯 Dados extraídos pela IA:', extractedData);

      // Ajustar data para próximo dia útil se cair em fim de semana ou feriado
      if (extractedData.DATA_ARQ) {
        const dataOriginal = extractedData.DATA_ARQ;
        extractedData.DATA_ARQ = ajustarDataParaDiaUtil(dataOriginal);

        if (dataOriginal !== extractedData.DATA_ARQ) {
          console.log(`✅ Data ajustada para dia útil: ${dataOriginal} → ${extractedData.DATA_ARQ}`);
        }
      }
      
      // Validar e corrigir CNPJ
      if (extractedData.CNPJ_CLIENTE) {
        const cnpjNumbers = extractedData.CNPJ_CLIENTE.replace(/\D/g, '');

        // CNPJ deve ter exatamente 14 dígitos
        if (cnpjNumbers.length !== 14) {
          // Verificar se é FGTS e se temos um CNPJ parcial (8 dígitos)
          if (extractedData.NOME_PDF === 'FGTS' && cnpjNumbers.length === 8) {
            // Para FGTS, manter o CNPJ parcial como está (não completar)
            // Apenas garantir que está no formato correto XX.XXX.XXX
            if (extractedData.CNPJ_CLIENTE.includes('.')) {
              // Já está formatado, manter como está
              console.log(`✅ FGTS - CNPJ parcial formatado mantido: ${extractedData.CNPJ_CLIENTE}`);
            } else {
              // Formatar como XX.XXX.XXX
              extractedData.CNPJ_CLIENTE = cnpjNumbers.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3');
              console.log(`✅ FGTS - CNPJ parcial formatado: ${cnpjNumbers} -> ${extractedData.CNPJ_CLIENTE}`);
            }
          } else {
            console.log(`⚠️ CNPJ inválido detectado: ${extractedData.CNPJ_CLIENTE} (${cnpjNumbers.length} dígitos) - removendo`);
            extractedData.CNPJ_CLIENTE = '';
          }
        } else {
          // Formatar CNPJ corretamente se válido
          extractedData.CNPJ_CLIENTE = cnpjNumbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
          console.log(`✅ CNPJ válido formatado: ${extractedData.CNPJ_CLIENTE}`);
        }
      }
      
      // Verificar se todos os campos necessários foram extraídos
      const hasMainData = extractedData.NOME_CLIENTE && 
                         extractedData.DATA_ARQ && 
                         extractedData.VALOR_PFD && 
                         extractedData.NOME_PDF;
      
      // REGRA CRÍTICA: CNPJ É OBRIGATÓRIO, EXCETO PARA HONORARIOS
      const isHonorarios = extractedData.NOME_PDF === 'HONORARIOS';
      const hasCNPJ = extractedData.CNPJ_CLIENTE && extractedData.CNPJ_CLIENTE.trim() !== '';

      // SUCESSO APENAS SE:
      // 1. Tem todos os dados principais E
      // 2. Tem CNPJ OU é HONORARIOS (que pode ter CPF)
      const isSuccess = hasMainData && (hasCNPJ || isHonorarios);
      
      // Precisa de input manual se não atender os critérios de sucesso
      const needsManualInput = !isSuccess;
      
      console.log('🔍 VALIDAÇÃO CRÍTICA:');
      console.log('  - hasMainData:', hasMainData);
      console.log('  - hasCNPJ:', hasCNPJ);
      console.log('  - isHonorarios:', isHonorarios);
      console.log('  - isSuccess:', isSuccess);
      console.log('  - needsManualInput:', needsManualInput);
      
      // Calcular CNPJ_CURTO
      let cnpjCurto = null;
      if (extractedData.CNPJ_CLIENTE) {
        const cnpjNumbers = extractedData.CNPJ_CLIENTE.split('').filter(char => '0123456789'.includes(char)).join('');

        // Para FGTS com CNPJ parcial (8 dígitos), usar os primeiros 6 dígitos
        // Para CNPJs completos (14 dígitos), usar os primeiros 6 dígitos
        if (cnpjNumbers.length >= 6) {
          cnpjCurto = cnpjNumbers.substring(0, 6);
          console.log(`✅ CNPJ_CURTO calculado: ${cnpjCurto} (de ${cnpjNumbers})`);
        }
      }
      
      console.log('🔍 PDFPROCESSOR - CNPJ_CLIENTE extraído:', extractedData.CNPJ_CLIENTE);
      console.log('🔍 PDFPROCESSOR - CNPJ_CURTO calculado:', cnpjCurto, 'tipo:', typeof cnpjCurto);

      // VALIDAÇÃO EXTRA PARA DAE: Se o CNPJ extraído não for válido, tentar encontrar todas as sequências de 14 dígitos no PDF
      if (extractedData.NOME_PDF === 'DAE' && (!hasCNPJ || !cnpjCurto)) {
        console.log('🔍 DAE - CNPJ não encontrado pela IA, tentando validação manual de todas as sequências de 14 dígitos...');
        try {
          // Converter PDF base64 para texto usando atob (compatível com browser)
          const binaryString = atob(pdfData);
          const pdfText = binaryString;

          // Procurar por todas as sequências de exatamente 14 dígitos consecutivos
          const regex = /\b(\d{14})\b/g;
          const matches = [...pdfText.matchAll(regex)];

          console.log(`🔍 DAE - Encontradas ${matches.length} sequências de 14 dígitos no PDF`);

          // Tentar validar cada sequência encontrada
          for (const match of matches) {
            const possibleCNPJ = match[1];

            // Ignorar sequências que começam com "00" (são números de documento)
            if (possibleCNPJ.startsWith('00')) {
              console.log(`⚠️ DAE - Ignorando sequência ${possibleCNPJ} (começa com 00)`);
              continue;
            }

            const testCnpjCurto = possibleCNPJ.substring(0, 6);
            console.log(`🔍 DAE - Testando CNPJ: ${possibleCNPJ} (CNPJ_CURTO: ${testCnpjCurto})`);

            try {
              const { exists, cliente } = await clientesAPI.validateCNPJCurto(testCnpjCurto);

              if (exists) {
                // Encontramos um CNPJ válido!
                const formattedCNPJ = possibleCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                console.log(`✅ DAE - CNPJ válido encontrado e confirmado no banco: ${formattedCNPJ} (Cliente: ${cliente?.NOME_RAZAO_SOCIAL})`);

                extractedData.CNPJ_CLIENTE = formattedCNPJ;
                cnpjCurto = testCnpjCurto;
                break; // Encontramos o CNPJ correto, podemos parar
              }
            } catch (validationError) {
              console.log(`⚠️ DAE - CNPJ ${possibleCNPJ} não encontrado na base de clientes`);
            }
          }

          if (!extractedData.CNPJ_CLIENTE) {
            console.log('❌ DAE - Nenhuma sequência de 14 dígitos foi validada com sucesso na base de clientes');
          }
        } catch (error) {
          console.error('❌ Erro na validação manual de CNPJs para DAE:', error);
        }
      }

      // Recalcular hasCNPJ após a validação extra do DAE
      const hasCNPJUpdated = extractedData.CNPJ_CLIENTE && extractedData.CNPJ_CLIENTE.trim() !== '';

      // VALIDAÇÃO CRÍTICA: Verificar se CNPJ_CURTO existe na tabela Clientes
      let cnpjValidationError = null;
      if (cnpjCurto && hasCNPJUpdated) {
        try {
          console.log('🔍 Validando CNPJ_CURTO na tabela Clientes:', cnpjCurto);
          const { exists, cliente, error } = await clientesAPI.validateCNPJCurto(cnpjCurto);

          if (error && !error.message?.includes('No rows found')) {
            console.error('⚠️ Erro ao validar CNPJ_CURTO:', error);
            cnpjValidationError = 'Cliente com esse CNPJ não está cadastrado no sistema';
          } else if (!exists) {
            console.log('❌ CNPJ_CURTO não encontrado na tabela Clientes:', cnpjCurto);
            cnpjValidationError = `CNPJ curto ${cnpjCurto} não encontrado na base de clientes. Verifique se o CNPJ foi extraído corretamente.`;
          } else {
            console.log('✅ CNPJ_CURTO validado com sucesso:', { cnpjCurto, cliente: cliente?.NOME_RAZAO_SOCIAL });
          }
        } catch (error) {
          console.error('❌ Falha na validação do CNPJ_CURTO:', error);
          cnpjValidationError = 'Erro interno na validação do cliente';
        }
      }
      
      // Recalcular isSuccess e needsManualInput após a validação extra do DAE
      const isSuccessUpdated = hasMainData && (hasCNPJUpdated || isHonorarios);
      const needsManualInputUpdated = !isSuccessUpdated;

      // Preparar dados para salvar
      const result = {
        success: isSuccessUpdated && !cnpjValidationError,
        needsManualInput: needsManualInputUpdated || !!cnpjValidationError,
        data: {
          ...extractedData,
          HASH: SHA256(pdfData).toString(),
          CNPJ_CURTO: cnpjCurto
        },
        missingFields: {
          NOME_CLIENTE: !extractedData.NOME_CLIENTE,
          DATA_ARQ: !extractedData.DATA_ARQ,
          VALOR_PFD: !extractedData.VALOR_PFD,
          CNPJ_CLIENTE: !extractedData.CNPJ_CLIENTE,
          NOME_PDF: !extractedData.NOME_PDF
        },
        cnpjValidationError: cnpjValidationError
      };

      console.log('✨ Resultado final:', result);
      return result;

    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error.message);

      // Se for erro 403 (Forbidden) ou 404 (Not Found) - modelo não existe ou chave inválida/bloqueada
      if (error.response?.status === 403 || error.response?.status === 404) {
        const errorMsg = error.response?.status === 404 ? 'modelo não encontrado' : 'acesso negado (Forbidden)';
        console.log(`⚠️ Modelo ${MODELS[currentModelIndex].label} com API Key ${currentKeyIndex + 1} retornou erro ${error.response?.status} (${errorMsg})`);

        // Primeiro, tentar outro modelo com a mesma chave
        if (currentModelIndex < MODELS.length - 1) {
          currentModelIndex++;
          console.log(`🔄 Tentando modelo alternativo ${MODELS[currentModelIndex].label}...`);
          continue; // Tenta novamente com o próximo modelo
        }

        // Se esgotou os modelos, resetar e tentar próxima chave
        if (currentKeyIndex < API_KEYS.length - 1) {
          currentModelIndex = 0; // Resetar para o primeiro modelo
          currentKeyIndex++;
          console.log(`🔄 Tentando chave de backup ${currentKeyIndex + 1}/${API_KEYS.length} com modelo ${MODELS[currentModelIndex].label}...`);
          continue; // Tenta novamente com a próxima chave
        } else {
          console.error(`❌ Todas as combinações de modelos e chaves API falharam com erro ${error.response?.status}`);
          return {
            success: false,
            needsManualInput: true,
            data: {
              HASH: SHA256(pdfData).toString(),
              DATA_ARQ: '',
              VALOR_PFD: '',
              CNPJ_CLIENTE: '',
              NOME_CLIENTE: '',
              NOME_PDF: '',
              CNPJ_CURTO: '',
              STATUS: 'N'
            },
            error: 'Todas as chaves e modelos da API Gemini estão bloqueados, inválidos ou não encontrados. Verifique as configurações no Google Cloud Console.',
            missingFields: {
              NOME_CLIENTE: true,
              DATA_ARQ: true,
              VALOR_PFD: true,
              CNPJ_CLIENTE: true,
              NOME_PDF: true
            }
          };
        }
      }

      // Se for erro 429 (rate limit) ou 503 (service unavailable) e não for a última tentativa
      if ((error.response?.status === 429 || error.response?.status === 503) && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // Backoff exponencial
        const errorType = error.response?.status === 429 ? 'Rate limit' : 'Serviço indisponível';
        console.log(`⏳ ${errorType} (${error.response?.status}). Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Se for a última tentativa ou outro tipo de erro, retornar erro
      console.error('❌ Todas as tentativas falharam. Erro no processamento via IA:', error);
      return {
        success: false,
        needsManualInput: true,
        data: {
          HASH: SHA256(pdfData).toString(),
          DATA_ARQ: '',
          VALOR_PFD: '',
          CNPJ_CLIENTE: '',
          NOME_CLIENTE: '',
          NOME_PDF: '',
          CNPJ_CURTO: '',
          STATUS: 'N'
        },
        error: error.message,
        missingFields: {
          NOME_CLIENTE: true,
          DATA_ARQ: true,
          VALOR_PFD: true,
          CNPJ_CLIENTE: true,
          NOME_PDF: true
        }
      };
    }
  }
}; 
