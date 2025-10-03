#!/usr/bin/env node

/**
 * Script de teste para os novos endpoints de talhões + talhao_safra
 * Execute com: node test-endpoints.js
 */

const BASE_URL = 'http://localhost:3000';

async function testarEndpoints() {
  console.log('🧪 Testando novos endpoints de talhões...\n');

  try {
    // 1. Testar busca de talhões completos por safra
    console.log('1. Testando GET /talhoes-completos/:safra_id');
    const safraId = '6u9kuo79h'; // ID da safra do CSV
    
    const response1 = await fetch(`${BASE_URL}/talhoes-completos/${safraId}`);
    if (response1.ok) {
      const data = await response1.json();
      console.log(`✅ Encontrados ${data.length} talhões para safra ${safraId}`);
      console.log(`   Exemplo: ${data[0]?.NOME} - ${data[0]?.variedade || 'Sem variedade'}`);
    } else {
      console.log('❌ Erro ao buscar talhões completos');
    }

    // 2. Testar estatísticas da safra
    console.log('\n2. Testando GET /safras/:safra_id/estatisticas');
    const response2 = await fetch(`${BASE_URL}/safras/${safraId}/estatisticas`);
    if (response2.ok) {
      const stats = await response2.json();
      console.log('✅ Estatísticas da safra:');
      console.log(`   Total de talhões: ${stats.total_talhoes}`);
      console.log(`   Total de plantas: ${stats.total_plantas}`);
      console.log(`   Variedades: ${stats.por_variedade.length}`);
    } else {
      console.log('❌ Erro ao buscar estatísticas');
    }

    // 3. Testar histórico de um talhão
    console.log('\n3. Testando GET /talhoes/:talhao_id/historico-safras');
    const talhaoId = '53zauawf9'; // ID do primeiro talhão do CSV
    const response3 = await fetch(`${BASE_URL}/talhoes/${talhaoId}/historico-safras`);
    if (response3.ok) {
      const historico = await response3.json();
      console.log(`✅ Histórico do talhão ${talhaoId}: ${historico.length} registros`);
      if (historico.length > 0) {
        console.log(`   Safra atual: ${historico[0].safra_nome} - ${historico[0].variedade}`);
      }
    } else {
      console.log('❌ Erro ao buscar histórico');
    }

    console.log('\n🎉 Testes concluídos!');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    console.log('\n💡 Certifique-se de que o servidor está rodando em http://localhost:3000');
  }
}

// Executar testes
testarEndpoints();

// Documentação dos endpoints
console.log(`
📚 DOCUMENTAÇÃO DOS NOVOS ENDPOINTS:

🔍 CONSULTAS:
GET /talhoes-completos/:safra_id
  - Busca talhões com dados combinados (talhões + talhao_safra)
  - Retorna dados físicos + dados específicos da safra

GET /safras/:safra_id/estatisticas  
  - Estatísticas completas da safra
  - Total de talhões, plantas, variedades, carregamentos

GET /talhoes/:talhao_id/historico-safras
  - Histórico completo de um talhão em todas as safras

GET /comparar-safras/:safra1_id/:safra2_id
  - Comparação lado a lado entre duas safras

📝 EDIÇÃO:
PUT /talhao-safra/:id
  - Atualizar dados específicos de um talhão em uma safra

PUT /talhoes-safra/lote
  - Atualizar múltiplos registros de uma vez

POST /talhoes/:talhao_id/safras/:safra_id
  - Adicionar talhão a uma safra específica

🔄 GERENCIAMENTO:
POST /safras/:safra_id/clonar-de/:safra_origem_id
  - Clonar dados de uma safra para outra
  - Opção de incrementar idade automaticamente

EXEMPLO DE USO:
curl -X POST \\
  "${BASE_URL}/safras/nova-safra-2025/clonar-de/6u9kuo79h" \\
  -H "Content-Type: application/json" \\
  -d '{"incrementar_idade": true}'
`);