// Gerenciador de arquivos para EnvioDocsAPI
import { processPDF } from './pdfProcessor';
import { documentosAPI, storageAPI, clientesAPI } from './supabaseClient';

// Processa um único arquivo PDF
export const processFile = async (fileData) => {
  try {
    const { path, name, data } = fileData;
    
    // Processa o PDF e extrai dados (passando o nome do arquivo)
    const result = await processPDF(data, name);
    
    // Log de depuração: mostrar texto extraído (apenas para debug)
    if (result && result.rawText !== undefined) {
      console.log('Texto extraído do PDF:', result.rawText);
    }
    
    if (!result.success) {
      return {
        success: false,
        fileName: name,
        filePath: path,
        // Mensagem simplificada para o usuário
        error: 'Não foi possível extrair informações do PDF. Tente outro arquivo ou preencha manualmente.',
        needsManualInput: true,
        data: null
      };
    }
    
    // Verifica se o documento já existe no banco pelo HASH
    const { exists, error: hashError } = await documentosAPI.checkDocumentoByHash(result.data.HASH);
    
    if (hashError) {
      console.error('Erro ao verificar HASH no banco:', hashError);
    }
    
    if (exists) {
      return {
        success: false,
        fileName: name,
        filePath: path,
        // Mensagem simplificada para o usuário
        error: 'Este documento já foi enviado anteriormente.',
        needsManualInput: false,
        data: result.data
      };
    }
    
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
    console.log("Preparando dados para input manual:", {
      fileName: fileData.name,
      dataExtraido: result.data,
      missingFields: result.missingFields
    });
    
    // Garante que nenhum valor seja null no objeto de dados
    const dadosLimpos = {
      ...result.data,
      DATA_ARQ: result.data.DATA_ARQ || '',
      VALOR_PFD: result.data.VALOR_PFD || '',
      CNPJ_CLIENTE: result.data.CNPJ_CLIENTE || '',
      NOME_CLIENTE: result.data.NOME_CLIENTE || '',
      NOME_PDF: result.data.NOME_PDF || '',
      CNPJ_CURTO: result.data.CNPJ_CURTO || '',
    };
    
    return {
      success: false,
      fileName: fileData.name,
      filePath: fileData.path,
      // Mensagem simplificada para o usuário
      error: 'Informações incompletas. Por favor, preencha manualmente.',
      needsManualInput: true,
      data: dadosLimpos,
      missingFields: result.missingFields
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
};

// Salva dados preenchidos manualmente
export const saveManualData = async (fileData, manualData) => {
  try {
    // Faz upload do arquivo para o Storage
    // Resolvendo problema de Buffer não definido no ambiente browser
    let pdfBuffer;
    if (typeof Buffer !== 'undefined') {
      // Se estamos em Node.js
      pdfBuffer = Buffer.from(fileData.data, 'base64');
    } else {
      // Se estamos no browser, usar Uint8Array
      const binaryString = atob(fileData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBuffer = bytes;
    }
    
    const { url, error: uploadError } = await storageAPI.uploadPDF(
      pdfBuffer,
      `${manualData.CNPJ_CURTO}/${Date.now()}_${fileData.name}`
    );
    
    if (uploadError) {
      console.error('Erro ao fazer upload do PDF após input manual:', uploadError);
      return {
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`
      };
    }
    
    // Adiciona URL ao objeto de dados
    const documentData = {
      ...manualData,
      URL_PDF: url,
      STATUS: 'N' // Status padrão para novos documentos
    };
    
    // Salva no banco de dados
    const { documento, error: dbError } = await documentosAPI.addDocumento(documentData);
    
    if (dbError) {
      console.error('Erro ao salvar documento no banco após input manual:', dbError);
      return {
        success: false,
        error: `Erro ao salvar no banco: ${dbError.message}`
      };
    }
    
    return {
      success: true,
      error: null,
      data: documento || documentData
    };
    
  } catch (error) {
    console.error('Erro ao salvar dados manuais:', error);
    return {
      success: false,
      error: error.message
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