import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase
const supabaseUrl = 'https://osnjsgleardkzrnddlgt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbmpzZ2xlYXJka3pybmRkbGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMTk3MTAsImV4cCI6MjA0Mzg5NTcxMH0.vsSkmzA6PGG09Kxsj1HAuHFhz-JxwimrtPCPV3E_aLg';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbmpzZ2xlYXJka3pybmRkbGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMxOTcxMCwiZXhwIjoyMDQzODk1NzEwfQ.rkabGlHPV4E9aefwyq9LYeXX-QxgfcleCQoqrZ-mgbM';

// Cliente público com configuração de auto-refresh
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Cliente com privilégios elevados (para Storage e RPC)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Listener para mudanças no estado de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token do Supabase renovado automaticamente');
  } else if (event === 'SIGNED_OUT') {
    console.log('🚪 Usuário desconectado do Supabase');
  } else if (event === 'INITIAL_SESSION') {
    console.log('🔐 Sessão inicial carregada');
  }
});

// Função para limpar sessão em caso de erro de token
const clearInvalidSession = async () => {
  try {
    await supabase.auth.signOut({ scope: 'local' });
    localStorage.removeItem('sb-osnjsgleardkzrnddlgt-auth-token');
    sessionStorage.clear();
    console.log('🧹 Sessão inválida limpa');
  } catch (error) {
    console.error('Erro ao limpar sessão:', error);
  }
};

// Funções de autenticação
export const auth = {
  // Login com email e senha
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error && error.message.includes('refresh token')) {
        await clearInvalidSession();
        return { data: null, error: { message: 'Sessão expirada. Por favor, faça login novamente.' } };
      }
      
      return { data, error };
    } catch (error) {
      console.error('Erro no login:', error);
      return { data: null, error };
    }
  },

  // Logout
  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      await clearInvalidSession();
      return { error: null };
    }
  },

  // Obter usuário atual
  getCurrentUser: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error && error.message.includes('refresh token')) {
        await clearInvalidSession();
        return { user: null, error: { message: 'Sessão expirada' } };
      }
      
      return { user: data?.user, error };
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      await clearInvalidSession();
      return { user: null, error };
    }
  },

  // Verificar se há uma sessão válida
  hasValidSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      return false;
    }
  },
};

// Funções para manipulação da tabela Clientes
export const clientesAPI = {
  // Buscar cliente por CNPJ
  getClienteByCNPJ: async (cnpj) => {
    const { data, error } = await supabase
      .from('Clientes')
      .select('*')
      .eq('CNPJ', cnpj)
      .single();
    return { cliente: data, error };
  },

  // Buscar clientes da contabilidade
  getClientesByContabilidade: async (cnpjContabilidade) => {
    const { data, error } = await supabase
      .from('Clientes')
      .select('*')
      .eq('CNPJ_CONTABILIDADE', cnpjContabilidade);
    return { clientes: data, error };
  },

  // Validar se CNPJ curto existe na tabela Clientes
  validateCNPJCurto: async (cnpjCurto) => {
    try {
      console.log('🔍 SUPABASE - Testando busca na tabela Clientes');
      
      // Primeiro teste: buscar todos os registros para ver se a tabela está acessível
      const { data: allData, error: allError } = await supabase
        .from('Clientes')
        .select('CNPJ_curto')
        .limit(5);
      
      console.log('🔍 SUPABASE - Teste de acesso à tabela:', { allData, allError });
      
      if (allError) {
        console.error('❌ SUPABASE - Erro de acesso à tabela Clientes:', allError);
        return { 
          exists: false, 
          cliente: null, 
          error: allError 
        };
      }
      
      console.log('🔍 SUPABASE - Buscando CNPJ_curto:', cnpjCurto, 'tipo:', typeof cnpjCurto);
      
      // Garantir que é string e buscar na coluna text
      const cnpjString = String(cnpjCurto);
      
      // Buscar o CNPJ específico
      const { data, error } = await supabase
        .from('Clientes')
        .select('CNPJ_curto')
        .eq('CNPJ_curto', cnpjString);
      
      console.log('🔍 SUPABASE - Resultado da busca específica:', { data, error, cnpjString });
      
      if (error) {
        console.error('❌ SUPABASE - Erro na query específica:', error);
        return { 
          exists: false, 
          cliente: null, 
          error 
        };
      }
      
      if (data && data.length > 0) {
        console.log('✅ SUPABASE - Cliente encontrado:', data[0]);
        return { 
          exists: true, 
          cliente: data[0],
          error: null 
        };
      }
      
      console.log('❌ SUPABASE - Cliente não encontrado');
      return { 
        exists: false, 
        cliente: null, 
        error: null 
      };
      
    } catch (error) {
      console.error('❌ SUPABASE - Erro ao validar CNPJ curto:', error);
      return { 
        exists: false, 
        cliente: null, 
        error 
      };
    }
  },
};

// Funções para manipulação da tabela AmContabilidade
export const documentosAPI = {
  // Verificar se documento já existe pelo HASH
  checkDocumentoByHash: async (hash) => {
    const { data, error } = await supabase
      .from('AmContabilidade')
      .select('id')
      .eq('HASH', hash);
    return { exists: data && data.length > 0, error };
  },

  // Buscar documentos similares por critérios combinados
  findSimilarDocuments: async (criteria) => {
    const { data, error } = await supabase
      .from('AmContabilidade')
      .select('id, NOME_CLIENTE, DATA_ARQ, VALOR_PFD, NOME_PDF, HASH, created_at')
      .eq('NOME_CLIENTE', criteria.NOME_CLIENTE)
      .eq('DATA_ARQ', criteria.DATA_ARQ)
      .eq('VALOR_PFD', criteria.VALOR_PFD)
      .eq('NOME_PDF', criteria.NOME_PDF)
      .order('created_at', { ascending: false })
      .limit(5); // Limitar a 5 resultados para performance
    return { data, error };
  },

  // Buscar documentos por nome do arquivo (adicional)
  findByFileName: async (fileName) => {
    const { data, error } = await supabase
      .from('AmContabilidade')
      .select('id, NOME_CLIENTE, DATA_ARQ, VALOR_PFD, NOME_PDF, HASH')
      .like('URL_PDF', `%${fileName}%`)
      .limit(3);
    return { data, error };
  },

  // Inserir novo documento
  addDocumento: async (documentoData) => {
    const { data, error } = await supabase
      .from('AmContabilidade')
      .insert([documentoData])
      .select();
    return { documento: data?.[0], error };
  },
};

// Funções para manipulação do Storage (PDFs)
export const storageAPI = {
  // Upload de PDF
  uploadPDF: async (fileData, fileName) => {
    try {
      console.log("Iniciando upload para o Supabase:", { fileName });
      
      // Certifique-se de que os dados estão em um formato aceitável
      let fileToUpload = fileData;
      
      // Se for uma string base64, convertemos para um formato binário
      if (typeof fileData === 'string') {
        // Converte de base64 para ArrayBuffer
        const binaryString = atob(fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileToUpload = bytes;
      }
      
      const { data, error } = await supabaseAdmin
        .storage
        .from('PDFs')
        .upload(`${fileName}`, fileToUpload, {
          contentType: 'application/pdf',
          upsert: true,
        });
      
      if (error) {
        console.error('Erro no upload para o Storage:', error);
        return { url: null, error };
      }
      
      // Obtém a URL pública
      const { data: publicUrlData } = supabaseAdmin
        .storage
        .from('PDFs')
        .getPublicUrl(data.path);
      
      console.log('Upload bem-sucedido:', publicUrlData);
      return { url: publicUrlData.publicUrl, error: null };
    } catch (error) {
      console.error('Erro no processamento do upload:', error);
      return { 
        url: null, 
        error: {
          message: 'Falha ao processar o upload do arquivo: ' + (error.message || 'Erro desconhecido')
        }
      };
    }
  },
};

// Funções para manipulação dos logs de correção da IA
export const correctionLogsAPI = {
  // Salvar log de correção manual
  saveCorrectionLog: async (logData) => {
    try {
      console.log('📝 Salvando log de correção manual:', logData);
      
      const { data, error } = await supabase
        .from('ai_extraction_correction_logs')
        .insert([logData])
        .select();
        
      if (error) {
        console.error('❌ Erro ao salvar log de correção:', error);
        return { success: false, error };
      }
      
      console.log('✅ Log de correção salvo com sucesso:', data[0]);
      return { success: true, data: data[0], error: null };
    } catch (error) {
      console.error('❌ Erro no processamento do log de correção:', error);
      return { 
        success: false, 
        data: null, 
        error: {
          message: 'Falha ao salvar log de correção: ' + (error.message || 'Erro desconhecido')
        }
      };
    }
  },

  // Função auxiliar para comparar dados e identificar campos corrigidos
  identifyCorrectiedFields: (aiData, correctedData) => {
    const fieldsCorrectied = [];
    
    // Comparar cada campo
    Object.keys(correctedData).forEach(field => {
      const aiValue = aiData[field];
      const correctedValue = correctedData[field];
      
      // Verificar se o campo foi corrigido (valores diferentes ou AI tinha valor vazio/null)
      if (aiValue !== correctedValue || !aiValue || aiValue === '' || aiValue === null) {
        if (correctedValue && correctedValue !== '' && correctedValue !== null) {
          fieldsCorrectied.push(field);
        }
      }
    });
    
    return fieldsCorrectied;
  },

  // Função auxiliar para gerar ID de sessão único
  generateSessionId: () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};