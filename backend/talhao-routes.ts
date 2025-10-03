import express from 'express';
import { fetchQuery, runQuery, generateId } from './db';

/**
 * Endpoints aprimorados para trabalhar com a estrutura atual:
 * - talhoes (dados físicos/imutáveis)
 * - talhao_safra (dados específicos da safra)
 * - carregamentos (registros de colheita)
 */

export const talhaoRoutes = (app: express.Application, asyncHandler: any) => {
  
  // GET /debug/safras - Consultar todas as safras diretamente do banco
  app.get('/debug/safras', asyncHandler(async (req: express.Request, res: express.Response) => {
    const safras = await fetchQuery<any>(`SELECT * FROM safras ORDER BY nome DESC`, []);
    res.json({
      total: safras.length,
      safras: safras
    });
  }));

  // GET /debug/talhao-safra/:safra_id - Consultar talhao_safra de uma safra específica
  app.get('/debug/talhao-safra/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    const registros = await fetchQuery<any>(`
      SELECT ts.*, t.NOME as talhao_nome 
      FROM talhao_safra ts 
      LEFT JOIN talhoes t ON ts.talhao_id = t.id 
      WHERE ts.safra_id = ? 
      ORDER BY t.NOME
    `, [safra_id]);
    
    res.json({
      safra_id: safra_id,
      total_registros: registros.length,
      registros: registros
    });
  }));

  // GET /debug/carregamentos/:safra_id - Consultar carregamentos de uma safra
  app.get('/debug/carregamentos/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    const carregamentos = await fetchQuery<any>(`
      SELECT c.*, t.NOME as talhao_nome 
      FROM carregamentos c 
      LEFT JOIN talhoes t ON c.talhao_id = t.id 
      WHERE c.safra_id = ? 
      ORDER BY c.data DESC
      LIMIT 50
    `, [safra_id]);
    
    res.json({
      safra_id: safra_id,
      total_registros: carregamentos.length,
      carregamentos: carregamentos
    });
  }));

  // GET /debug/query - Executar query SQL personalizada (cuidado!)
  app.post('/debug/query', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { sql, params = [] } = req.body;
    
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'SQL query é obrigatória' });
      return;
    }
    
    // Apenas permitir SELECT queries por segurança
    if (!sql.trim().toLowerCase().startsWith('select')) {
      res.status(403).json({ error: 'Apenas queries SELECT são permitidas' });
      return;
    }
    
    try {
      const resultado = await fetchQuery<any>(sql, params);
      res.json({
        sql: sql,
        total_registros: resultado.length,
        resultado: resultado
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro na query', 
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }));
  
  // GET /talhoes-completos/:safra_id - Buscar talhões com dados da safra combinados
  app.get('/talhoes-completos/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    
    const query = `
      SELECT 
        t.id,
        t.TalhaoID,
        t.TIPO,
        t.NOME,
        t.AREA as area_fisica,
        t.VARIEDADE as variedade_original,
        t.PORTAENXERTO as portaenxerto_original,
        t.DATA_DE_PLANTIO as data_plantio_original,
        t.IDADE as idade_original,
        t.FALHAS as falhas_original,
        t.ESP as esp_original,
        t.COR,
        t.qtde_plantas as qtde_plantas_original,
        t.coordinates,
        t.OBS as obs_original,
        t.ativo as talhao_ativo,
        
        -- Dados específicos da safra
        ts.id as talhao_safra_id,
        ts.area as area_safra,
        ts.variedade,
        ts.qtde_plantas,
        ts.porta_enxerto,
        ts.data_de_plantio,
        ts.idade,
        ts.falhas,
        ts.esp,
        ts.obs,
        ts.ativo as safra_ativo
        
      FROM talhoes t
      LEFT JOIN talhao_safra ts ON t.id = ts.talhao_id AND ts.safra_id = ?
      WHERE t.ativo = 1
      ORDER BY t.NOME
    `;
    
    const talhoes = await fetchQuery<any>(query, [safra_id]);
    res.json(talhoes);
  }));

  // POST /safras/:safra_id/clonar-de/:safra_origem_id - Clonar dados de uma safra para outra
  app.post('/safras/:safra_id/clonar-de/:safra_origem_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id, safra_origem_id } = req.params;
    const { incrementar_idade } = req.body;
    
    // Verificar se as safras existem
    const safraDestino = await fetchQuery<any>('SELECT id FROM safras WHERE id = ?', [safra_id]);
    const safraOrigem = await fetchQuery<any>('SELECT id FROM safras WHERE id = ?', [safra_origem_id]);
    
    if (!safraDestino.length || !safraOrigem.length) {
      res.status(404).json({ error: 'Safra não encontrada' });
      return;
    }
    
    // Buscar dados da safra origem
    const dadosOrigem = await fetchQuery<any>(`
      SELECT * FROM talhao_safra WHERE safra_id = ? AND ativo = 1
    `, [safra_origem_id]);
    
    let copiados = 0;
    
    for (const dadoOrigem of dadosOrigem) {
      // Verificar se já existe registro para este talhão na safra destino
      const jaExiste = await fetchQuery<any>(`
        SELECT id FROM talhao_safra WHERE talhao_id = ? AND safra_id = ?
      `, [dadoOrigem.talhao_id, safra_id]);
      
      if (jaExiste.length === 0) {
        const novoId = generateId();
        const novaIdade = incrementar_idade && dadoOrigem.idade 
          ? dadoOrigem.idade + 1 
          : dadoOrigem.idade;
        
        await runQuery(`
          INSERT INTO talhao_safra (
            id, talhao_id, safra_id, area, variedade, qtde_plantas, 
            porta_enxerto, data_de_plantio, idade, falhas, esp, obs, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          novoId,
          dadoOrigem.talhao_id,
          safra_id,
          dadoOrigem.area,
          dadoOrigem.variedade,
          dadoOrigem.qtde_plantas,
          dadoOrigem.porta_enxerto,
          dadoOrigem.data_de_plantio,
          novaIdade,
          0, // Reset falhas para nova safra
          dadoOrigem.esp,
          dadoOrigem.obs,
          1
        ]);
        
        copiados++;
      }
    }
    
    res.json({ 
      message: `Dados de ${copiados} talhões copiados com sucesso`,
      safra_destino: safra_id,
      safra_origem: safra_origem_id,
      talhoes_copiados: copiados
    });
  }));

  // PUT /talhao-safra/:id - Atualizar dados específicos de um talhão em uma safra
  app.put('/talhao-safra/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const {
      area,
      variedade,
      qtde_plantas,
      porta_enxerto,
      data_de_plantio,
      idade,
      falhas,
      esp,
      obs,
      ativo
    } = req.body;
    
    // Verificar se o registro existe
    const talhaoSafra = await fetchQuery<any>('SELECT * FROM talhao_safra WHERE id = ?', [id]);
    if (!talhaoSafra.length) {
      res.status(404).json({ error: 'Registro de talhão-safra não encontrado' });
      return;
    }
    
    const atual = talhaoSafra[0];
    
    await runQuery(`
      UPDATE talhao_safra 
      SET area = ?, variedade = ?, qtde_plantas = ?, porta_enxerto = ?, 
          data_de_plantio = ?, idade = ?, falhas = ?, esp = ?, obs = ?, ativo = ?
      WHERE id = ?
    `, [
      area !== undefined ? area : atual.area,
      variedade !== undefined ? variedade : atual.variedade,
      qtde_plantas !== undefined ? qtde_plantas : atual.qtde_plantas,
      porta_enxerto !== undefined ? porta_enxerto : atual.porta_enxerto,
      data_de_plantio !== undefined ? data_de_plantio : atual.data_de_plantio,
      idade !== undefined ? idade : atual.idade,
      falhas !== undefined ? falhas : atual.falhas,
      esp !== undefined ? esp : atual.esp,
      obs !== undefined ? obs : atual.obs,
      ativo !== undefined ? ativo : atual.ativo,
      id
    ]);
    
    res.json({ message: 'Dados do talhão atualizados com sucesso na safra' });
  }));

  // POST /talhoes/:talhao_id/safras/:safra_id - Criar registro para talhão em safra específica
  app.post('/talhoes/:talhao_id/safras/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { talhao_id, safra_id } = req.params;
    const {
      area,
      variedade,
      qtde_plantas,
      porta_enxerto,
      data_de_plantio,
      idade,
      falhas,
      esp,
      obs
    } = req.body;
    
    // Verificar se talhão existe
    const talhao = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ? AND ativo = 1', [talhao_id]);
    if (!talhao.length) {
      res.status(404).json({ error: 'Talhão não encontrado' });
      return;
    }
    
    // Verificar se safra existe
    const safra = await fetchQuery<any>('SELECT * FROM safras WHERE id = ?', [safra_id]);
    if (!safra.length) {
      res.status(404).json({ error: 'Safra não encontrada' });
      return;
    }
    
    // Verificar se já existe registro
    const jaExiste = await fetchQuery<any>(`
      SELECT id FROM talhao_safra WHERE talhao_id = ? AND safra_id = ?
    `, [talhao_id, safra_id]);
    
    if (jaExiste.length > 0) {
      res.status(409).json({ error: 'Já existe registro para este talhão nesta safra' });
      return;
    }
    
    const novoId = generateId();
    
    await runQuery(`
      INSERT INTO talhao_safra (
        id, talhao_id, safra_id, area, variedade, qtde_plantas, 
        porta_enxerto, data_de_plantio, idade, falhas, esp, obs, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      novoId,
      talhao_id,
      safra_id,
      area || talhao[0].AREA,
      variedade || talhao[0].VARIEDADE,
      qtde_plantas || talhao[0].qtde_plantas,
      porta_enxerto || talhao[0].PORTAENXERTO,
      data_de_plantio || talhao[0].DATA_DE_PLANTIO,
      idade || talhao[0].IDADE,
      falhas || 0,
      esp || talhao[0].ESP,
      obs || talhao[0].OBS,
      1
    ]);
    
    res.status(201).json({ 
      message: 'Talhão adicionado à safra com sucesso',
      id: novoId 
    });
  }));

  // GET /talhoes/:talhao_id/historico-safras - Ver histórico de um talhão em todas as safras
  app.get('/talhoes/:talhao_id/historico-safras', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { talhao_id } = req.params;
    
    const historico = await fetchQuery<any>(`
      SELECT 
        s.nome as safra_nome,
        s.data_inicial_colheita,
        ts.*
      FROM talhao_safra ts
      JOIN safras s ON ts.safra_id = s.id
      WHERE ts.talhao_id = ?
      ORDER BY s.data_inicial_colheita DESC
    `, [talhao_id]);
    
    res.json(historico);
  }));

  // PUT /talhoes-safra/lote - Atualizar múltiplos registros de talhão-safra
  app.put('/talhoes-safra/lote', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id, atualizacoes } = req.body;
    
    if (!Array.isArray(atualizacoes)) {
      res.status(400).json({ error: 'Atualizações devem ser um array' });
      return;
    }
    
    let atualizados = 0;
    
    for (const atualizacao of atualizacoes) {
      const { talhao_id, dados } = atualizacao;
      
      // Verificar se existe registro
      const existe = await fetchQuery<any>(`
        SELECT id FROM talhao_safra WHERE talhao_id = ? AND safra_id = ?
      `, [talhao_id, safra_id]);
      
      if (existe.length > 0) {
        const campos = Object.keys(dados);
        const valores = Object.values(dados);
        
        if (campos.length > 0) {
          const setClauses = campos.map(campo => `${campo} = ?`).join(', ');
          
          await runQuery(`
            UPDATE talhao_safra SET ${setClauses} WHERE talhao_id = ? AND safra_id = ?
          `, [...valores, talhao_id, safra_id]);
          
          atualizados++;
        }
      }
    }
    
    res.json({ 
      message: `${atualizados} registros atualizados com sucesso`,
      atualizados 
    });
  }));

  // GET /safras/:safra_id/estatisticas - Estatísticas da safra
  app.get('/safras/:safra_id/estatisticas', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    
    // Total de talhões na safra
    const totalTalhoes = await fetchQuery<any>(`
      SELECT COUNT(*) as total FROM talhao_safra WHERE safra_id = ? AND ativo = 1
    `, [safra_id]);
    
    // Total por variedade
    const porVariedade = await fetchQuery<any>(`
      SELECT variedade, COUNT(*) as quantidade, SUM(qtde_plantas) as total_plantas
      FROM talhao_safra 
      WHERE safra_id = ? AND ativo = 1 AND variedade IS NOT NULL
      GROUP BY variedade
      ORDER BY quantidade DESC
    `, [safra_id]);
    
    // Total de plantas
    const totalPlantas = await fetchQuery<any>(`
      SELECT SUM(qtde_plantas) as total FROM talhao_safra WHERE safra_id = ? AND ativo = 1
    `, [safra_id]);
    
    // Carregamentos da safra
    const carregamentos = await fetchQuery<any>(`
      SELECT COUNT(*) as total, SUM(qte_caixa) as total_caixas
      FROM carregamentos WHERE safra_id = ?
    `, [safra_id]);
    
    res.json({
      total_talhoes: totalTalhoes[0]?.total || 0,
      total_plantas: totalPlantas[0]?.total || 0,
      por_variedade: porVariedade,
      carregamentos: {
        total_registros: carregamentos[0]?.total || 0,
        total_caixas: carregamentos[0]?.total_caixas || 0
      }
    });
  }));

  // GET /comparar-safras/:safra1_id/:safra2_id - Comparar duas safras
  app.get('/comparar-safras/:safra1_id/:safra2_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra1_id, safra2_id } = req.params;
    
    const query = `
      SELECT 
        t.NOME as talhao_nome,
        s1.variedade as variedade_safra1,
        s1.qtde_plantas as plantas_safra1,
        s1.idade as idade_safra1,
        s1.falhas as falhas_safra1,
        s2.variedade as variedade_safra2,
        s2.qtde_plantas as plantas_safra2,
        s2.idade as idade_safra2,
        s2.falhas as falhas_safra2
      FROM talhoes t
      LEFT JOIN talhao_safra s1 ON t.id = s1.talhao_id AND s1.safra_id = ?
      LEFT JOIN talhao_safra s2 ON t.id = s2.talhao_id AND s2.safra_id = ?
      WHERE (s1.id IS NOT NULL OR s2.id IS NOT NULL)
      ORDER BY t.NOME
    `;
    
    const comparacao = await fetchQuery<any>(query, [safra1_id, safra2_id]);
    res.json(comparacao);
  }));

  // GET /talhoes-safra/:safra_id - Talhões combinados (base + safra específica) para cálculos
  app.get('/talhoes-safra/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    
    // Query para combinar dados da tabela talhoes com talhao_safra e safras
    const query = `
      SELECT 
        t.*,
        ts.id as talhao_safra_id,
        ts.area as area_safra,
        ts.variedade as variedade_safra,
        ts.qtde_plantas as qtde_plantas_safra,
        ts.porta_enxerto as porta_enxerto_safra,
        ts.data_de_plantio as data_de_plantio_safra,
        ts.idade as idade_safra,
        ts.falhas as falhas_safra,
        ts.esp as esp_safra,
        ts.obs as obs_safra,
        ts.ativo as ativo_safra,
        s.nome as safra_nome,
        s.nome as ano_safra
      FROM talhoes t
      LEFT JOIN talhao_safra ts ON t.id = ts.talhao_id AND ts.safra_id = ?
      LEFT JOIN safras s ON ts.safra_id = s.id
      WHERE ts.safra_id = ?
      ORDER BY t.NOME
    `;
    
    const talhoesCombinados = await fetchQuery<any>(query, [safra_id, safra_id]);
    
    res.json({
      safra_id: safra_id,
      total_talhoes: talhoesCombinados.length,
      talhoes_com_dados_safra: talhoesCombinados.filter(t => t.talhao_safra_id).length,
      talhoes_apenas_base: talhoesCombinados.filter(t => !t.talhao_safra_id).length,
      talhoes: talhoesCombinados
    });
  }));

  // GET /talhoes-todas-safras - Todos os talhões com suas respectivas safras
  app.get('/talhoes-todas-safras', asyncHandler(async (req: express.Request, res: express.Response) => {
    const query = `
      SELECT 
        t.id,
        t.TalhaoID,
        t.NOME,
        t.TIPO,
        t.AREA as area_fisica,
        t.VARIEDADE as variedade_original,
        t.PORTAENXERTO as porta_enxerto_original,
        t.DATA_DE_PLANTIO as data_plantio_original,
        t.IDADE as idade_original,
        t.FALHAS as falhas_original,
        t.ESP as esp_original,
        t.OBS as obs_original,
        t.ativo as talhao_ativo,
        ts.id as talhao_safra_id,
        ts.area as area_safra,
        ts.variedade as variedade_safra,
        ts.qtde_plantas as qtde_plantas_safra,
        ts.porta_enxerto as porta_enxerto_safra,
        ts.data_de_plantio as data_de_plantio_safra,
        ts.idade as idade_safra,
        ts.falhas as falhas_safra,
        ts.esp as esp_safra,
        ts.obs as obs_safra,
        ts.ativo as ativo_safra,
        s.nome as safra_nome,
        s.nome as ano_safra,
        s.is_active as safra_ativa
      FROM talhoes t
      LEFT JOIN talhao_safra ts ON t.id = ts.talhao_id
      LEFT JOIN safras s ON ts.safra_id = s.id
      WHERE t.ativo = 1
      ORDER BY s.nome DESC, t.NOME
    `;
    
    const todosOsTalhoes = await fetchQuery<any>(query, []);
    
    res.json({
      total_registros: todosOsTalhoes.length,
      talhoes_com_safra: todosOsTalhoes.filter(t => t.talhao_safra_id).length,
      talhoes_sem_safra: todosOsTalhoes.filter(t => !t.talhao_safra_id).length,
      talhoes: todosOsTalhoes
    });
  }));

  // POST /inicializar-safra - Copia todos os talhões ativos para uma nova safra
  app.post('/inicializar-safra', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id, nome_safra } = req.body;
    
    if (!safra_id) {
      return res.status(400).json({ error: 'safra_id é obrigatório' });
    }
    
    try {
      // Buscar todos os talhões ativos
      const talhoesAtivos = await fetchQuery<any>(`
        SELECT * FROM talhoes WHERE ativo = 1
      `, []);
      
      if (talhoesAtivos.length === 0) {
        return res.json({
          message: 'Nenhum talhão ativo encontrado',
          safra_id: safra_id,
          talhoes_copiados: 0
        });
      }
      
      // Verificar se já existem registros para esta safra
      const registrosExistentes = await fetchQuery<any>(`
        SELECT COUNT(*) as total FROM talhao_safra WHERE safra_id = ?
      `, [safra_id]);
      
      if (registrosExistentes[0].total > 0) {
        return res.status(400).json({
          error: `Safra ${nome_safra || safra_id} já possui ${registrosExistentes[0].total} talhões inicializados`
        });
      }
      
      // Copiar cada talhão ativo para talhao_safra
      let talhoesCopiados = 0;
      for (const talhao of talhoesAtivos) {
        const novoId = generateId();
        await runQuery(`
          INSERT INTO talhao_safra (
            id, talhao_id, safra_id, area, variedade, qtde_plantas,
            porta_enxerto, data_de_plantio, idade, falhas, esp, obs, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          novoId,
          talhao.id,
          safra_id,
          talhao.AREA,
          talhao.VARIEDADE,
          talhao.qtde_plantas,
          talhao.PORTAENXERTO,
          talhao.DATA_DE_PLANTIO,
          talhao.IDADE,
          talhao.FALHAS,
          talhao.ESP,
          talhao.OBS,
          1 // ativo = true
        ]);
        talhoesCopiados++;
      }
      
      res.json({
        message: `Safra inicializada com sucesso!`,
        safra_id: safra_id,
        nome_safra: nome_safra,
        talhoes_ativos_encontrados: talhoesAtivos.length,
        talhoes_copiados: talhoesCopiados
      });
      
    } catch (error) {
      console.error('Erro ao inicializar safra:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }));

  // GET /talhoes-apenas-safra/:safra_id - Buscar APENAS os talhões desta safra específica
  app.get('/talhoes-apenas-safra/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    
    const query = `
      SELECT 
        t.id as talhao_base_id,
        t.TalhaoID,
        t.NOME,
        t.TIPO,
        t.COR,
        t.ativo as talhao_base_ativo,
        t.talhao_kml_id,
        ts.id as talhao_safra_id,
        ts.area,
        ts.variedade,
        ts.qtde_plantas,
        ts.porta_enxerto,
        ts.data_de_plantio,
        ts.idade,
        ts.falhas,
        ts.esp,
        ts.obs,
        ts.ativo as ativo_na_safra,
        s.nome as safra_nome,
        s.nome as ano_safra,
        tkml.coordinates
      FROM talhao_safra ts
      INNER JOIN talhoes t ON ts.talhao_id = t.id
      INNER JOIN safras s ON ts.safra_id = s.id
      LEFT JOIN talhoes_kml tkml ON t.talhao_kml_id = tkml.id
      WHERE ts.safra_id = ?
      ORDER BY t.NOME
    `;
    
    const talhoesDaSafra = await fetchQuery<any>(query, [safra_id]);
    
    // Separar talhões com e sem coordenadas para estatísticas
    const comCoordenadas = talhoesDaSafra.filter(t => t.coordinates && t.coordinates.trim());
    const semCoordenadas = talhoesDaSafra.filter(t => !t.coordinates || !t.coordinates.trim());
    
    console.log(`[Safra ${safra_id}] Total: ${talhoesDaSafra.length}, Com coordenadas: ${comCoordenadas.length}, Sem coordenadas: ${semCoordenadas.length}`);
    
    res.json({
      safra_id: safra_id,
      total_talhoes: talhoesDaSafra.length,
      talhoes_com_coordenadas: comCoordenadas.length,
      talhoes_sem_coordenadas: semCoordenadas.length,
      safra_nome: talhoesDaSafra[0]?.safra_nome || null,
      talhoes: talhoesDaSafra
    });
  }));

  // GET /talhoes-mapa-safra/:safra_id - Buscar APENAS talhões com coordenadas para o mapa
  app.get('/talhoes-mapa-safra/:safra_id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { safra_id } = req.params;
    
    const query = `
      SELECT 
        t.id as talhao_base_id,
        t.TalhaoID,
        t.NOME,
        t.TIPO,
        t.COR,
        t.ativo as talhao_base_ativo,
        t.talhao_kml_id,
        ts.id as talhao_safra_id,
        ts.area,
        ts.variedade,
        ts.qtde_plantas,
        ts.porta_enxerto,
        ts.data_de_plantio,
        ts.idade,
        ts.falhas,
        ts.esp,
        ts.obs,
        ts.ativo as ativo_na_safra,
        s.nome as safra_nome,
        s.nome as ano_safra,
        tkml.coordinates
      FROM talhao_safra ts
      INNER JOIN talhoes t ON ts.talhao_id = t.id
      INNER JOIN safras s ON ts.safra_id = s.id
      LEFT JOIN talhoes_kml tkml ON t.talhao_kml_id = tkml.id
      WHERE ts.safra_id = ? 
        AND ts.ativo = 1 
        AND tkml.coordinates IS NOT NULL 
        AND tkml.coordinates != ''
        AND LENGTH(tkml.coordinates) > 10
      ORDER BY t.NOME
    `;
    
    const talhoesComCoordenadas = await fetchQuery<any>(query, [safra_id]);
    
    console.log(`[Mapa Safra ${safra_id}] Retornando ${talhoesComCoordenadas.length} talhões com coordenadas`);
    
    // Se não encontrou talhões com coordenadas, vamos debugar
    if (talhoesComCoordenadas.length === 0) {
      const debug = await fetchQuery<any>(`
        SELECT 
          COUNT(*) as total_safra,
          COUNT(t.talhao_kml_id) as com_kml_id,
          COUNT(tkml.coordinates) as com_coordenadas
        FROM talhao_safra ts
        INNER JOIN talhoes t ON ts.talhao_id = t.id
        LEFT JOIN talhoes_kml tkml ON t.talhao_kml_id = tkml.id
        WHERE ts.safra_id = ? AND ts.ativo = 1
      `, [safra_id]);
      
      console.log(`[DEBUG Safra ${safra_id}] Total: ${debug[0].total_safra}, Com KML ID: ${debug[0].com_kml_id}, Com coordenadas: ${debug[0].com_coordenadas}`);
    }
    
    res.json({
      safra_id: safra_id,
      total_talhoes_mapa: talhoesComCoordenadas.length,
      safra_nome: talhoesComCoordenadas[0]?.safra_nome || null,
      talhoes: talhoesComCoordenadas
    });
  }));

  // PUT /talhao-safra/:id - Atualizar dados específicos da safra
  app.put('/talhao-safra/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params; // ID do registro na talhao_safra
    const {
      area,
      variedade,
      qtde_plantas,
      porta_enxerto,
      data_de_plantio,
      idade,
      falhas,
      esp,
      obs,
      ativo
    } = req.body;

    // Verificar se o registro existe
    const registroExistente = await fetchQuery<any>('SELECT * FROM talhao_safra WHERE id = ?', [id]);
    if (!registroExistente || registroExistente.length === 0) {
      return res.status(404).json({ error: 'Registro de talhao_safra não encontrado' });
    }

    const registro = registroExistente[0];

    // Atualizar apenas os campos fornecidos
    const sql = `
      UPDATE talhao_safra 
      SET area = ?, variedade = ?, qtde_plantas = ?, porta_enxerto = ?, 
          data_de_plantio = ?, idade = ?, falhas = ?, esp = ?, obs = ?, ativo = ?
      WHERE id = ?
    `;
    
    await runQuery(sql, [
      area !== undefined ? area : registro.area,
      variedade !== undefined ? variedade : registro.variedade,
      qtde_plantas !== undefined ? qtde_plantas : registro.qtde_plantas,
      porta_enxerto !== undefined ? porta_enxerto : registro.porta_enxerto,
      data_de_plantio !== undefined ? data_de_plantio : registro.data_de_plantio,
      idade !== undefined ? idade : registro.idade,
      falhas !== undefined ? falhas : registro.falhas,
      esp !== undefined ? esp : registro.esp,
      obs !== undefined ? obs : registro.obs,
      ativo !== undefined ? (ativo ? 1 : 0) : registro.ativo,
      id
    ]);

    console.log(`Talhao_safra atualizado: ${id}, safra: ${registro.safra_id}`);
    res.status(200).json({ message: 'Dados da safra atualizados com sucesso' });
  }));

  // PUT /talhao-base/:id - Atualizar dados base do talhão (wrapper para compatibilidade)
  app.put('/talhao-base/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
    // Redirecionar para o endpoint original de talhões base
    const { id } = req.params;
    
    // Fazer a requisição para o endpoint existente
    const response = await fetch(`http://localhost:3000/talhoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (response.ok) {
      res.status(200).json({ message: 'Talhão base atualizado com sucesso' });
    } else {
      const error = await response.json();
      res.status(response.status).json(error);
    }
  }));
};