import * as fs from 'fs';
import * as path from 'path';

// Ler dados exportados
const dataPath = path.join(__dirname, 'sqlite-export.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('🔍 Diagnóstico: talhao_safra x talhoes\n');

const talhoes = data.talhoes || [];
const talhaoSafra = data.talhao_safra || [];

console.log(`📊 Total de talhões: ${talhoes.length}`);
console.log(`📊 Total de talhao_safra: ${talhaoSafra.length}\n`);

// Criar set de IDs dos talhões
const talhaoIds = new Set(talhoes.map((t: any) => t.id));
console.log(`✅ IDs únicos em talhoes: ${talhaoIds.size}\n`);

// Verificar quais talhao_safra referenciam IDs inexistentes
const problemRecords: any[] = [];

for (const ts of talhaoSafra) {
  if (!talhaoIds.has(ts.talhao_id)) {
    problemRecords.push(ts);
  }
}

if (problemRecords.length > 0) {
  console.log(`❌ Encontrados ${problemRecords.length} registros com talhao_id inexistente:\n`);
  
  // Mostrar primeiros 10
  const sample = problemRecords.slice(0, 10);
  sample.forEach((rec, i) => {
    console.log(`${i + 1}. ID: ${rec.id}, talhao_id: ${rec.talhao_id}, safra_id: ${rec.safra_id}`);
  });
  
  if (problemRecords.length > 10) {
    console.log(`\n... e mais ${problemRecords.length - 10} registros\n`);
  }

  // Verificar se são todos os registros problemáticos
  console.log(`\n📊 Resumo:`);
  console.log(`   - Registros OK: ${talhaoSafra.length - problemRecords.length}`);
  console.log(`   - Registros com problema: ${problemRecords.length}`);
  
  // Salvar IDs problemáticos
  const problemIds = problemRecords.map(r => r.talhao_id);
  const uniqueProblemIds = [...new Set(problemIds)];
  console.log(`   - talhao_ids únicos problemáticos: ${uniqueProblemIds.length}\n`);
  
  console.log('🔍 Primeiros 20 talhao_ids problemáticos:');
  uniqueProblemIds.slice(0, 20).forEach((id, i) => {
    console.log(`   ${i + 1}. ${id}`);
  });
  
} else {
  console.log('✅ Todos os registros de talhao_safra têm talhao_id válido!\n');
}

// Verificar amostra de IDs válidos em talhoes
console.log('\n🔍 Primeiros 10 IDs em talhoes:');
talhoes.slice(0, 10).forEach((t: any, i: number) => {
  console.log(`   ${i + 1}. ${t.id} - ${t.NOME}`);
});

// Verificar primeiros registros de talhao_safra
console.log('\n🔍 Primeiros 10 registros em talhao_safra:');
talhaoSafra.slice(0, 10).forEach((ts: any, i: number) => {
  const exists = talhaoIds.has(ts.talhao_id) ? '✅' : '❌';
  console.log(`   ${i + 1}. ${exists} talhao_id: ${ts.talhao_id}, safra_id: ${ts.safra_id}`);
});
