import { SHA256 } from 'crypto-js';
import axios from 'axios';
import { supabase } from './supabaseClient';

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
      const apiKey = 'AIzaSyDQ__vt66Vsz6YVBkvLW1wGIWv36FwPbvo';
      const endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
      
      const prompt = `
        Você é um especialista em extração de dados de documentos fiscais brasileiros.
        
        NOME DO ARQUIVO: ${fileName}
        
        Analise este PDF de documento fiscal e extraia as informações exatamente como aparecem.
        IMPORTANTE: Para documentos de PARCELAMENTO, use EXATAMENTE o nome do arquivo (sem .pdf) como NOME_PDF para preservar o tipo específico.
        
        Retorne APENAS um objeto JSON com estes campos:
        {
          "NOME_CLIENTE": string (nome completo da empresa/pessoa),
          "DATA_ARQ": string (data de vencimento no formato DD/MM/YYYY),
          "VALOR_PFD": string (valor total em formato numérico com ponto),
          "CNPJ_CLIENTE": string (CNPJ no formato XX.XXX.XXX/XXXX-XX),
          "NOME_PDF": string (DARF, FGTS, DAE, PGDAS, ESOCIAL, HONORARIOS, ALVARA, FOLHA DE PAG, GPS, PARCELAMENTO_ICMS, PARCELAMENTO_INCS, PARCELAMENTO ou outros tipos específicos de parcelamento),
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
           - Para folha de pagamento, use o CNPJ do empregador (se visível)
           - Para documentos fiscais, use o CNPJ do contribuinte/empresa (se visível)
        
        3. Para DATA_ARQ:
           - Use a data de vencimento no formato DD/MM/YYYY
           - Para folha de pagamento, use a data de competência
           - Para documentos fiscais, use a data de vencimento
        
        4. Para NOME_PDF, identifique o tipo baseado nestas características:
           - **PARCELAMENTO**: PRIORIDADE MÁXIMA - Se o nome do arquivo contém "PARCELAMENTO", "PARCELA", "PARCELADO" OU se o conteúdo menciona parcelamento de tributos, USE EXATAMENTE o nome do arquivo SEM a extensão .pdf (ex: se arquivo é "PARCELAMENTO_ICMS.pdf" use "PARCELAMENTO_ICMS", se é "PARCELAMENTO_INCS.pdf" use "PARCELAMENTO_INCS")
           - DARF: Documento de Arrecadação de Receitas Federais
           - FGTS: Guia de Recolhimento do FGTS ou GRF Digital
           - DAE: Documento de Arrecadação Estadual
           - PGDAS: Documento do Simples Nacional
           - ESOCIAL: Documento de Arrecadação do eSocial
           - HONORARIOS: Recibo de honorários ou RPA
           - ALVARA: Documento de Arrecadação Municipal (DAM)
           - FOLHA DE PAG: Recibo de pagamento/contracheque
           - GPS: Guia da Previdência Social
        
        5. Para NOME_CLIENTE - INSTRUÇÕES ESPECÍFICAS POR TIPO:
           - **Para HONORARIOS/RPA**: 
             * SEMPRE busque a seção "Pagador:" no documento
             * Use APENAS o nome da pessoa/empresa que está PAGANDO pelos serviços
             * IGNORE dados da contabilidade/beneficiário/sacador
             * REMOVA qualquer CPF/CNPJ do nome (ex: "27.894.767 JOÃO DA SILVA" -> "JOÃO DA SILVA")
             * Se aparecer "Pagador: 27.894.767 FRANCIELLY ALINE ELIAS GOMES" use apenas "FRANCIELLY ALINE ELIAS GOMES"
             * Exemplo: Se encontrar "Pagador: JOÃO DA SILVA" use "JOÃO DA SILVA"
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
        
        7. EXEMPLOS DE CNPJs INVÁLIDOS (retornar ""):
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
      
      // Verificar se todos os campos necessários foram extraídos
      const hasMainData = extractedData.NOME_CLIENTE && 
                         extractedData.DATA_ARQ && 
                         extractedData.VALOR_PFD && 
                         extractedData.NOME_PDF;
      
      const hasCompleteData = hasMainData && extractedData.CNPJ_CLIENTE;
      
      // Para HONORARIOS, CNPJ pode ficar vazio se for pessoa física (CPF)
      const isHonorarios = extractedData.NOME_PDF === 'HONORARIOS';
      const isHonorariosComplete = isHonorarios && hasMainData;
      
      // SUCESSO VERDADEIRO: apenas quando tiver TODOS os dados obrigatórios
      // ou for HONORARIOS completo (que pode não ter CNPJ)
      const isSuccess = hasCompleteData || isHonorariosComplete;
      
      // Precisa de input manual se não tiver todos os dados obrigatórios
      const needsManualInput = !isSuccess;
      
      // Preparar dados para salvar
      const result = {
        success: isSuccess,
        needsManualInput: needsManualInput,
        data: {
          ...extractedData,
          HASH: SHA256(pdfData).toString(),
          CNPJ_CURTO: extractedData.CNPJ_CLIENTE ? 
            extractedData.CNPJ_CLIENTE.split('').filter(char => '0123456789'.includes(char)).join('').substring(0, 6) : 
            null
        },
        missingFields: {
          NOME_CLIENTE: !extractedData.NOME_CLIENTE,
          DATA_ARQ: !extractedData.DATA_ARQ,
          VALOR_PFD: !extractedData.VALOR_PFD,
          CNPJ_CLIENTE: !extractedData.CNPJ_CLIENTE,
          NOME_PDF: !extractedData.NOME_PDF
        }
      };

      console.log('✨ Resultado final:', result);
      return result;

    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error.message);
      
      // Se for erro 429 (rate limit) e não for a última tentativa, aguardar e tentar novamente
      if (error.response?.status === 429 && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // Backoff exponencial
        console.log(`⏳ Rate limit atingido. Aguardando ${delay}ms antes da próxima tentativa...`);
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
