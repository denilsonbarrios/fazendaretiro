import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não configuradas!');
  console.log('\n📝 Configure no arquivo .env:');
  console.log('   SUPABASE_URL=https://xxxxx.supabase.co');
  console.log('   SUPABASE_SERVICE_KEY=sua-service-role-key-aqui\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function importData() {
  console.log('🚀 Iniciando importação para Supabase...\n');
  console.log(`📡 URL: ${SUPABASE_URL}\n`);

  // Ler dados exportados
  const dataPath = path.join(__dirname, 'sqlite-export.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Arquivo sqlite-export.json não encontrado em ${dataPath}`);
    console.log('\n📝 Execute primeiro: npm run export-sqlite\n');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Limpar tabelas existentes (ordem inversa para respeitar foreign keys)
  console.log('🧹 Limpando tabelas existentes...\n');
  const cleanOrder = [
    'semanas_colheita',
    'prev_realizado',
    'previsoes',
    'carregamentos',
    'talhao_safra',
    'talhoes',
    'talhoes_kml',
    'motoristas',
    'variedade_configs',
    'tipo_configs',
    'safras',
    'kml_files',
    'users'
  ];

  for (const tableName of cleanOrder) {
    try {
      const { error } = await supabase.from(tableName).delete().neq('id', '');
      if (error) {
        console.log(`   ⚠️  ${tableName}: ${error.message}`);
      } else {
        console.log(`   ✅ ${tableName} limpo`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${tableName}: erro ao limpar`);
    }
  }
  
  console.log('\n');

  // Ordem de importação (respeitar foreign keys)
  const importOrder = [
    'users',
    'kml_files',        // Primeiro: sem dependências
    'safras',           // Sem dependências
    'tipo_configs',     // Sem dependências
    'variedade_configs', // Sem dependências
    'motoristas',       // Sem dependências
    'talhoes_kml',      // Depende de kml_files
    'talhoes',          // Depende de talhoes_kml
    'talhao_safra',     // Depende de talhoes e safras
    'carregamentos',    // Depende de talhoes e safras
    'previsoes',        // Depende de talhoes e safras
    'prev_realizado',   // Depende de safras
    'semanas_colheita'  // Depende de safras
  ];

  let totalImported = 0;
  let totalErrors = 0;

  for (const tableName of importOrder) {
    const rows = data[tableName] || [];
    
    if (rows.length === 0) {
      console.log(`⏭️  ${tableName}: sem dados para importar`);
      continue;
    }

    console.log(`\n📥 Importando ${tableName} (${rows.length} registros)...`);

    // Importar em lotes de 100 registros
    const batchSize = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      try {
        const { data: result, error } = await supabase
          .from(tableName)
          .insert(batch);

        if (error) {
          console.error(`   ❌ Erro no lote ${i}-${i + batchSize}: ${error.message}`);
          
          // Se for erro de foreign key em talhao_safra, mostrar IDs problemáticos
          if (tableName === 'talhao_safra' && error.message.includes('foreign key')) {
            const talhaoIds = batch.map((r: any) => r.talhao_id).slice(0, 5);
            console.error(`   🔍 Primeiros talhao_ids do lote: ${talhaoIds.join(', ')}`);
          }
          
          errors += batch.length;
        } else {
          imported += batch.length;
          console.log(`   ✅ Lote ${Math.floor(i / batchSize) + 1}: ${batch.length} registros`);
        }
      } catch (err) {
        console.error(`   ❌ Exceção no lote ${i}-${i + batchSize}:`, err);
        errors += batch.length;
      }
    }

    totalImported += imported;
    totalErrors += errors;

    if (errors === 0) {
      console.log(`✅ ${tableName}: ${imported} registros importados com sucesso`);
    } else {
      console.log(`⚠️  ${tableName}: ${imported} importados, ${errors} com erro`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 Migração concluída!');
  console.log(`📊 Total importado: ${totalImported} registros`);
  if (totalErrors > 0) {
    console.log(`⚠️  Total com erro: ${totalErrors} registros`);
  }
  console.log(`${'='.repeat(60)}\n`);

  console.log('✅ Próximos passos:');
  console.log('   1. Verifique os dados no dashboard do Supabase');
  console.log('   2. Teste as queries principais');
  console.log('   3. Atualize o backend para usar Supabase (db-supabase.ts)');
  console.log('   4. Teste localmente antes de fazer deploy\n');
}

// Executar importação
importData()
  .catch(error => {
    console.error('❌ Erro fatal durante importação:', error);
    process.exit(1);
  });
