-- ================================================
-- TABELA DE LOGS DE CORREÇÕES MANUAIS DA IA
-- ================================================
-- Esta tabela armazena informações sobre documentos que precisaram
-- de correção manual após a extração automática de dados pela IA.
-- 
-- OBJETIVO: 
-- - Identificar padrões de erro na extração da IA
-- - Melhorar o sistema com base nos dados de correção
-- - Analisar quais campos mais precisam de correção manual
--
-- QUANDO É USADO:
-- - Apenas quando o usuário corrige manualmente dados extraídos pela IA
-- - NÃO inclui erros técnicos, documentos duplicados ou outras falhas
-- ================================================

-- Criar a tabela principal
CREATE TABLE ai_extraction_correction_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ===============================================
  -- IDENTIFICAÇÃO DO DOCUMENTO E USUÁRIO
  -- ===============================================
  user_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_url TEXT,
  
  -- ===============================================
  -- DADOS DE EXTRAÇÃO (ANTES E DEPOIS DA CORREÇÃO)
  -- ===============================================
  -- O que a IA extraiu originalmente (pode ter campos vazios ou incorretos)
  ai_extracted_data JSONB NOT NULL,
  
  -- O que o usuário corrigiu manualmente (dados finais corretos)
  manually_corrected_data JSONB NOT NULL,
  
  -- ===============================================
  -- ANÁLISE DOS CAMPOS CORRIGIDOS
  -- ===============================================
  -- Array com nomes dos campos que precisaram correção
  -- Exemplo: ['data_documento', 'valor_total', 'numero_documento']
  fields_corrected TEXT[] NOT NULL,
  
  -- Motivo/contexto da correção
  -- Exemplo: "Data inválida extraída", "Valor não identificado", "Campo vazio"
  correction_reason TEXT,
  
  -- ===============================================
  -- MÉTRICAS E CONTEXTO
  -- ===============================================
  -- Tempo que o usuário levou para fazer a correção (em segundos)
  correction_time_seconds INTEGER,
  
  -- ID da sessão de processamento (para agrupar documentos do mesmo lote)
  processing_session_id TEXT,
  
  -- Tipo de documento para análises mais específicas
  document_type TEXT
);

-- ===============================================
-- ÍNDICES PARA OTIMIZAÇÃO DE CONSULTAS
-- ===============================================

-- Consultas por usuário
CREATE INDEX idx_ai_correction_logs_user_id 
ON ai_extraction_correction_logs(user_id);

-- Consultas por data (relatórios mensais, etc)
CREATE INDEX idx_ai_correction_logs_created_at 
ON ai_extraction_correction_logs(created_at);

-- Consultas por campos corrigidos (análise de padrões)
CREATE INDEX idx_ai_correction_logs_fields_corrected 
ON ai_extraction_correction_logs USING GIN(fields_corrected);

-- Consultas por sessão de processamento
CREATE INDEX idx_ai_correction_logs_session_id 
ON ai_extraction_correction_logs(processing_session_id);

-- Consultas por tipo de documento
CREATE INDEX idx_ai_correction_logs_document_type 
ON ai_extraction_correction_logs(document_type);

-- ===============================================
-- COMENTÁRIOS NA TABELA E COLUNAS
-- ===============================================
COMMENT ON TABLE ai_extraction_correction_logs IS 
'Log de correções manuais realizadas em dados extraídos automaticamente pela IA. Usado para análise e melhoria do sistema de extração.';

COMMENT ON COLUMN ai_extraction_correction_logs.ai_extracted_data IS 
'Dados originais extraídos pela IA (pode conter erros ou campos vazios)';

COMMENT ON COLUMN ai_extraction_correction_logs.manually_corrected_data IS 
'Dados finais após correção manual do usuário';

COMMENT ON COLUMN ai_extraction_correction_logs.fields_corrected IS 
'Array com nomes dos campos que precisaram ser corrigidos manualmente';

COMMENT ON COLUMN ai_extraction_correction_logs.correction_reason IS 
'Motivo ou contexto da correção (ex: "Data inválida", "Campo vazio")';

-- ===============================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ===============================================
-- Habilitar Row Level Security
ALTER TABLE ai_extraction_correction_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuários só podem ver seus próprios logs
CREATE POLICY "Users can view own correction logs" ON ai_extraction_correction_logs
  FOR SELECT USING (auth.uid()::text = user_id);

-- Política: usuários só podem inserir logs com seu próprio user_id
CREATE POLICY "Users can insert own correction logs" ON ai_extraction_correction_logs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- ===============================================
-- EXEMPLO DE CONSULTAS ÚTEIS PARA ANÁLISE
-- ===============================================

/*
-- Campos que mais precisam de correção
SELECT 
  unnest(fields_corrected) as campo,
  COUNT(*) as total_correcoes
FROM ai_extraction_correction_logs 
GROUP BY campo 
ORDER BY total_correcoes DESC;

-- Usuários com mais correções (podem precisar de treinamento)
SELECT 
  user_id,
  COUNT(*) as total_correcoes,
  AVG(correction_time_seconds) as tempo_medio_correcao
FROM ai_extraction_correction_logs 
GROUP BY user_id 
ORDER BY total_correcoes DESC;

-- Evolução mensal das correções (para ver se IA está melhorando)
SELECT 
  DATE_TRUNC('month', created_at) as mes,
  COUNT(*) as total_correcoes
FROM ai_extraction_correction_logs 
GROUP BY mes 
ORDER BY mes;

-- Tipos de erro mais comuns
SELECT 
  correction_reason,
  COUNT(*) as frequencia
FROM ai_extraction_correction_logs 
WHERE correction_reason IS NOT NULL
GROUP BY correction_reason 
ORDER BY frequencia DESC;
*/