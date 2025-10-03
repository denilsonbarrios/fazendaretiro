import * as fs from 'fs';
import * as path from 'path';

console.log('🧹 Limpando dados órfãos do export...\n');

// Ler dados exportados
const dataPath = path.join(__dirname, 'sqlite-export.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const talhoes = data.talhoes || [];
const talhaoSafra = data.talhao_safra || [];
const carregamentos = data.carregamentos || [];
const previsoes = data.previsoes || [];
const safras = data.safras || [];

// Criar sets de IDs válidos
const talhaoIds = new Set(talhoes.map((t: any) => t.id));
const safraIds = new Set(safras.map((s: any) => s.id));

console.log(`📊 Totais originais:`);
console.log(`   - talhao_safra: ${talhaoSafra.length}`);
console.log(`   - carregamentos: ${carregamentos.length}`);
console.log(`   - previsoes: ${previsoes.length}\n`);

// Limpar talhao_safra
const cleanTalhaoSafra = talhaoSafra.filter((ts: any) => {
  const hasValidTalhao = talhaoIds.has(ts.talhao_id);
  const hasValidSafra = safraIds.has(ts.safra_id);
  
  if (!hasValidTalhao) {
    console.log(`   ❌ Removendo talhao_safra (id: ${ts.id}) - talhao_id inexistente: ${ts.talhao_id}`);
  }
  if (!hasValidSafra) {
    console.log(`   ❌ Removendo talhao_safra (id: ${ts.id}) - safra_id inexistente: ${ts.safra_id}`);
  }
  
  return hasValidTalhao && hasValidSafra;
});

// Limpar carregamentos (verificar talhao_id e safra_id)
const cleanCarregamentos = carregamentos.filter((c: any) => {
  const hasValidTalhao = talhaoIds.has(c.talhao_id);
  const hasValidSafra = safraIds.has(c.safra_id);
  
  if (!hasValidTalhao) {
    console.log(`   ❌ Removendo carregamento (id: ${c.id}) - talhao_id inexistente: ${c.talhao_id}`);
  }
  if (!hasValidSafra) {
    console.log(`   ❌ Removendo carregamento (id: ${c.id}) - safra_id inexistente: ${c.safra_id}`);
  }
  
  return hasValidTalhao && hasValidSafra;
});

// Limpar previsoes
const cleanPrevisoes = previsoes.filter((p: any) => {
  const hasValidTalhao = talhaoIds.has(p.talhao_id);
  const hasValidSafra = safraIds.has(p.safra_id);
  
  if (!hasValidTalhao) {
    console.log(`   ❌ Removendo previsao (id: ${p.id}) - talhao_id inexistente: ${p.talhao_id}`);
  }
  if (!hasValidSafra) {
    console.log(`   ❌ Removendo previsao (id: ${p.id}) - safra_id inexistente: ${p.safra_id}`);
  }
  
  return hasValidTalhao && hasValidSafra;
});

console.log(`\n📊 Totais após limpeza:`);
console.log(`   - talhao_safra: ${cleanTalhaoSafra.length} (removidos: ${talhaoSafra.length - cleanTalhaoSafra.length})`);
console.log(`   - carregamentos: ${cleanCarregamentos.length} (removidos: ${carregamentos.length - cleanCarregamentos.length})`);
console.log(`   - previsoes: ${cleanPrevisoes.length} (removidos: ${previsoes.length - cleanPrevisoes.length})`);

// Atualizar dados
data.talhao_safra = cleanTalhaoSafra;
data.carregamentos = cleanCarregamentos;
data.previsoes = cleanPrevisoes;

// Salvar arquivo limpo
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`\n✅ Arquivo sqlite-export.json atualizado com sucesso!`);
console.log(`\n📝 Próximo passo: npm run import-to-supabase\n`);
