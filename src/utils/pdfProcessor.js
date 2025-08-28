import { SHA256 } from 'crypto-js';
import axios from 'axios';
import { supabase, clientesAPI } from './supabaseClient';

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
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 2000; // 2 segundos
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${MAX_RETRIES} - Processamento do PDF via Gemini AI`);
      
      // Enviar PDF diretamente para Gemini API
      console.log('🤖 Enviando PDF para Gemini 2.0 Flash...');
      const apiKey = 'AIzaSyBNfyi-FvcFee3wbDB7OOkWqxVnMFd5Npg';
      const endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
      
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
          "NOME_PDF": string (DARF, FGTS, DAE, PGDAS, ESOCIAL, HONORARIOS, ALVARA, FOLHA DE PAG, FOLHA DE ADIANTAMENTO, GPS, PARCELAMENTO_ICMS, PARCELAMENTO_INCS, PARCELAMENTO ou outros tipos específicos de parcelamento),
          "STATUS": "N"
        }
        
        Instruções específicas:
        1. Para VALOR_PFD: 
           - Converta valores com vírgula para ponto (ex: "1.234,56" -> "1234.56")
           - Para folha de pagamento, use o valor líquido
           - Para outros documentos, use o valor total/a pagar
        
        2. Para CNPJ_CLIENTE - ATENÇÃO ESPECIAL:
           - APENAS use CNPJs COMPLETOS e VISÍVEIS (14 dígitos)
           - Se o CNPJ estiver mascarado/oculto (ex: "56.***.*853.***-**" ou com asteriscos), retorne ""
           - Se aparecer apenas um número de documento que NÃO seja CNPJ, retorne ""
           - NUNCA use número de documento, código de identificação ou outros números como CNPJ
           - Mantenha a formatação XX.XXX.XXX/XXXX-XX apenas para CNPJs válidos e completos
           - **Para HONORARIOS**: Se houver CNPJ válido no documento (ex: "CNPJ/CPF: 27.894.767/0001-68"), use-o
           - **Para HONORARIOS**: Se só houver CPF, deixe CNPJ_CLIENTE como ""
           - **Para FGTS - FALLBACK ESPECIAL**: Se não conseguir o CNPJ completo, procure por CNPJ parcial (8 dígitos) no campo "CPF/CNPJ do Empregador" (ex: "41.894.000"). Se encontrar, formate como "XX.XXX.XXX/0001-00" (completando com /0001-00)
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
           - "00.259329450-36" (número de documento, não CNPJ)
           - "123456789" (incompleto)
           - Qualquer número que não seja um CNPJ completo de 14 dígitos
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
      
      // Validar e corrigir CNPJ
      if (extractedData.CNPJ_CLIENTE) {
        const cnpjNumbers = extractedData.CNPJ_CLIENTE.replace(/\D/g, '');
        
        // CNPJ deve ter exatamente 14 dígitos
        if (cnpjNumbers.length !== 14) {
          // Verificar se é FGTS e se temos um CNPJ parcial (8 dígitos)
          if (extractedData.NOME_PDF === 'FGTS' && cnpjNumbers.length === 8) {
            // Completar CNPJ parcial do FGTS com /0001-00
            const cnpjCompleto = cnpjNumbers + '000100';
            extractedData.CNPJ_CLIENTE = cnpjCompleto.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            console.log(`✅ FGTS - CNPJ parcial completado: ${cnpjNumbers} -> ${extractedData.CNPJ_CLIENTE}`);
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
      const cnpjCurto = extractedData.CNPJ_CLIENTE ? 
        extractedData.CNPJ_CLIENTE.split('').filter(char => '0123456789'.includes(char)).join('').substring(0, 6) : 
        null;
      
      console.log('🔍 PDFPROCESSOR - CNPJ_CLIENTE extraído:', extractedData.CNPJ_CLIENTE);
      console.log('🔍 PDFPROCESSOR - CNPJ_CURTO calculado:', cnpjCurto, 'tipo:', typeof cnpjCurto);
      
      // VALIDAÇÃO CRÍTICA: Verificar se CNPJ_CURTO existe na tabela Clientes
      let cnpjValidationError = null;
      if (cnpjCurto && hasCNPJ) {
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
      
      // Preparar dados para salvar
      const result = {
        success: isSuccess && !cnpjValidationError,
        needsManualInput: needsManualInput || !!cnpjValidationError,
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
