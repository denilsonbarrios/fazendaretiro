import { runQuery, fetchQuery, generateId } from './db';

/**
 * Script de migração para implementar a nova estrutura:
 * - Tabela `talhoes` (dados imutáveis)
 * - Tabela `talhoes_safra` (dados específicos da safra)
 */

export async function migrateTalhoesToSafraStructure(): Promise<void> {
  try {
    console.log('🚀 Iniciando migração para estrutura talhões + talhões_safra...');

    // 1. Criar tabela talhoes_nova (estrutura final)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhoes_nova (
        id TEXT PRIMARY KEY,
        TalhaoID TEXT UNIQUE,
        NOME TEXT NOT NULL,
        AREA TEXT,
        coordinates TEXT,
        TIPO TEXT,
        PORTAENXERTO TEXT,
        DATA_DE_PLANTIO TEXT,
        COR TEXT DEFAULT '#00FF00',
        OBS TEXT,
        ativo INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `);

    // 2. Criar tabela talhoes_safra
    await runQuery(`
      CREATE TABLE IF NOT EXISTS talhoes_safra (
        id TEXT PRIMARY KEY,
        talhao_id TEXT NOT NULL,
        safra_id TEXT NOT NULL,
        VARIEDADE TEXT,
        qtde_plantas INTEGER,
        IDADE INTEGER,
        FALHAS INTEGER DEFAULT 0,
        ESP TEXT,
        qtde_caixas_prev_pe REAL,
        total_cx_prev INTEGER DEFAULT 0,
        total_cx_realizado INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now')),
        FOREIGN KEY (talhao_id) REFERENCES talhoes_nova(id) ON DELETE CASCADE,
        FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE,
        UNIQUE(talhao_id, safra_id)
      )
    `);

    // 3. Verificar se já foi migrado
    const isMigrated = await checkIfAlreadyMigrated();
    if (isMigrated) {
      console.log('✅ Migração já foi realizada anteriormente.');
      return;
    }

    // 4. Migrar dados da tabela talhoes atual
    console.log('📦 Migrando dados dos talhões...');
    const talhoesAtuais = await fetchQuery<any>('SELECT * FROM talhoes', []);
    
    for (const talhao of talhoesAtuais) {
      // Inserir na nova tabela talhoes (apenas dados imutáveis)
      await runQuery(`
        INSERT INTO talhoes_nova (
          id, TalhaoID, NOME, AREA, coordinates, TIPO, PORTAENXERTO, 
          DATA_DE_PLANTIO, COR, OBS, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        talhao.id,
        talhao.TalhaoID,
        talhao.NOME,
        talhao.AREA,
        talhao.coordinates,
        talhao.TIPO,
        talhao.PORTAENXERTO,
        talhao.DATA_DE_PLANTIO,
        talhao.COR || '#00FF00',
        talhao.OBS,
        talhao.ativo || 1
      ]);
    }

    // 5. Criar registros em talhoes_safra para safra ativa
    console.log('🌱 Criando registros talhões_safra para safra ativa...');
    const safraAtiva = await fetchQuery<any>('SELECT id FROM safras WHERE is_active = 1 LIMIT 1', []);
    
    if (safraAtiva.length > 0) {
      const safraId = safraAtiva[0].id;
      
      for (const talhao of talhoesAtuais) {
        if (talhao.ativo) {
          await runQuery(`
            INSERT INTO talhoes_safra (
              id, talhao_id, safra_id, VARIEDADE, qtde_plantas, IDADE, 
              FALHAS, ESP, qtde_caixas_prev_pe
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            generateId(),
            talhao.id,
            safraId,
            talhao.VARIEDADE,
            talhao.qtde_plantas || 0,
            talhao.IDADE || 0,
            talhao.FALHAS || 0,
            talhao.ESP,
            0 // qtde_caixas_prev_pe será calculado posteriormente
          ]);
        }
      }
    }

    // 6. Migrar dados de previsões existentes se houver
    console.log('📊 Migrando previsões existentes...');
    await migrateExistingPrevisions();

    // 7. Criar backup da tabela original
    console.log('💾 Criando backup da tabela original...');
    await runQuery('ALTER TABLE talhoes RENAME TO talhoes_backup');

    // 8. Renomear nova tabela
    await runQuery('ALTER TABLE talhoes_nova RENAME TO talhoes');

    // 9. Atualizar carregamentos para usar nova estrutura se necessário
    console.log('🔄 Atualizando referências nos carregamentos...');
    // Os carregamentos já usam talhao_id, então não precisamos alterar

    // 10. Marcar migração como concluída
    await markMigrationAsComplete();

    console.log('✅ Migração concluída com sucesso!');
    console.log('📝 Tabela original salva como talhoes_backup');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
}

async function checkIfAlreadyMigrated(): Promise<boolean> {
  try {
    // Verifica se a tabela talhoes_safra existe e tem dados
    const result = await fetchQuery<any>("SELECT name FROM sqlite_master WHERE type='table' AND name='talhoes_safra'", []);
    if (result.length === 0) return false;
    
    const count = await fetchQuery<any>("SELECT COUNT(*) as count FROM talhoes_safra", []);
    return count[0].count > 0;
  } catch {
    return false;
  }
}

async function migrateExistingPrevisions(): Promise<void> {
  try {
    const previsoes = await fetchQuery<any>('SELECT * FROM previsoes', []);
    
    for (const previsao of previsoes) {
      // Atualizar talhoes_safra com dados da previsão
      await runQuery(`
        UPDATE talhoes_safra 
        SET 
          VARIEDADE = ?,
          qtde_plantas = ?,
          IDADE = ?,
          qtde_caixas_prev_pe = ?,
          total_cx_prev = ?
        WHERE talhao_id = ? AND safra_id = ?
      `, [
        previsao.variedade,
        previsao.qtde_plantas,
        previsao.idade,
        previsao.qtde_caixas_prev_pe,
        Math.round((previsao.qtde_plantas || 0) * (previsao.qtde_caixas_prev_pe || 0)),
        previsao.talhao_id,
        previsao.safra_id
      ]);
    }
    
    console.log(`📊 Migradas ${previsoes.length} previsões para talhoes_safra`);
  } catch (error) {
    console.warn('⚠️ Erro ao migrar previsões (tabela pode não existir):', error);
  }
}

async function markMigrationAsComplete(): Promise<void> {
  // Criar tabela de controle de migrações se não existir
  await runQuery(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
  
  await runQuery(`
    INSERT OR IGNORE INTO migrations (id, name) 
    VALUES (?, ?)
  `, [generateId(), 'talhoes_safra_structure_2025']);
}

/**
 * Função para reverter a migração (usar com cuidado!)
 */
export async function rollbackTalhoesStructure(): Promise<void> {
  try {
    console.log('🔙 Revertendo migração...');
    
    // Verificar se backup existe
    const backupExists = await fetchQuery<any>("SELECT name FROM sqlite_master WHERE type='table' AND name='talhoes_backup'", []);
    if (backupExists.length === 0) {
      throw new Error('Backup não encontrado. Não é possível reverter.');
    }
    
    // Restaurar backup
    await runQuery('DROP TABLE IF EXISTS talhoes');
    await runQuery('ALTER TABLE talhoes_backup RENAME TO talhoes');
    
    // Remover tabelas novas
    await runQuery('DROP TABLE IF EXISTS talhoes_safra');
    
    // Remover registro de migração
    await runQuery("DELETE FROM migrations WHERE name = 'talhoes_safra_structure_2025'");
    
    console.log('✅ Migração revertida com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao reverter migração:', error);
    throw error;
  }
}