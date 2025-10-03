import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(__dirname, 'fazendaretiro.db');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Banco de dados não encontrado: ${dbPath}`);
  process.exit(1);
}

// Função auxiliar para promisificar queries do sqlite3
function queryAll(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Mapear tipos SQLite para PostgreSQL
function mapTypeToPostgres(sqliteType: string): string {
  const type = sqliteType.toUpperCase();
  if (type.includes('INT')) return 'BIGINT';
  if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'REAL';
  if (type.includes('BOOL')) return 'BOOLEAN';
  if (type.includes('TEXT') || type.includes('CHAR') || type.includes('CLOB')) return 'TEXT';
  return 'TEXT'; // fallback
}

async function generateSchema() {
  console.log('🔍 Analisando schema do SQLite...\n');

  const db = new sqlite3.Database(dbPath);

  try {
    // Obter lista de tabelas
    const tables = await queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    // Ordem correta de criação (respeitando foreign keys)
    const tableOrder = [
      'users',
      'kml_files',
      'safras',
      'tipo_configs',
      'variedade_configs',
      'motoristas',
      'talhoes_kml',
      'talhoes',
      'talhao_safra',
      'carregamentos',
      'previsoes',
      'prev_realizado',
      'semanas_colheita'
    ];

    // Filtrar apenas tabelas que existem
    const existingTables = tables.map((t: any) => t.name);
    const orderedTables = tableOrder.filter(t => existingTables.includes(t));
    const remainingTables = existingTables.filter((t: string) => !orderedTables.includes(t));
    const finalOrder = [...orderedTables, ...remainingTables];

    let sqlScript = `-- Schema gerado automaticamente do SQLite\n`;
    sqlScript += `-- Data: ${new Date().toISOString()}\n\n`;

    // Ordem de DROP (inversa da criação)
    sqlScript += `-- PRIMEIRO: Dropar tabelas existentes (ordem inversa para respeitar foreign keys)\n`;
    for (let i = finalOrder.length - 1; i >= 0; i--) {
      sqlScript += `DROP TABLE IF EXISTS ${finalOrder[i]} CASCADE;\n`;
    }
    sqlScript += `\n`;

    // Analisar cada tabela na ordem correta
    for (const tableName of finalOrder) {
      console.log(`📋 Analisando tabela: ${tableName}`);

      // Obter schema da tabela
      const tableInfo = await queryAll(db, `PRAGMA table_info(${tableName})`);

      sqlScript += `-- Tabela: ${tableName}\n`;
      sqlScript += `CREATE TABLE ${tableName} (\n`;

      const columns: string[] = [];
      const primaryKeys: string[] = [];

      for (const col of tableInfo) {
        const colName = col.name;
        const colType = mapTypeToPostgres(col.type || 'TEXT');
        const notNull = col.notnull ? ' NOT NULL' : '';
        
        // Converter strftime para PostgreSQL
        let defaultValue = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
        if (defaultValue.includes("strftime('%s', 'now')")) {
          defaultValue = ' DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT';
        }
        
        // Colocar nomes com maiúsculas entre aspas
        const quotedName = /[A-Z]/.test(colName) ? `"${colName}"` : colName;
        
        columns.push(`  ${quotedName} ${colType}${notNull}${defaultValue}`);
        
        if (col.pk) {
          primaryKeys.push(quotedName);
        }

        console.log(`   - ${colName}: ${colType}${notNull}${defaultValue}`);
      }

      // Adicionar primary key
      if (primaryKeys.length > 0) {
        columns.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
      }

      // Obter foreign keys
      const foreignKeys = await queryAll(db, `PRAGMA foreign_key_list(${tableName})`);
      for (const fk of foreignKeys) {
        const fromCol = fk.from;
        const toTable = fk.table;
        const toCol = fk.to;
        const quotedFrom = /[A-Z]/.test(fromCol) ? `"${fromCol}"` : fromCol;
        const quotedTo = /[A-Z]/.test(toCol) ? `"${toCol}"` : toCol;
        columns.push(`  FOREIGN KEY (${quotedFrom}) REFERENCES ${toTable}(${quotedTo}) ON DELETE CASCADE`);
        console.log(`   FK: ${fromCol} → ${toTable}(${toCol})`);
      }

      // Obter unique constraints
      const indexes = await queryAll(db, `PRAGMA index_list(${tableName})`);
      for (const idx of indexes) {
        if (idx.unique && !idx.origin.includes('pk')) {
          const indexInfo = await queryAll(db, `PRAGMA index_info(${idx.name})`);
          const uniqueCols = indexInfo.map((i: any) => {
            const colName = i.name;
            return /[A-Z]/.test(colName) ? `"${colName}"` : colName;
          }).join(', ');
          columns.push(`  UNIQUE(${uniqueCols})`);
          console.log(`   UNIQUE: ${uniqueCols}`);
        }
      }

      sqlScript += columns.join(',\n');
      sqlScript += `\n);\n\n`;
    }

    // Adicionar índices
    sqlScript += `-- Índices para performance\n`;
    sqlScript += `CREATE INDEX IF NOT EXISTS idx_talhao_safra_talhao ON talhao_safra(talhao_id);\n`;
    sqlScript += `CREATE INDEX IF NOT EXISTS idx_talhao_safra_safra ON talhao_safra(safra_id);\n`;
    sqlScript += `CREATE INDEX IF NOT EXISTS idx_carregamentos_talhao ON carregamentos(talhao_id);\n`;
    sqlScript += `CREATE INDEX IF NOT EXISTS idx_carregamentos_safra ON carregamentos(safra_id);\n`;
    sqlScript += `CREATE INDEX IF NOT EXISTS idx_carregamentos_data ON carregamentos(data);\n\n`;

    // Desabilitar RLS
    sqlScript += `-- Desabilitar Row Level Security (usando JWT próprio)\n`;
    for (const table of tables) {
      sqlScript += `ALTER TABLE ${table.name} DISABLE ROW LEVEL SECURITY;\n`;
    }

    sqlScript += `\n-- Mensagem de sucesso\n`;
    sqlScript += `SELECT 'Schema gerado e aplicado com sucesso!' AS status;\n`;

    // Salvar arquivo
    const outputPath = path.join(__dirname, 'supabase-schema-auto.sql');
    fs.writeFileSync(outputPath, sqlScript, 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Schema SQL gerado: ${outputPath}`);
    console.log(`📋 Total de tabelas: ${tables.length}`);
    console.log(`${'='.repeat(60)}\n`);

    console.log('📝 Próximos passos:');
    console.log('   1. Abra o Supabase SQL Editor');
    console.log('   2. Cole o conteúdo de supabase-schema-auto.sql');
    console.log('   3. Execute (Run)');
    console.log('   4. Execute: npm run import-to-supabase\n');

    db.close();
  } catch (error) {
    console.error('❌ Erro:', error);
    db.close();
    process.exit(1);
  }
}

generateSchema();
