import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase
const supabaseUrl = 'https://osnjsgleardkzrnddlgt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbmpzZ2xlYXJka3pybmRkbGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMTk3MTAsImV4cCI6MjA0Mzg5NTcxMH0.vsSkmzA6PGG09Kxsj1HAuHFhz-JxwimrtPCPV3E_aLg';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbmpzZ2xlYXJka3pybmRkbGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMxOTcxMCwiZXhwIjoyMDQzODk1NzEwfQ.rkabGlHPV4E9aefwyq9LYeXX-QxgfcleCQoqrZ-mgbM';

// Cliente público
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente com privilégios elevados (para Storage e RPC)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Funções de autenticação
export const auth = {
  // Login com email e senha
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Logout
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Obter usuário atual
  getCurrentUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { user: data?.user, error };
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