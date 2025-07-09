// Gerenciador de arquivos para EnvioDocsAPI
import { processPDF } from './pdfProcessor';
import { documentosAPI, storageAPI, clientesAPI } from './supabaseClient';

// Função para validar se a data não é menor que a data atual
const validateDocumentDate = (dateStr) => {
  try {
    // Converte a data do documento (DD/MM/YYYY) para objeto Date
    const [day, month, year] = dateStr.split('/').map(Number);
    const documentDate = new Date(year, month - 1, day); // mês é 0-based em JS
    
    // Remove o horário da data atual para comparar apenas as datas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Formata as datas para exibição
    const formatDate = (date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };
    
    // Retorna true se a data do documento é maior ou igual à data atual
    return {
      isValid: documentDate >= today,
      documentDate,
      today,
      formattedDocDate: formatDate(documentDate),
      formattedToday: formatDate(today)
    };
  } catch (error) {
    console.error('❌ Erro ao validar data:', error);
    return {
      isValid: false,
      error: 'Data inválida'
    };
  }
};

// Processa um único arquivo PDF
export const processFile = async (fileData) => {
  try {
    const { path, name, data } = fileData;
    
    // Processa o PDF e extrai dados (passando o nome do arquivo)
    const result = await processPDF(data, name);
    
    // LOG CRÍTICO: Ver o que o processPDF está retornando
    console.log('🚨 FILEMANAGER - Resultado do processPDF:', result);
    console.log('🚨 FILEMANAGER - result.data:', result?.data);
    console.log('🚨 FILEMANAGER - result.success:', result?.success);
    console.log('🚨 FILEMANAGER - result.needsManualInput:', result?.needsManualInput);
    
    // Log de depuração: mostrar texto extraído (apenas para debug)
    if (result && result.rawText !== undefined) {
      console.log('Texto extraído do PDF:', result.rawText);
    }
    
    // NOVA VALIDAÇÃO: Verificar data do documento
    if (result.data?.DATA_ARQ) {
      const dateValidation = validateDocumentDate(result.data.DATA_ARQ);
      if (!dateValidation.isValid) {
        console.log('⚠️ FILEMANAGER - Data do documento inválida:', {
          documentDate: dateValidation.documentDate,
          today: dateValidation.today
        });
        
        return {
          success: false,
          fileName: name,
          filePath: path,
          error: `⚠️ Data do documento (${dateValidation.formattedDocDate}) é anterior à data atual (${dateValidation.formattedToday}). Por favor, verifique e corrija a data.`,
          needsManualInput: true,
          data: result.data
        };
      }
    }
    
    // CORREÇÃO: Verificar se é falha completa ou apenas precisa de input manual
    if (!result.success && !result.needsManualInput) {
      // Falha completa de processamento
      return {
        success: false,
        fileName: name,
        filePath: path,
        error: 'Não foi possível extrair informações do PDF. Tente outro arquivo ou preencha manualmente.',
        needsManualInput: true,
        data: null
      };
    }
    
    // VERIFICAÇÃO ROBUSTA DE DUPLICATAS (processamento automático)
    console.log('🚨 PROCESSFILE - Verificando duplicatas no processamento automático...');
    
    // 1. Verificação por HASH (principal)
    try {
      const { exists, error: hashError } = await documentosAPI.checkDocumentoByHash(result.data.HASH);
      
      if (hashError) {
        console.error('⚠️ PROCESSFILE - Erro ao verificar HASH:', hashError);
      } else if (exists) {
        console.log('📋 PROCESSFILE - DUPLICATA DETECTADA por HASH no processamento automático!');
        return {
          success: false,
          fileName: name,
          filePath: path,
          error: '🔍 Este documento já foi enviado anteriormente (detectado por assinatura digital).',
          needsManualInput: false,
          data: result.data
        };
      }
    } catch (error) {
      console.error('⚠️ PROCESSFILE - Falha na verificação por HASH:', error);
    }
    
    // 2. Verificação por critérios combinados (fallback)
    try {
      const { data: existingDocs, error: searchError } = await documentosAPI.findSimilarDocuments({
        NOME_CLIENTE: result.data.NOME_CLIENTE,
        DATA_ARQ: result.data.DATA_ARQ,
        VALOR_PFD: result.data.VALOR_PFD,
        NOME_PDF: result.data.NOME_PDF
      });
      
      if (searchError) {
        console.error('⚠️ PROCESSFILE - Erro ao buscar documentos similares:', searchError);
      } else if (existingDocs && existingDocs.length > 0) {
        console.log('📋 PROCESSFILE - DUPLICATA DETECTADA por dados similares no processamento automático!');
        return {
          success: false,
          fileName: name,
          filePath: path,
          error: '🔍 Documento similar já existe: mesmo cliente, data, valor e tipo de documento.',
          needsManualInput: false,
          data: result.data
        };
      }
    } catch (error) {
      console.error('⚠️ PROCESSFILE - Falha na verificação por similaridade:', error);
    }
    
    console.log('✅ PROCESSFILE - Nenhuma duplicata detectada, prosseguindo com processamento automático...');
    
    // Se todos os dados foram extraídos com sucesso e não precisamos de input manual
    if (!result.needsManualInput) {
      try {
        // Faz upload do arquivo para o Storage
        // Resolvendo problema de Buffer não definido no ambiente browser
        let pdfBuffer;
        if (typeof Buffer !== 'undefined') {
          // Se estamos em Node.js
          pdfBuffer = Buffer.from(data, 'base64');
        } else {
          // Se estamos no browser, usar Uint8Array
          const binaryString = atob(data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfBuffer = bytes;
        }
        
        const { url, error: uploadError } = await storageAPI.uploadPDF(
          pdfBuffer,
          `${result.data.CNPJ_CURTO}/${Date.now()}_${name}`
        );
        
        if (uploadError) {
          console.error('Erro ao fazer upload do PDF:', uploadError);
          return {
            success: false,
            fileName: name,
            filePath: path,
            // Mensagem simplificada para o usuário
            error: 'Erro ao enviar o PDF para o servidor. Tente novamente.',
            needsManualInput: true,
            data: result.data
          };
        }
        
        // Adiciona URL ao objeto de dados
        result.data.URL_PDF = url;
        
        // Salva no banco de dados
        const { documento, error: dbError } = await documentosAPI.addDocumento(result.data);
        
        if (dbError) {
          console.error('Erro ao salvar documento no banco:', dbError);
          return {
            success: false,
            fileName: name,
            filePath: path,
            // Mensagem simplificada para o usuário
            error: 'Erro ao salvar os dados no banco. Tente novamente.',
            needsManualInput: true,
            data: result.data
          };
        }
        
        return {
          success: true,
          fileName: name,
          filePath: path,
          error: null,
          needsManualInput: false,
          data: documento || result.data
        };
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        return {
          success: false,
          fileName: fileData.name,
          filePath: fileData.path,
          error: error.message,
          needsManualInput: true,
          data: null
        };
      }
    }
    
    // Se precisar de input manual, retorna os dados para serem completados pelo usuário
    console.log("🚨 FILEMANAGER - Preparando dados para input manual");
    console.log("🚨 FILEMANAGER - fileName:", fileData.name);
    console.log("🚨 FILEMANAGER - dataExtraido:", result.data);
    console.log("🚨 FILEMANAGER - missingFields:", result.missingFields);
    
    // GARANTIR que os dados não sejam perdidos
    const dadosParaRetornar = result.data || {};
    console.log('🚨 FILEMANAGER - Dados que serão retornados:', dadosParaRetornar);
    
    const retorno = {
      success: false,
      fileName: fileData.name,
      filePath: fileData.path,
      error: 'Informações incompletas. Por favor, preencha manualmente.',
      needsManualInput: true,
      data: dadosParaRetornar,
      missingFields: result.missingFields || {}
    };
    
    console.log('🚨 FILEMANAGER - Objeto de retorno completo:', retorno);
    return retorno;
    
  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    return {
      success: false,
      fileName: fileData.name,
      filePath: fileData.path,
      error: error.message,
      needsManualInput: true,
      data: null
    };
  }
};

// Salva dados preenchidos manualmente
export const saveManualData = async (fileData, manualData) => {
  try {
    console.log('🚨 SAVEMANUAL - Iniciando salvamento manual');
    console.log('📋 SAVEMANUAL - fileData recebido:', {
      name: fileData?.name,
      hasOriginalFileData: !!fileData?.originalFileData,
      hasData: !!fileData?.data
    });
    console.log('📋 SAVEMANUAL - manualData recebido:', manualData);
    
    // Log detalhado dos dados para rastreamento
    console.log('🔍 SAVEMANUAL - HASH atual nos dados:', manualData?.HASH || 'AUSENTE');
    console.log('🔍 SAVEMANUAL - Dados chave para verificação:', {
      NOME_CLIENTE: manualData?.NOME_CLIENTE,
      DATA_ARQ: manualData?.DATA_ARQ,
      VALOR_PFD: manualData?.VALOR_PFD,
      NOME_PDF: manualData?.NOME_PDF,
      CNPJ_CLIENTE: manualData?.CNPJ_CLIENTE
    });
    
    // ENCONTRAR o PDF em base64 na estrutura correta
    let pdfBase64Data = null;
    
    if (fileData.originalFileData) {
      pdfBase64Data = fileData.originalFileData;
      console.log('🚨 SAVEMANUAL - Usando originalFileData');
    } else if (fileData.data && typeof fileData.data === 'string' && fileData.data.startsWith('JVBERi0')) {
      pdfBase64Data = fileData.data;
      console.log('🚨 SAVEMANUAL - Usando data (base64 string)');
    } else {
      console.error('❌ SAVEMANUAL - PDF base64 não encontrado em fileData');
      throw new Error('PDF não encontrado nos dados do arquivo. Tente processar o arquivo novamente.');
    }
    
    console.log('🚨 SAVEMANUAL - PDF base64 encontrado, tamanho:', pdfBase64Data.length);
    
    // Faz upload do arquivo para o Storage
    let pdfBuffer;
    if (typeof Buffer !== 'undefined') {
      // Se estamos em Node.js
      pdfBuffer = Buffer.from(pdfBase64Data, 'base64');
    } else {
      // Se estamos no browser, usar Uint8Array
      const binaryString = atob(pdfBase64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBuffer = bytes;
    }
    
    console.log('🚨 SAVEMANUAL - PDF buffer criado, tamanho:', pdfBuffer.length);
    
    console.log('🚨 SAVEMANUAL - Fazendo upload para storage...');
    const { url, error: uploadError } = await storageAPI.uploadPDF(
      pdfBuffer,
      `${manualData.CNPJ_CURTO}/${Date.now()}_${fileData.name}`
    );
    
    if (uploadError) {
      console.error('❌ SAVEMANUAL - Erro no upload:', uploadError);
      return {
        success: false,
        error: `Erro ao enviar arquivo para o servidor: ${uploadError.message || uploadError}`
      };
    }
    
    console.log('✅ SAVEMANUAL - Upload concluído, URL:', url);
    
    // VERIFICAÇÃO ROBUSTA DE DUPLICATAS
    console.log('🚨 SAVEMANUAL - Iniciando verificação de duplicatas...');
    
    // 1. Garantir que temos um HASH válido
    let documentHash = manualData.HASH;
    if (!documentHash) {
      console.log('⚠️ SAVEMANUAL - HASH não encontrado nos dados manuais, calculando...');
      const { SHA256 } = await import('crypto-js');
      documentHash = SHA256(pdfBase64Data).toString();
      console.log('🔒 SAVEMANUAL - HASH calculado:', documentHash);
    } else {
      console.log('🔒 SAVEMANUAL - HASH encontrado nos dados:', documentHash);
    }
    
    // 2. Verificação por HASH (principal)
    try {
      const { exists: hashExists, error: hashError } = await documentosAPI.checkDocumentoByHash(documentHash);
      
      if (hashError) {
        console.error('⚠️ SAVEMANUAL - Erro ao verificar HASH:', hashError);
      } else if (hashExists) {
        console.log('📋 SAVEMANUAL - DUPLICATA DETECTADA por HASH!');
        return {
          success: false,
          error: '🔍 Este documento já foi enviado anteriormente (detectado por assinatura digital).'
        };
      }
    } catch (error) {
      console.error('⚠️ SAVEMANUAL - Falha na verificação por HASH:', error);
    }
    
    // 3. Verificação por critérios combinados (fallback)
    console.log('🚨 SAVEMANUAL - Verificando por critérios combinados...');
    try {
      const { data: existingDocs, error: searchError } = await documentosAPI.findSimilarDocuments({
        NOME_CLIENTE: manualData.NOME_CLIENTE,
        DATA_ARQ: manualData.DATA_ARQ,
        VALOR_PFD: manualData.VALOR_PFD,
        NOME_PDF: manualData.NOME_PDF
      });
      
      if (searchError) {
        console.error('⚠️ SAVEMANUAL - Erro ao buscar documentos similares:', searchError);
      } else if (existingDocs && existingDocs.length > 0) {
        console.log('📋 SAVEMANUAL - DUPLICATA DETECTADA por dados similares!', existingDocs);
        return {
          success: false,
          error: '🔍 Documento similar já existe: mesmo cliente, data, valor e tipo de documento.'
        };
      }
    } catch (error) {
      console.error('⚠️ SAVEMANUAL - Falha na verificação por similaridade:', error);
    }
    
    // 4. Verificação adicional por nome do arquivo
    console.log('🚨 SAVEMANUAL - Verificando por nome do arquivo...');
    try {
      const { data: fileNameDocs, error: fileNameError } = await documentosAPI.findByFileName(fileData.name);
      
      if (fileNameError) {
        console.error('⚠️ SAVEMANUAL - Erro ao buscar por nome do arquivo:', fileNameError);
      } else if (fileNameDocs && fileNameDocs.length > 0) {
        console.log('📋 SAVEMANUAL - POSSÍVEL DUPLICATA por nome do arquivo!', fileNameDocs);
        // Não bloquear automaticamente, apenas alertar
        console.log('⚠️ SAVEMANUAL - Arquivo com nome similar encontrado, mas prosseguindo...');
      }
    } catch (error) {
      console.error('⚠️ SAVEMANUAL - Falha na verificação por nome do arquivo:', error);
    }
    
    console.log('✅ SAVEMANUAL - Verificações concluídas, prosseguindo com salvamento...');
    
    // Adiciona URL e HASH ao objeto de dados
    const documentData = {
      ...manualData,
      URL_PDF: url,
      HASH: documentHash, // Garantir que o HASH seja incluído
      STATUS: 'N' // Status padrão para novos documentos
    };
    
    console.log('🚨 SAVEMANUAL - Salvando no banco de dados...', documentData);
    
    // Salva no banco de dados
    const { documento, error: dbError } = await documentosAPI.addDocumento(documentData);
    
    if (dbError) {
      console.error('❌ SAVEMANUAL - Erro no banco:', dbError);
      return {
        success: false,
        error: `Erro ao salvar no banco de dados: ${dbError.message || dbError}`
      };
    }
    
    console.log('✅ SAVEMANUAL - Documento salvo com sucesso!');
    
    return {
      success: true,
      error: null,
      data: documento || documentData
    };
    
  } catch (error) {
    console.error('❌ SAVEMANUAL - Erro geral:', error);
    
    // Melhorar mensagens de erro para o usuário
    let userFriendlyError;
    if (error.message.includes('atob')) {
      userFriendlyError = 'Erro no arquivo PDF. Por favor, tente processar o arquivo novamente.';
    } else if (error.message.includes('storage') || error.message.includes('upload')) {
      userFriendlyError = 'Erro ao enviar arquivo para o servidor. Verifique sua conexão e tente novamente.';
    } else if (error.message.includes('database') || error.message.includes('banco')) {
      userFriendlyError = 'Erro ao salvar no banco de dados. Tente novamente em alguns instantes.';
    } else if (error.message.includes('já foi enviado') || error.message.includes('duplicata')) {
      userFriendlyError = 'Este documento já foi enviado anteriormente para o sistema.';
    } else {
      userFriendlyError = error.message || 'Erro inesperado ao salvar documento. Tente novamente.';
    }
    
    return {
      success: false,
      error: userFriendlyError
    };
  }
};

// Valida se o cliente existe no sistema
export const validateClient = async (cnpj) => {
  try {
    const { cliente, error } = await clientesAPI.getClienteByCNPJ(cnpj);
    
    if (error) {
      console.error('Erro ao validar cliente:', error);
      return { valid: false, cliente: null, error };
    }
    
    return { valid: !!cliente, cliente, error: null };
  } catch (error) {
    console.error('Erro ao validar cliente:', error);
    return { valid: false, cliente: null, error };
  }
}; 