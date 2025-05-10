import sqlite3 from 'sqlite3';

// Inicializar o banco de dados SQLite
export const db = new sqlite3.Database('fazendaretiro.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite');
  }
});

// Função para executar uma query de criação de tabela e retornar uma Promise
export const runQuery = (query: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, (err) => {
      if (err) {
        console.error(`Erro ao executar query: ${query}`, err.message);
        reject(err);
      } else {
        console.log(`Query executada com sucesso: ${query.split('\n')[1]?.trim() || query}`);
        resolve();
      }
    });
  });
};

// Função para buscar dados do banco de dados e retornar uma Promise
export const fetchQuery = <T>(query: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Erro ao buscar dados com query: ${query}`, err.message);
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
};

// Função para gerar IDs únicos
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Função para verificar se uma coluna existe em uma tabela
const columnExists = async (table: string, column: string): Promise<boolean> => {
  const query = `PRAGMA table_info(${table})`;
  const columns = await fetchQuery<any>(query, []);
  return columns.some((col) => col.name === column);
};

// Função para inicializar as tabelas de forma assíncrona e realizar migrações
export async function initializeDatabase(): Promise<void> {
  try {
    // Tabela safras
    await runQuery(`
      CREATE TABLE IF NOT EXISTS safras (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        is_active BOOLEAN NOT NULL,
        data_inicial_colheita INTEGER
      )
    `);

    // Tabela kml_files
    await runQuery(`
      CREATE TABLE IF NOT EXISTS kml_files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);

    // Tabela talhoes (apenas NOME é obrigatório, outros campos podem ser NULL)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhoes (
        id TEXT PRIMARY KEY,
        TalhaoID TEXT,
        TIPO TEXT,
        NOME TEXT NOT NULL,
        AREA TEXT,
        VARIEDADE TEXT,
        PORTAENXERTO TEXT,
        DATA_DE_PLANTIO TEXT,
        IDADE INTEGER,
        PRODUCAO_CAIXA INTEGER,
        PRODUCAO_HECTARE INTEGER,
        COR TEXT,
        qtde_plantas INTEGER,
        coordinates TEXT,
        ativo INTEGER DEFAULT 1 -- Novo campo com valor padrão 1 (Ativo)
      )
    `);

    // Verificar e migrar a tabela talhoes
    const tableTalhoesExists = await fetchQuery<any>("SELECT name FROM sqlite_master WHERE type='table' AND name='talhoes'", []);
    if (tableTalhoesExists.length > 0) {
      const hasAtivo = await columnExists('talhoes', 'ativo');
      if (!hasAtivo) {
        await runQuery(`ALTER TABLE talhoes ADD COLUMN ativo INTEGER DEFAULT 1`);
        console.log('Adicionado campo ativo à tabela talhoes com valor padrão 1 (Ativo)');
      }
    }

    // Tabela tipo_configs
    await runQuery(`
      CREATE TABLE IF NOT EXISTS tipo_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_color TEXT NOT NULL
      )
    `);

    // Tabela variedade_configs
    await runQuery(`
      CREATE TABLE IF NOT EXISTS variedade_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_color TEXT NOT NULL
      )
    `);

    // Tabela motoristas
    await runQuery(`
      CREATE TABLE IF NOT EXISTS motoristas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        UNIQUE(nome) -- Garante que não haja duplicatas de motoristas
      )
    `);

    // Verificar e migrar a tabela carregamentos
    const tableExists = await fetchQuery<any>("SELECT name FROM sqlite_master WHERE type='table' AND name='carregamentos'", []);
    if (tableExists.length > 0) {
      // Tabela já existe, realizar migrações
      const hasTalhaoId = await columnExists('carregamentos', 'talhao_id');
      const hasTalhao = await columnExists('carregamentos', 'talhao');
      const hasTalhaoN = await columnExists('carregamentos', 'talhao_n');
      const hasSemanaColheita = await columnExists('carregamentos', 'semana_colheita');
      const hasMedia = await columnExists('carregamentos', 'media');

      // Adicionar colunas que podem estar faltando
      if (!hasTalhaoId) {
        await runQuery(`ALTER TABLE carregamentos ADD COLUMN talhao_id TEXT`);
        console.log('Adicionado campo talhao_id à tabela carregamentos');
      }

      if (!hasSemanaColheita) {
        await runQuery(`ALTER TABLE carregamentos ADD COLUMN semana_colheita INTEGER`);
        console.log('Adicionado campo semana_colheita à tabela carregamentos');
      }

      if (hasTalhao || hasTalhaoN || hasMedia) {
        // Criar uma tabela temporária com a nova estrutura (sem o campo media)
        await runQuery(`
          CREATE TABLE carregamentos_temp (
            id TEXT PRIMARY KEY,
            data INTEGER NOT NULL,
            talhao_id TEXT NOT NULL,
            qtde_plantas INTEGER,
            variedade TEXT,
            motorista TEXT,
            placa TEXT,
            qte_caixa REAL,
            total REAL,
            semana INTEGER,
            semana_colheita INTEGER,
            safra_id TEXT NOT NULL
          )
        `);

        // Copiar os dados da tabela antiga para a nova (usando talhao como talhao_id temporariamente)
        await runQuery(`
          INSERT INTO carregamentos_temp (
            id, data, talhao_id, qtde_plantas, variedade, motorista, placa, qte_caixa, total, semana, semana_colheita, safra_id
          )
          SELECT 
            id, 
            data, 
            COALESCE(talhao, '') AS talhao_id, 
            qtde_plantas, 
            variedade, 
            motorista, 
            placa, 
            qte_caixa, 
            total, 
            semana, 
            semana_colheita, 
            safra_id
          FROM carregamentos
        `);

        // Dropar a tabela antiga
        await runQuery(`DROP TABLE carregamentos`);

        // Renomear a tabela temporária para o nome original
        await runQuery(`ALTER TABLE carregamentos_temp RENAME TO carregamentos`);

        console.log('Migração da tabela carregamentos concluída: talhao, talhao_n e media removidos, talhao_id e semana_colheita adicionados');
      }
    } else {
      // Tabela não existe, criar com a nova estrutura (sem o campo media)
      await runQuery(`
        CREATE TABLE carregamentos (
          id TEXT PRIMARY KEY,
          data INTEGER NOT NULL,
          talhao_id TEXT NOT NULL,
          qtde_plantas INTEGER,
          variedade TEXT,
          motorista TEXT,
          placa TEXT,
          qte_caixa REAL,
          total REAL,
          semana INTEGER,
          semana_colheita INTEGER,
          safra_id TEXT NOT NULL
        )
      `);
    }

    // Tabela prev_realizado
    await runQuery(`
      CREATE TABLE IF NOT EXISTS prev_realizado (
        id TEXT PRIMARY KEY,
        talhao TEXT NOT NULL,
        variedade TEXT,
        total_pes INTEGER,
        cx_pe_prev INTEGER,
        cx_pe_realizado INTEGER,
        total_cx_prev INTEGER,
        total_cx_realizado INTEGER,
        safra_id TEXT NOT NULL
      )
    `);

    // Tabela semanas_colheita (para histórico)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS semanas_colheita (
        id TEXT PRIMARY KEY,
        semana_ano INTEGER NOT NULL,
        semana_colheita INTEGER NOT NULL,
        safra_id TEXT NOT NULL,
        UNIQUE(safra_id, semana_ano) -- Garante que não haja duplicatas para a mesma safra e semana do ano
      )
    `);

    // Tabela previsoes (armazena todas as informações do talhão como histórico)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS previsoes (
        id TEXT PRIMARY KEY,
        talhao_id TEXT NOT NULL,
        safra_id TEXT NOT NULL,
        talhao_nome TEXT NOT NULL,
        variedade TEXT,
        data_de_plantio TEXT,
        idade INTEGER,
        qtde_plantas INTEGER,
        qtde_caixas_prev_pe REAL NOT NULL,
        FOREIGN KEY (talhao_id) REFERENCES talhoes(id),
        FOREIGN KEY (safra_id) REFERENCES safras(id),
        UNIQUE(talhao_id, safra_id)
      )
    `);

    console.log('Todas as tabelas foram inicializadas com sucesso.');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  }
}

// Função para fechar o banco de dados
export function closeDatabase(): void {
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar o banco de dados:', err.message);
    } else {
      console.log('Banco de dados SQLite fechado');
    }
  });
}