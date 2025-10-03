-- Schema completo baseado no SQLite existente
-- Execute no SQL Editor do Supabase

-- PRIMEIRO: Dropar tabelas existentes (se houver)
DROP TABLE IF EXISTS carregamentos CASCADE;
DROP TABLE IF EXISTS talhao_safra CASCADE;
DROP TABLE IF EXISTS talhoes CASCADE;
DROP TABLE IF EXISTS kml_files CASCADE;
DROP TABLE IF EXISTS safras CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS config_tipo CASCADE;
DROP TABLE IF EXISTS config_variedade CASCADE;

-- Tabela de usuários
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Tabela de safras
CREATE TABLE safras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  data_inicial_colheita BIGINT
);

-- Tabela de talhões base (TODAS as colunas do SQLite)
CREATE TABLE talhoes (
  "TalhaoID" TEXT PRIMARY KEY,
  "NOME" TEXT NOT NULL,
  "AREA" REAL,
  "VARIEDADE" TEXT,
  "TIPO" TEXT,
  "ANO_PLANTIO" INTEGER,
  "ESPACAMENTO" TEXT,
  "COR" TEXT,
  geometry TEXT
);

-- Tabela de talhões por safra (TODAS as colunas do SQLite)
CREATE TABLE talhao_safra (
  id TEXT PRIMARY KEY,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  area REAL,
  variedade TEXT,
  tipo TEXT,
  ano_plantio INTEGER,
  espacamento TEXT,
  ativo BOOLEAN DEFAULT true,
  FOREIGN KEY (talhao_id) REFERENCES talhoes("TalhaoID") ON DELETE CASCADE,
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE,
  UNIQUE(talhao_id, safra_id)
);

-- Tabela de carregamentos (TODAS as colunas do SQLite)
CREATE TABLE carregamentos (
  id TEXT PRIMARY KEY,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  data BIGINT NOT NULL,
  data_colheita BIGINT NOT NULL,
  quantidade REAL NOT NULL,
  unidade TEXT DEFAULT 'kg',
  observacoes TEXT,
  FOREIGN KEY (talhao_id) REFERENCES talhoes("TalhaoID") ON DELETE CASCADE,
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE
);

-- Tabela de arquivos KML (TODAS as colunas do SQLite)
CREATE TABLE kml_files (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT,
  data_upload BIGINT NOT NULL,
  content TEXT,
  geojson TEXT
);

-- Tabela de configurações de tipo
CREATE TABLE config_tipo (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

-- Tabela de configurações de variedade
CREATE TABLE config_variedade (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

-- Criar índices para performance
CREATE INDEX idx_talhao_safra_talhao ON talhao_safra(talhao_id);
CREATE INDEX idx_talhao_safra_safra ON talhao_safra(safra_id);
CREATE INDEX idx_carregamentos_talhao ON carregamentos(talhao_id);
CREATE INDEX idx_carregamentos_safra ON carregamentos(safra_id);
CREATE INDEX idx_carregamentos_data ON carregamentos(data);
CREATE INDEX idx_carregamentos_data_colheita ON carregamentos(data_colheita);

-- Desabilitar RLS (usando JWT próprio)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE safras DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhao_safra DISABLE ROW LEVEL SECURITY;
ALTER TABLE carregamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kml_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_tipo DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_variedade DISABLE ROW LEVEL SECURITY;

-- Mensagem de sucesso
SELECT 'Schema completo criado com sucesso!' AS status;
