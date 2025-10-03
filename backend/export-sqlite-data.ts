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

// Função para exportar todas as tabelas
async function exportAllData() {
  console.log('🚀 Iniciando exportação do SQLite...\n');

  const db = new sqlite3.Database(dbPath);

  const tables = [
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

  const exportData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const tableName of tables) {
    try {
      // Verificar se tabela existe
      const tableExists = await queryAll(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );

      if (tableExists.length === 0) {
        console.log(`⏭️  ${tableName}: tabela não existe`);
        exportData[tableName] = [];
        continue;
      }

      // Exportar dados
      const rows = await queryAll(db, `SELECT * FROM ${tableName}`);
      exportData[tableName] = rows;
      totalRecords += rows.length;
      
      console.log(`✅ ${tableName}: ${rows.length} registros exportados`);
    } catch (error) {
      console.error(`❌ Erro ao exportar ${tableName}:`, error);
      exportData[tableName] = [];
    }
  }

  // Salvar em arquivo JSON
  const outputPath = path.join(__dirname, 'sqlite-export.json');
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Dados exportados para: ${outputPath}`);
  console.log(`📊 Total de tabelas: ${tables.length}`);
  console.log(`📈 Total de registros: ${totalRecords}`);
  console.log(`${'='.repeat(60)}\n`);

  // Exibir resumo por tabela
  console.log('📋 Resumo da exportação:\n');
  Object.entries(exportData).forEach(([table, rows]) => {
    if (rows.length > 0) {
      console.log(`   ${table.padEnd(20)} → ${rows.length} registros`);
    }
  });

  console.log(`\n✨ Próximo passo: Execute 'npm run import-to-supabase' para importar os dados\n`);

  // Fechar conexão
  db.close();
}

// Executar exportação
exportAllData().catch(error => {
  console.error('❌ Erro fatal durante exportação:', error);
  process.exit(1);
});
