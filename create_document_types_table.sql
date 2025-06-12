-- Criação da tabela DocumentTypes para armazenar tipos de documentos personalizados
CREATE TABLE IF NOT EXISTS "DocumentTypes" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "keywords" TEXT NOT NULL,
  "sample_text" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para pesquisa por nome
CREATE INDEX IF NOT EXISTS idx_document_types_name ON "DocumentTypes"("name");

-- Comentários da tabela
COMMENT ON TABLE "DocumentTypes" IS 'Armazena tipos de documentos personalizados adicionados pelos usuários';
COMMENT ON COLUMN "DocumentTypes"."name" IS 'Nome do tipo de documento (ex: IPTU, INSS)';
COMMENT ON COLUMN "DocumentTypes"."keywords" IS 'Palavras-chave separadas por vírgula para identificação do documento';
COMMENT ON COLUMN "DocumentTypes"."sample_text" IS 'Exemplo de texto de um documento deste tipo para referência'; 