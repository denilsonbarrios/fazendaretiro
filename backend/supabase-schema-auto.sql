-- Schema gerado automaticamente do SQLite
-- Data: 2025-10-03T13:22:45.086Z

-- PRIMEIRO: Dropar tabelas existentes (ordem inversa para respeitar foreign keys)
DROP TABLE IF EXISTS semanas_colheita CASCADE;
DROP TABLE IF EXISTS prev_realizado CASCADE;
DROP TABLE IF EXISTS previsoes CASCADE;
DROP TABLE IF EXISTS carregamentos CASCADE;
DROP TABLE IF EXISTS talhao_safra CASCADE;
DROP TABLE IF EXISTS talhoes CASCADE;
DROP TABLE IF EXISTS talhoes_kml CASCADE;
DROP TABLE IF EXISTS motoristas CASCADE;
DROP TABLE IF EXISTS variedade_configs CASCADE;
DROP TABLE IF EXISTS tipo_configs CASCADE;
DROP TABLE IF EXISTS safras CASCADE;
DROP TABLE IF EXISTS kml_files CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Tabela: users
CREATE TABLE users (
  id TEXT,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  PRIMARY KEY (id),
  UNIQUE(username)
);

-- Tabela: kml_files
CREATE TABLE kml_files (
  id TEXT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela: safras
CREATE TABLE safras (
  id TEXT,
  nome TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  data_inicial_colheita BIGINT,
  PRIMARY KEY (id)
);

-- Tabela: tipo_configs
CREATE TABLE tipo_configs (
  id TEXT,
  name TEXT NOT NULL,
  default_color TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela: variedade_configs
CREATE TABLE variedade_configs (
  id TEXT,
  name TEXT NOT NULL,
  default_color TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela: motoristas
CREATE TABLE motoristas (
  id TEXT,
  nome TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE(nome)
);

-- Tabela: talhoes_kml
CREATE TABLE talhoes_kml (
  id TEXT,
  placemark_name TEXT NOT NULL,
  coordinates TEXT NOT NULL,
  geometry_type TEXT NOT NULL,
  kml_file_id TEXT,
  data_importacao BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  ativo BIGINT DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (kml_file_id) REFERENCES kml_files(id) ON DELETE CASCADE,
  UNIQUE(placemark_name)
);

-- Tabela: talhoes
CREATE TABLE talhoes (
  id TEXT,
  "TalhaoID" TEXT,
  "TIPO" TEXT,
  "NOME" TEXT NOT NULL,
  "AREA" TEXT,
  "VARIEDADE" TEXT,
  "PORTAENXERTO" TEXT,
  "DATA_DE_PLANTIO" TEXT,
  "IDADE" BIGINT,
  "FALHAS" BIGINT,
  "ESP" TEXT,
  "COR" TEXT DEFAULT '#00FF00',
  qtde_plantas BIGINT,
  talhao_kml_id TEXT,
  ativo BIGINT DEFAULT 1,
  "OBS" TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (talhao_kml_id) REFERENCES talhoes_kml(id) ON DELETE CASCADE,
  UNIQUE("TalhaoID")
);

-- Tabela: talhao_safra
CREATE TABLE talhao_safra (
  id TEXT,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  area TEXT,
  variedade TEXT,
  qtde_plantas BIGINT,
  porta_enxerto TEXT,
  data_de_plantio TEXT,
  idade BIGINT,
  falhas BIGINT,
  esp TEXT,
  obs TEXT,
  ativo BIGINT DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE,
  FOREIGN KEY (talhao_id) REFERENCES talhoes(id) ON DELETE CASCADE,
  UNIQUE(talhao_id, safra_id)
);

-- Tabela: carregamentos
CREATE TABLE carregamentos (
  id TEXT,
  data BIGINT NOT NULL,
  talhao_id TEXT NOT NULL,
  qtde_plantas BIGINT,
  variedade TEXT,
  motorista TEXT,
  placa TEXT,
  qte_caixa REAL,
  semana BIGINT,
  semana_colheita BIGINT,
  safra_id TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela: previsoes
CREATE TABLE previsoes (
  id TEXT,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  talhao_nome TEXT NOT NULL,
  variedade TEXT,
  data_de_plantio TEXT,
  idade BIGINT,
  qtde_plantas BIGINT,
  qtde_caixas_prev_pe REAL NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE,
  FOREIGN KEY (talhao_id) REFERENCES talhoes(id) ON DELETE CASCADE,
  UNIQUE(talhao_id, safra_id)
);

-- Tabela: prev_realizado
CREATE TABLE prev_realizado (
  id TEXT,
  talhao TEXT NOT NULL,
  variedade TEXT,
  total_pes BIGINT,
  cx_pe_prev BIGINT,
  cx_pe_realizado BIGINT,
  total_cx_prev BIGINT,
  total_cx_realizado BIGINT,
  safra_id TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela: semanas_colheita
CREATE TABLE semanas_colheita (
  id TEXT,
  semana_ano BIGINT NOT NULL,
  semana_colheita BIGINT NOT NULL,
  safra_id TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE(safra_id, semana_ano)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_talhao_safra_talhao ON talhao_safra(talhao_id);
CREATE INDEX IF NOT EXISTS idx_talhao_safra_safra ON talhao_safra(safra_id);
CREATE INDEX IF NOT EXISTS idx_carregamentos_talhao ON carregamentos(talhao_id);
CREATE INDEX IF NOT EXISTS idx_carregamentos_safra ON carregamentos(safra_id);
CREATE INDEX IF NOT EXISTS idx_carregamentos_data ON carregamentos(data);

-- Desabilitar Row Level Security (usando JWT próprio)
ALTER TABLE carregamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kml_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas DISABLE ROW LEVEL SECURITY;
ALTER TABLE prev_realizado DISABLE ROW LEVEL SECURITY;
ALTER TABLE previsoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE safras DISABLE ROW LEVEL SECURITY;
ALTER TABLE semanas_colheita DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhao_safra DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes_kml DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE variedade_configs DISABLE ROW LEVEL SECURITY;

-- Mensagem de sucesso
SELECT 'Schema gerado e aplicado com sucesso!' AS status;
