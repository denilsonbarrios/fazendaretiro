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

// Função para verificar se uma tabela existe
const tableExists = async (table: string): Promise<boolean> => {
  const query = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
  const result = await fetchQuery<any>(query, [table]);
  return result.length > 0;
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

    // Tabela users (autenticação)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nome TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Tabela kml_files
    await runQuery(`
      CREATE TABLE IF NOT EXISTS kml_files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);    // Tabela talhoes_kml (dados geográficos importados do KML)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhoes_kml (
        id TEXT PRIMARY KEY,
        placemark_name TEXT NOT NULL UNIQUE,
        coordinates TEXT NOT NULL,
        geometry_type TEXT NOT NULL,
        kml_file_id TEXT,
        data_importacao INTEGER DEFAULT (strftime('%s', 'now')),
        ativo INTEGER DEFAULT 1,
        FOREIGN KEY (kml_file_id) REFERENCES kml_files(id)
      )
    `);

    // Tabela talhoes (informações produtivas e agronômicas)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhoes (
        id TEXT PRIMARY KEY,
        TalhaoID TEXT UNIQUE,
        TIPO TEXT,
        NOME TEXT NOT NULL,
        AREA TEXT,
        VARIEDADE TEXT,
        PORTAENXERTO TEXT,
        DATA_DE_PLANTIO TEXT,
        IDADE INTEGER,
        FALHAS INTEGER,
        ESP TEXT,
        COR TEXT DEFAULT '#00FF00',
        qtde_plantas INTEGER,
        talhao_kml_id TEXT,
        ativo INTEGER DEFAULT 1,
        OBS TEXT,
        FOREIGN KEY (talhao_kml_id) REFERENCES talhoes_kml(id)
      )
    `);    // Verificar e migrar a estrutura das tabelas talhoes e talhoes_kml
    const tableTalhoesExists = await tableExists('talhoes');
    const tableTalhoesKmlExists = await tableExists('talhoes_kml');
    
    if (tableTalhoesExists && !tableTalhoesKmlExists) {
      console.log('Migrando estrutura: separando dados geográficos dos dados produtivos...');
      
      // Criar tabela talhoes_kml se não existir
      await runQuery(`
        CREATE TABLE IF NOT EXISTS talhoes_kml (
          id TEXT PRIMARY KEY,
          placemark_name TEXT NOT NULL UNIQUE,
          coordinates TEXT NOT NULL,
          geometry_type TEXT NOT NULL,
          kml_file_id TEXT,
          data_importacao INTEGER DEFAULT (strftime('%s', 'now')),
          ativo INTEGER DEFAULT 1,
          FOREIGN KEY (kml_file_id) REFERENCES kml_files(id)
        )
      `);
      
      // Migrar dados de coordenadas existentes para talhoes_kml
      const talhoesComCoordenadas = await fetchQuery<any>("SELECT id, NOME, coordinates FROM talhoes WHERE coordinates IS NOT NULL AND coordinates != ''", []);
      
      for (const talhao of talhoesComCoordenadas) {
        try {
          const kmlId = generateId();
          await runQuery(`
            INSERT INTO talhoes_kml (id, placemark_name, coordinates, geometry_type, ativo)
            VALUES (?, ?, ?, ?, ?)
          `, [kmlId, talhao.NOME, talhao.coordinates, 'Polygon', 1]);
          
          // Atualizar talhao para referenciar o talhoes_kml
          await runQuery(`UPDATE talhoes SET talhao_kml_id = ? WHERE id = ?`, [kmlId, talhao.id]);
          
          console.log(`Migrado talhão ${talhao.NOME} para estrutura separada`);
        } catch (error) {
          console.warn(`Erro ao migrar talhão ${talhao.NOME}:`, error);
        }
      }
      
      // Remover coluna coordinates da tabela talhoes (criar nova tabela sem coordinates)
      const talhoesSemCoordenadas = await fetchQuery<any>("SELECT * FROM talhoes", []);
      
      await runQuery(`
        CREATE TABLE talhoes_new (
          id TEXT PRIMARY KEY,
          TalhaoID TEXT UNIQUE,
          TIPO TEXT,
          NOME TEXT NOT NULL,
          AREA TEXT,
          VARIEDADE TEXT,
          PORTAENXERTO TEXT,
          DATA_DE_PLANTIO TEXT,
          IDADE INTEGER,
          FALHAS INTEGER,
          ESP TEXT,
          COR TEXT DEFAULT '#00FF00',
          qtde_plantas INTEGER,
          talhao_kml_id TEXT,
          ativo INTEGER DEFAULT 1,
          OBS TEXT,
          FOREIGN KEY (talhao_kml_id) REFERENCES talhoes_kml(id)
        )
      `);
      
      for (const talhao of talhoesSemCoordenadas) {
        await runQuery(`
          INSERT INTO talhoes_new (
            id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, 
            DATA_DE_PLANTIO, IDADE, FALHAS, ESP, COR, qtde_plantas, 
            talhao_kml_id, ativo, OBS
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          talhao.id, talhao.TalhaoID, talhao.TIPO, talhao.NOME, talhao.AREA,
          talhao.VARIEDADE, talhao.PORTAENXERTO, talhao.DATA_DE_PLANTIO,
          talhao.IDADE, talhao.FALHAS, talhao.ESP, talhao.COR || '#00FF00',
          talhao.qtde_plantas, talhao.talhao_kml_id, talhao.ativo || 1, talhao.OBS
        ]);
      }
      
      await runQuery(`DROP TABLE talhoes`);
      await runQuery(`ALTER TABLE talhoes_new RENAME TO talhoes`);
      
      console.log('Migração concluída: dados geográficos separados dos dados produtivos');
    }
    
    // Verificações adicionais para campos específicos em talhoes
    if (await tableExists('talhoes')) {
      const hasAtivo = await columnExists('talhoes', 'ativo');
      if (!hasAtivo) {
        await runQuery(`ALTER TABLE talhoes ADD COLUMN ativo INTEGER DEFAULT 1`);
        console.log('Adicionado campo ativo à tabela talhoes com valor padrão 1 (Ativo)');
      }
      
      const hasTalhaoKmlId = await columnExists('talhoes', 'talhao_kml_id');
      if (!hasTalhaoKmlId) {
        await runQuery(`ALTER TABLE talhoes ADD COLUMN talhao_kml_id TEXT REFERENCES talhoes_kml(id)`);
        console.log('Adicionado campo talhao_kml_id à tabela talhoes');
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
    const carregamentosTableExists = await tableExists('carregamentos');
    if (carregamentosTableExists) {
      // Tabela já existe, realizar migrações
      const hasTalhaoId = await columnExists('carregamentos', 'talhao_id');
      const hasTalhao = await columnExists('carregamentos', 'talhao');
      const hasTalhaoN = await columnExists('carregamentos', 'talhao_n');
      const hasSemanaColheita = await columnExists('carregamentos', 'semana_colheita');
      const hasMedia = await columnExists('carregamentos', 'media');
      const hasTotal = await columnExists('carregamentos', 'total');

      // Adicionar colunas que podem estar faltando
      if (!hasTalhaoId) {
        await runQuery(`ALTER TABLE carregamentos ADD COLUMN talhao_id TEXT`);
        console.log('Adicionado campo talhao_id à tabela carregamentos');
      }

      if (!hasSemanaColheita) {
        await runQuery(`ALTER TABLE carregamentos ADD COLUMN semana_colheita INTEGER`);
        console.log('Adicionado campo semana_colheita à tabela carregamentos');
      }

      // Verificar se a tabela precisa ser migrada (remover talhao, talhao_n, media, total, ajustar talhao_id e semana_colheita)
      if (hasTalhao || hasTalhaoN || hasMedia || hasTotal) {
        // Verificar se a tabela temporária existe e dropar se necessário
        const carregamentosTempExists = await tableExists('carregamentos_temp');
        if (carregamentosTempExists) {
          await runQuery(`DROP TABLE carregamentos_temp`);
          console.log('Tabela temporária carregamentos_temp existente foi removida para nova migração');
        }

        // Criar uma tabela temporária com a nova estrutura (sem os campos media e total)
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
            semana INTEGER,
            semana_colheita INTEGER,
            safra_id TEXT NOT NULL
          )
        `);

        // Copiar os dados da tabela antiga para a nova (usando talhao_id diretamente)
        await runQuery(`
          INSERT INTO carregamentos_temp (
            id, data, talhao_id, qtde_plantas, variedade, motorista, placa, qte_caixa, semana, semana_colheita, safra_id
          )
          SELECT 
            id, 
            data, 
            talhao_id, 
            qtde_plantas, 
            variedade, 
            motorista, 
            placa, 
            qte_caixa,
            semana, 
            semana_colheita, 
            safra_id
          FROM carregamentos
        `);

        // Dropar a tabela antiga
        await runQuery(`DROP TABLE carregamentos`);

        // Renomear a tabela temporária para o nome original
        await runQuery(`ALTER TABLE carregamentos_temp RENAME TO carregamentos`);

        console.log('Migração da tabela carregamentos concluída: talhao, talhao_n, media e total removidos, talhao_id e semana_colheita ajustados');
      }
    } else {
      // Tabela não existe, criar com a nova estrutura (sem os campos media e total)
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
    `);    // Tabela intermediária talhao_safra para histórico de dados do talhão por safra
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhao_safra (
        id TEXT PRIMARY KEY,
        talhao_id TEXT NOT NULL,
        safra_id TEXT NOT NULL,
        area TEXT,
        variedade TEXT,
        qtde_plantas INTEGER,
        porta_enxerto TEXT,
        data_de_plantio TEXT,
        idade INTEGER,
        falhas INTEGER,
        esp TEXT,
        obs TEXT,
        ativo INTEGER DEFAULT 1,
        UNIQUE(talhao_id, safra_id),
        FOREIGN KEY (talhao_id) REFERENCES talhoes(id),
        FOREIGN KEY (safra_id) REFERENCES safras(id)
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