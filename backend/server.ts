import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import { parseKML } from './kmlParser';
import { initializeDatabase, generateId, runQuery, fetchQuery } from './db';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const app = express();
const PORT = 3000;

// Configurar o multer para salvar arquivos no diretório 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Enable CORS for requests from the frontend origin
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware para parsing de JSON
app.use(express.json());

// Utility function to handle async route handlers
const asyncHandler = (
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error handling request for ${req.method} ${req.url}:`, errorMessage);
    res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  });
};

// Função para calcular a semana do ano (ISO 8601)
const getWeekOfYear = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Ajustar para o primeiro dia da semana (segunda-feira)
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
};

// Função para calcular a diferença em semanas entre duas datas
const getWeeksDifference = (startDate: number, endDate: number): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7) + 1; // +1 para contar a semana inicial como 1
  return diffWeeks;
};

// Função para obter todas as semanas entre duas datas (em semanas do ano)
const getWeeksBetween = (startDate: number, endDate: number): { weekOfYear: number, year: number }[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks: { weekOfYear: number, year: number }[] = [];

  // Começar da data inicial e avançar semana por semana até a data final
  let currentDate = new Date(start);
  while (currentDate <= end) {
    const weekOfYear = getWeekOfYear(currentDate);
    const year = currentDate.getFullYear();
    weeks.push({ weekOfYear, year });
    currentDate.setDate(currentDate.getDate() + 7); // Avançar uma semana
  }

  return weeks;
};

// Endpoint para upload de KML
app.post(
  '/kml/upload',
  upload.single('kmlFile'),
  asyncHandler(async (req, res, next) => {
    console.log('Received KML upload request');

    // Verificar se o arquivo foi enviado
    if (!req.file) {
      console.log('No file uploaded');
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    console.log('File received:', {
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    // Ler o conteúdo do arquivo KML
    const filePath = req.file.path;
    const kmlContent = await fs.readFile(filePath, 'utf-8');
    console.log('KML file read successfully, length:', kmlContent.length);

    // Parsear o arquivo KML
    let geojson: FeatureCollection;
    try {
      geojson = parseKML(kmlContent);
      console.log('KML parsed successfully:', geojson);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during KML parsing';
      console.error('Failed to parse KML:', errorMessage);
      res.status(400).json({ error: 'Failed to parse KML file', details: errorMessage });
      return;
    }

    // Validar o GeoJSON resultante
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.log('No features found in KML');
      res.status(400).json({ error: 'No features found in KML file' });
      return;
    }

    // Salvar o KML no banco de dados
    const kmlId = generateId();
    const kmlSql = `
      INSERT INTO kml_files (id, name, content)
      VALUES (?, ?, ?)
    `;
    await runQuery(kmlSql, [kmlId, req.file.originalname, kmlContent]);
    console.log('KML saved to database:', kmlId);

    // Processar os polígonos e salvar os talhões
    const existingTalhaoIds = new Set<string>();
    const talhaoSql = `
      INSERT INTO talhoes (id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, DATA_DE_PLANTIO, IDADE, PRODUCAO_CAIXA, PRODUCAO_HECTARE, COR, qtde_plantas, coordinates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const talhaoId = feature.properties?.name || feature.properties?.Name;
        if (talhaoId && !existingTalhaoIds.has(talhaoId)) {
          console.log(`Processing talhao: ${talhaoId}`);
          const geometry = feature.geometry as Polygon | MultiPolygon;
          const coordinates = JSON.stringify(geometry.coordinates);
          const talhao = {
            TalhaoID: talhaoId,
            TIPO: 'Talhao',
            NOME: talhaoId,
            AREA: '0 ha',
            VARIEDADE: '',
            PORTAENXERTO: '',
            DATA_DE_PLANTIO: '',
            IDADE: 0,
            PRODUCAO_CAIXA: 0,
            PRODUCAO_HECTARE: 0,
            COR: '#00FF00',
            qtde_plantas: 0,
            coordinates,
          };
          const talhaoIdGenerated = generateId();
          await runQuery(talhaoSql, [
            talhaoIdGenerated,
            talhao.TalhaoID,
            talhao.TIPO,
            talhao.NOME,
            talhao.AREA,
            talhao.VARIEDADE,
            talhao.PORTAENXERTO,
            talhao.DATA_DE_PLANTIO,
            talhao.IDADE,
            talhao.PRODUCAO_CAIXA,
            talhao.PRODUCAO_HECTARE,
            talhao.COR,
            talhao.qtde_plantas || 0,
            talhao.coordinates,
          ]);
          console.log(`Talhão criado: ${talhaoId}`);
          existingTalhaoIds.add(talhaoId);
        } else {
          console.log(`Talhão ignorado: ${talhaoId} (já existe ou nome não encontrado)`);
        }
      } else {
        console.log(`Feature ignorada: geometria não é Polygon ou MultiPolygon (${feature.geometry.type})`);
      }
    }

    // Remover o arquivo temporário após o processamento
    await fs.unlink(filePath);
    console.log('Temporary file deleted:', filePath);

    res.status(200).json({ message: 'KML uploaded and processed successfully', kmlId });
  })
);

// Endpoint para listar safras
app.get(
  '/safras',
  asyncHandler(async (req, res, next) => {
    const safras = await fetchQuery<any>('SELECT * FROM safras', []);
    res.status(200).json(safras);
  })
);

// Endpoint para criar uma safra
app.post(
  '/safras',
  asyncHandler(async (req, res, next) => {
    const { nome, is_active, data_inicial_colheita } = req.body;
    if (!nome || typeof is_active !== 'boolean') {
      res.status(400).json({ error: 'Missing required fields: nome and is_active are required' });
      return;
    }

    const safraId = generateId();
    const sql = `
      INSERT INTO safras (id, nome, is_active, data_inicial_colheita)
      VALUES (?, ?, ?, ?)
    `;
    await runQuery(sql, [safraId, nome, is_active, data_inicial_colheita || null]);
    console.log(`Safra criada: ${safraId}`);
    res.status(201).json({ message: 'Safra created successfully', id: safraId });
  })
);

// Endpoint para atualizar uma safra
app.put(
  '/safras/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { nome, is_active, data_inicial_colheita } = req.body;
    if (!nome || typeof is_active !== 'boolean') {
      res.status(400).json({ error: 'Missing required fields: nome and is_active are required' });
      return;
    }

    const sql = `
      UPDATE safras
      SET nome = ?, is_active = ?, data_inicial_colheita = ?
      WHERE id = ?
    `;
    await runQuery(sql, [nome, is_active, data_inicial_colheita || null, id]);
    console.log(`Safra atualizada: ${id}`);
    res.status(200).json({ message: 'Safra updated successfully' });
  })
);

// Endpoint para deletar uma safra
app.delete(
  '/safras/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    console.log(`Deleting safra with ID: ${id}`);
    const sql = 'DELETE FROM safras WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'Safra deleted successfully' });
  })
);

// Endpoint para consultar o histórico de semanas de colheita de uma safra
app.get(
  '/safras/:id/semanas',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Buscar a safra para confirmar que existe
    const safra = await fetchQuery<any>('SELECT * FROM safras WHERE id = ?', [id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    // Buscar o histórico de semanas de colheita
    const semanas = await fetchQuery<any>('SELECT semana_ano, semana_colheita FROM semanas_colheita WHERE safra_id = ? ORDER BY semana_ano', [id]);
    res.status(200).json(semanas);
  })
);

// Outros endpoints (exemplo, para listar KMLs)
app.get(
  '/kml_files',
  asyncHandler(async (req, res, next) => {
    const kmls = await fetchQuery<any>('SELECT * FROM kml_files', []);
    res.status(200).json(kmls);
  })
);

// Outros endpoints (exemplo, para listar talhões)
app.get(
  '/talhoes',
  asyncHandler(async (req, res, next) => {
    const talhoes = await fetchQuery<any>('SELECT * FROM talhoes', []);
    res.status(200).json(talhoes);
  })
);

// Endpoint para buscar as coordenadas de um talhao a partir do KML
app.get(
  '/talhoes/:id/coordinates',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Buscar o talhao pelo ID para obter o TalhaoID ou NOME
    const talhao = await fetchQuery<any>('SELECT TalhaoID, NOME FROM talhoes WHERE id = ?', [id]);
    if (!talhao || talhao.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { TalhaoID, NOME } = talhao[0];
    const identifier = TalhaoID || NOME;
    if (!identifier) {
      res.status(400).json({ error: 'Talhao does not have a valid TalhaoID or NOME to match with KML' });
      return;
    }

    // Buscar o arquivo KML mais recente (assumindo que o último é o mais relevante)
    const kmlFiles = await fetchQuery<any>('SELECT content FROM kml_files ORDER BY ROWID DESC LIMIT 1', []);
    if (!kmlFiles || kmlFiles.length === 0) {
      res.status(404).json({ error: 'No KML files found in the database' });
      return;
    }

    const kmlContent = kmlFiles[0].content;

    // Parsear o KML para obter as features
    let geojson: FeatureCollection;
    try {
      geojson = parseKML(kmlContent);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during KML parsing';
      console.error('Failed to parse KML:', errorMessage);
      res.status(400).json({ error: 'Failed to parse KML file', details: errorMessage });
      return;
    }

    // Procurar a feature correspondente ao talhao
    const feature = geojson.features.find((f) => {
      const featureName = f.properties?.name || f.properties?.Name;
      return featureName === identifier && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    });

    if (!feature) {
      res.status(404).json({ error: `No matching feature found in KML for TalhaoID/NOME: ${identifier}` });
      return;
    }

    // Garantir que geometry é Polygon ou MultiPolygon e acessar coordinates
    const geometry = feature.geometry as Polygon | MultiPolygon;
    if (!geometry.coordinates) {
      res.status(500).json({ error: 'Unexpected geometry type: coordinates not found' });
      return;
    }

    const coordinates = geometry.coordinates;
    res.status(200).json({ coordinates });
  })
);

// Endpoint para atualizar apenas as coordenadas de um talhao
app.put(
  '/talhoes/:id/coordinates',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { coordinates } = req.body;

    // Validação: coordinates é obrigatório
    if (!coordinates) {
      res.status(400).json({ error: 'Missing required field: coordinates is required' });
      return;
    }

    // Buscar o talhao atual para confirmar que existe
    const talhaoAtual = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhaoAtual || talhaoAtual.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    // Atualizar apenas o campo coordinates
    const sql = `
      UPDATE talhoes
      SET coordinates = ?
      WHERE id = ?
    `;
    await runQuery(sql, [JSON.stringify(coordinates), id]);
    console.log(`Coordenadas do talhão ${id} atualizadas:`, coordinates);
    res.status(200).json({ message: 'Coordenadas do talhão atualizadas com sucesso' });
  })
);

// Endpoint para criar um talhao
app.post(
  '/talhoes',
  asyncHandler(async (req, res, next) => {
    const {
      TalhaoID,
      TIPO,
      NOME,
      AREA,
      VARIEDADE,
      PORTAENXERTO,
      DATA_DE_PLANTIO,
      IDADE,
      PRODUCAO_CAIXA,
      PRODUCAO_HECTARE,
      COR,
      qtde_plantas,
      coordinates,
    } = req.body;

    // Validação básica: apenas NOME é obrigatório
    if (!NOME) {
      res.status(400).json({ error: 'Missing required field: NOME is required' });
      return;
    }

    const talhaoId = generateId();
    const sql = `
      INSERT INTO talhoes (id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, DATA_DE_PLANTIO, IDADE, PRODUCAO_CAIXA, PRODUCAO_HECTARE, COR, qtde_plantas, coordinates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(sql, [
      talhaoId,
      TalhaoID || null,
      TIPO || null,
      NOME,
      AREA || null,
      VARIEDADE || null,
      PORTAENXERTO || null,
      DATA_DE_PLANTIO || null,
      IDADE || null,
      PRODUCAO_CAIXA || null,
      PRODUCAO_HECTARE || null,
      COR || null,
      qtde_plantas || null,
      coordinates ? JSON.stringify(coordinates) : null,
    ]);
    console.log(`Talhao criado: ${talhaoId}`);
    res.status(201).json({ message: 'Talhao created successfully', id: talhaoId });
  })
);

// Endpoint para atualizar um talhao (sem atualizar coordinates)
app.put(
  '/talhoes/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const {
      TalhaoID,
      TIPO,
      NOME,
      AREA,
      VARIEDADE,
      PORTAENXERTO,
      DATA_DE_PLANTIO,
      IDADE,
      PRODUCAO_CAIXA,
      PRODUCAO_HECTARE,
      COR,
      qtde_plantas,
    } = req.body;

    // Validação básica: apenas NOME é obrigatório
    if (!NOME) {
      res.status(400).json({ error: 'Missing required field: NOME is required' });
      return;
    }

    // Buscar o talhao atual para preservar os valores existentes
    const talhaoAtual = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhaoAtual || talhaoAtual.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const talhaoExistente = talhaoAtual[0];

    // Atualizar os campos fornecidos, preservando os existentes e NÃO atualizando coordinates
    const sql = `
      UPDATE talhoes
      SET TalhaoID = ?, TIPO = ?, NOME = ?, AREA = ?, VARIEDADE = ?, PORTAENXERTO = ?, DATA_DE_PLANTIO = ?, IDADE = ?, PRODUCAO_CAIXA = ?, PRODUCAO_HECTARE = ?, COR = ?, qtde_plantas = ?
      WHERE id = ?
    `;
    await runQuery(sql, [
      TalhaoID !== undefined ? TalhaoID : talhaoExistente.TalhaoID,
      TIPO !== undefined ? TIPO : talhaoExistente.TIPO,
      NOME,
      AREA !== undefined ? AREA : talhaoExistente.AREA,
      VARIEDADE !== undefined ? VARIEDADE : talhaoExistente.VARIEDADE,
      PORTAENXERTO !== undefined ? PORTAENXERTO : talhaoExistente.PORTAENXERTO,
      DATA_DE_PLANTIO !== undefined ? DATA_DE_PLANTIO : talhaoExistente.DATA_DE_PLANTIO,
      IDADE !== undefined ? IDADE : talhaoExistente.IDADE,
      PRODUCAO_CAIXA !== undefined ? PRODUCAO_CAIXA : talhaoExistente.PRODUCAO_CAIXA,
      PRODUCAO_HECTARE !== undefined ? PRODUCAO_HECTARE : talhaoExistente.PRODUCAO_HECTARE,
      COR !== undefined ? COR : talhaoExistente.COR,
      qtde_plantas !== undefined ? qtde_plantas : talhaoExistente.qtde_plantas,
      id,
    ]);
    console.log(`Talhao atualizado: ${id}`);
    res.status(200).json({ message: 'Talhao updated successfully' });
  })
);

// Endpoint para deletar um talhao
app.delete(
  '/talhoes/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    console.log(`Deleting talhao with ID: ${id}`);
    const sql = 'DELETE FROM talhoes WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'Talhao deleted successfully' });
  })
);

// Endpoint para listar motoristas (para sugestões no frontend)
app.get(
  '/motoristas',
  asyncHandler(async (req, res, next) => {
    const { search } = req.query;
    let motoristas;
    if (search) {
      // Converter o termo de busca para letras maiúsculas
      const searchTerm = search.toString().toUpperCase();
      motoristas = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome LIKE ? ORDER BY nome', [`${searchTerm}%`]);
    } else {
      motoristas = await fetchQuery<any>('SELECT * FROM motoristas ORDER BY nome', []);
    }
    res.status(200).json(motoristas);
  })
);

// Endpoint para listar carregamentos
app.get(
  '/carregamentos',
  asyncHandler(async (req, res, next) => {
    const carregamentos = await fetchQuery<any>('SELECT * FROM carregamentos', []);
    res.status(200).json(carregamentos);
  })
);

// Endpoint para criar um carregamento
app.post(
  '/carregamentos',
  asyncHandler(async (req, res, next) => {
    const {
      data,
      talhao_id,
      motorista,
      placa,
      qte_caixa,
      safra_id,
    } = req.body;

    // Validação básica
    if (!data || !talhao_id || !safra_id || qte_caixa === undefined) {
      res.status(400).json({ error: 'Missing required fields: data, talhao_id, safra_id, and qte_caixa are required' });
      return;
    }

    console.log(`Recebido talhao_id: ${talhao_id}`);

    // Buscar o talhão para obter qtde_plantas e variedade
    const talhao = await fetchQuery<any>('SELECT id, NOME, qtde_plantas, VARIEDADE as variedade FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para talhao_id: ${talhao_id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { qtde_plantas, variedade, NOME } = talhao[0];
    console.log(`Talhão encontrado: ID=${talhao_id}, NOME=${NOME}, qtde_plantas=${qtde_plantas}, variedade=${variedade}`);

    // Buscar a safra para obter a data inicial da colheita
    const safra = await fetchQuery<any>('SELECT data_inicial_colheita FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const dataInicialColheita = safra[0].data_inicial_colheita;

    // Calcular a semana do ano do carregamento
    const carregamentoDate = new Date(data);
    const semanaAno = getWeekOfYear(carregamentoDate);
    console.log(`Semana do ano para ${carregamentoDate.toISOString()}: ${semanaAno}`);

    // Calcular a semana da colheita (se data_inicial_colheita estiver definida)
    let semanaColheita = null;
    if (dataInicialColheita) {
      semanaColheita = getWeeksDifference(dataInicialColheita, data);
      console.log(`Semana da colheita (início: ${new Date(dataInicialColheita).toISOString()}, carregamento: ${carregamentoDate.toISOString()}): ${semanaColheita}`);

      // Atualizar a tabela semanas_colheita com todas as semanas desde o início até o carregamento
      const weeksBetween = getWeeksBetween(dataInicialColheita, data);
      for (const week of weeksBetween) {
        const weekOfYear = week.weekOfYear;
        const weekYear = week.year;
        const referenceDate = new Date(weekYear, 0, (weekOfYear - 1) * 7 + 1); // Aproximação da data da semana
        const semanaColheitaForWeek = getWeeksDifference(dataInicialColheita, referenceDate.getTime());

        // Verificar se a semana já existe na tabela semanas_colheita
        const existingWeek = await fetchQuery<any>(
          'SELECT * FROM semanas_colheita WHERE safra_id = ? AND semana_ano = ?',
          [safra_id, weekOfYear]
        );

        if (!existingWeek || existingWeek.length === 0) {
          const semanaId = generateId();
          const sqlSemana = `
            INSERT INTO semanas_colheita (id, semana_ano, semana_colheita, safra_id)
            VALUES (?, ?, ?, ?)
          `;
          await runQuery(sqlSemana, [semanaId, weekOfYear, semanaColheitaForWeek, safra_id]);
          console.log(`Semana ${weekOfYear} (colheita: ${semanaColheitaForWeek}) registrada para a safra ${safra_id}`);
        }
      }
    }

    // Gerenciar o motorista (converter para letras maiúsculas e criar se não existir)
    let motoristaNome = motorista?.trim();
    if (motoristaNome) {
      motoristaNome = motoristaNome.toUpperCase(); // Converter para letras maiúsculas
      const existingMotorista = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome = ?', [motoristaNome]);
      if (!existingMotorista || existingMotorista.length === 0) {
        const motoristaId = generateId();
        await runQuery('INSERT INTO motoristas (id, nome) VALUES (?, ?)', [motoristaId, motoristaNome]);
        console.log(`Motorista ${motoristaNome} criado com ID ${motoristaId}`);
      }
    }

    // Calcular o total acumulado para a safra até a data do carregamento
    const carregamentosAnteriores = await fetchQuery<any>(
      'SELECT qte_caixa FROM carregamentos WHERE safra_id = ? AND data <= ?',
      [safra_id, data]
    );
    const totalAcumulado = carregamentosAnteriores.reduce((sum, carregamento) => sum + (carregamento.qte_caixa || 0), 0) + qte_caixa;

    const carregamentoId = generateId();
    const sql = `
      INSERT INTO carregamentos (id, data, talhao_id, qtde_plantas, variedade, motorista, placa, qte_caixa, total, semana, semana_colheita, safra_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(sql, [
      carregamentoId,
      data,
      talhao_id,
      qtde_plantas || null,
      variedade || null,
      motoristaNome || null,
      placa || null,
      qte_caixa,
      totalAcumulado,
      semanaAno,
      semanaColheita,
      safra_id,
    ]);
    console.log(`Carregamento criado: ${carregamentoId}`);
    res.status(201).json({ message: 'Carregamento created successfully', id: carregamentoId });
  })
);

// Endpoint para atualizar um carregamento
app.put(
  '/carregamentos/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const {
      data,
      talhao_id,
      motorista,
      placa,
      qte_caixa,
      safra_id,
    } = req.body;

    // Validação básica
    if (!data || !talhao_id || !safra_id || qte_caixa === undefined) {
      res.status(400).json({ error: 'Missing required fields: data, talhao_id, safra_id, and qte_caixa are required' });
      return;
    }

    // Verificar se o carregamento existe
    const carregamentoAtual = await fetchQuery<any>('SELECT * FROM carregamentos WHERE id = ?', [id]);
    if (!carregamentoAtual || carregamentoAtual.length === 0) {
      res.status(404).json({ error: 'Carregamento not found' });
      return;
    }

    console.log(`Recebido talhao_id para atualização: ${talhao_id}`);

    // Buscar o talhão para obter qtde_plantas e variedade
    const talhao = await fetchQuery<any>('SELECT id, NOME, qtde_plantas, VARIEDADE as variedade FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para talhao_id: ${talhao_id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { qtde_plantas, variedade, NOME } = talhao[0];
    console.log(`Talhão encontrado: ID=${talhao_id}, NOME=${NOME}, qtde_plantas=${qtde_plantas}, variedade=${variedade}`);

    // Buscar a safra para obter a data inicial da colheita
    const safra = await fetchQuery<any>('SELECT data_inicial_colheita FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const dataInicialColheita = safra[0].data_inicial_colheita;

    // Calcular a semana do ano do carregamento
    const carregamentoDate = new Date(data);
    const semanaAno = getWeekOfYear(carregamentoDate);
    console.log(`Semana do ano para ${carregamentoDate.toISOString()}: ${semanaAno}`);

    // Calcular a semana da colheita (se data_inicial_colheita estiver definida)
    let semanaColheita = null;
    if (dataInicialColheita) {
      semanaColheita = getWeeksDifference(dataInicialColheita, data);
      console.log(`Semana da colheita (início: ${new Date(dataInicialColheita).toISOString()}, carregamento: ${carregamentoDate.toISOString()}): ${semanaColheita}`);

      // Atualizar a tabela semanas_colheita com todas as semanas desde o início até o carregamento
      const weeksBetween = getWeeksBetween(dataInicialColheita, data);
      for (const week of weeksBetween) {
        const weekOfYear = week.weekOfYear;
        const weekYear = week.year;
        const referenceDate = new Date(weekYear, 0, (weekOfYear - 1) * 7 + 1); // Aproximação da data da semana
        const semanaColheitaForWeek = getWeeksDifference(dataInicialColheita, referenceDate.getTime());

        // Verificar se a semana já existe na tabela semanas_colheita
        const existingWeek = await fetchQuery<any>(
          'SELECT * FROM semanas_colheita WHERE safra_id = ? AND semana_ano = ?',
          [safra_id, weekOfYear]
        );

        if (!existingWeek || existingWeek.length === 0) {
          const semanaId = generateId();
          const sqlSemana = `
            INSERT INTO semanas_colheita (id, semana_ano, semana_colheita, safra_id)
            VALUES (?, ?, ?, ?)
          `;
          await runQuery(sqlSemana, [semanaId, weekOfYear, semanaColheitaForWeek, safra_id]);
          console.log(`Semana ${weekOfYear} (colheita: ${semanaColheitaForWeek}) registrada para a safra ${safra_id}`);
        }
      }
    }

    // Gerenciar o motorista (converter para letras maiúsculas e criar se não existir)
    let motoristaNome = motorista?.trim();
    if (motoristaNome) {
      motoristaNome = motoristaNome.toUpperCase(); // Converter para letras maiúsculas
      const existingMotorista = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome = ?', [motoristaNome]);
      if (!existingMotorista || existingMotorista.length === 0) {
        const motoristaId = generateId();
        await runQuery('INSERT INTO motoristas (id, nome) VALUES (?, ?)', [motoristaId, motoristaNome]);
        console.log(`Motorista ${motoristaNome} criado com ID ${motoristaId}`);
      }
    }

    // Recalcular o total acumulado para a safra até a data do carregamento
    const carregamentosAnteriores = await fetchQuery<any>(
      'SELECT qte_caixa FROM carregamentos WHERE safra_id = ? AND data <= ? AND id != ?',
      [safra_id, data, id]
    );
    const totalAcumulado = carregamentosAnteriores.reduce((sum, carregamento) => sum + (carregamento.qte_caixa || 0), 0) + qte_caixa;

    // Atualizar o carregamento
    const sql = `
      UPDATE carregamentos
      SET data = ?, talhao_id = ?, qtde_plantas = ?, variedade = ?, motorista = ?, placa = ?, qte_caixa = ?, total = ?, semana = ?, semana_colheita = ?, safra_id = ?
      WHERE id = ?
    `;
    await runQuery(sql, [
      data,
      talhao_id,
      qtde_plantas || null,
      variedade || null,
      motoristaNome || null,
      placa || null,
      qte_caixa,
      totalAcumulado,
      semanaAno,
      semanaColheita,
      safra_id,
      id,
    ]);

    console.log(`Carregamento atualizado: ${id}`);
    res.status(200).json({ message: 'Carregamento updated successfully' });
  })
);

// Endpoint para deletar um carregamento
app.delete(
  '/carregamentos/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Verificar se o carregamento existe
    const carregamento = await fetchQuery<any>('SELECT * FROM carregamentos WHERE id = ?', [id]);
    if (!carregamento || carregamento.length === 0) {
      res.status(404).json({ error: 'Carregamento not found' });
      return;
    }

    const sql = 'DELETE FROM carregamentos WHERE id = ?';
    await runQuery(sql, [id]);
    console.log(`Carregamento deletado: ${id}`);
    res.status(200).json({ message: 'Carregamento deleted successfully' });
  })
);

// Endpoint para listar tipo_configs
app.get(
  '/tipo_configs',
  asyncHandler(async (req, res, next) => {
    const tipoConfigs = await fetchQuery<any>('SELECT * FROM tipo_configs', []);
    res.status(200).json(tipoConfigs);
  })
);

// Endpoint para criar um tipo_config
app.post(
  '/tipo_configs',
  asyncHandler(async (req, res, next) => {
    const { name, default_color } = req.body;
    if (!name || !default_color) {
      res.status(400).json({ error: 'Missing required fields: name and default_color are required' });
      return;
    }

    const tipoConfigId = generateId();
    const sql = `
      INSERT INTO tipo_configs (id, name, default_color)
      VALUES (?, ?, ?)
    `;
    await runQuery(sql, [tipoConfigId, name, default_color]);
    console.log(`Tipo_config criado: ${tipoConfigId}`);
    res.status(201).json({ message: 'Tipo_config created successfully', id: tipoConfigId });
  })
);

// Endpoint para atualizar um tipo_config
app.put(
  '/tipo_configs/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, default_color } = req.body;
    if (!name || !default_color) {
      res.status(400).json({ error: 'Missing required fields: name and default_color are required' });
      return;
    }

    const sql = `
      UPDATE tipo_configs
      SET name = ?, default_color = ?
      WHERE id = ?
    `;
    await runQuery(sql, [name, default_color, id]);
    console.log(`Tipo_config atualizado: ${id}`);
    res.status(200).json({ message: 'Tipo_config updated successfully' });
  })
);

// Endpoint para deletar um tipo_config
app.delete(
  '/tipo_configs/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    console.log(`Deleting tipo_config with ID: ${id}`);
    const sql = 'DELETE FROM tipo_configs WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'Tipo_config deleted successfully' });
  })
);

// Endpoint para listar variedade_configs
app.get(
  '/variedade_configs',
  asyncHandler(async (req, res, next) => {
    const variedadeConfigs = await fetchQuery<any>('SELECT * FROM variedade_configs', []);
    res.status(200).json(variedadeConfigs);
  })
);

// Endpoint para criar um variedade_config
app.post(
  '/variedade_configs',
  asyncHandler(async (req, res, next) => {
    const { name, default_color } = req.body;
    if (!name || !default_color) {
      res.status(400).json({ error: 'Missing required fields: name and default_color are required' });
      return;
    }

    const variedadeConfigId = generateId();
    const sql = `
      INSERT INTO variedade_configs (id, name, default_color)
      VALUES (?, ?, ?)
    `;
    await runQuery(sql, [variedadeConfigId, name, default_color]);
    console.log(`Variedade_config criado: ${variedadeConfigId}`);
    res.status(201).json({ message: 'Variedade_config created successfully', id: variedadeConfigId });
  })
);

// Endpoint para atualizar um variedade_config
app.put(
  '/variedade_configs/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, default_color } = req.body;
    if (!name || !default_color) {
      res.status(400).json({ error: 'Missing required fields: name and default_color are required' });
      return;
    }

    const sql = `
      UPDATE variedade_configs
      SET name = ?, default_color = ?
      WHERE id = ?
    `;
    await runQuery(sql, [name, default_color, id]);
    console.log(`Variedade_config atualizado: ${id}`);
    res.status(200).json({ message: 'Variedade_config updated successfully' });
  })
);

// Endpoint para deletar um variedade_config
app.delete(
  '/variedade_configs/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    console.log(`Deleting variedade_config with ID: ${id}`);
    const sql = 'DELETE FROM variedade_configs WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'Variedade_config deleted successfully' });
  })
);

// Endpoint para listar prev_realizado
app.get(
  '/prev_realizado',
  asyncHandler(async (req, res, next) => {
    const prevRealizado = await fetchQuery<any>('SELECT * FROM prev_realizado', []);
    res.status(200).json(prevRealizado);
  })
);

// Endpoint para listar previsoes
app.get(
  '/previsoes',
  asyncHandler(async (req, res, next) => {
    const previsoes = await fetchQuery<any>('SELECT * FROM previsoes', []);
    res.status(200).json(previsoes);
  })
);

// Endpoint para criar ou atualizar uma previsão (upsert)
app.post(
  '/previsoes',
  asyncHandler(async (req, res, next) => {
    const {
      talhao_id,
      safra_id,
      qtde_caixas_prev_pe,
    } = req.body;

    // Validação básica
    if (!talhao_id || !safra_id || qtde_caixas_prev_pe === undefined) {
      res.status(400).json({ error: 'Missing required fields: talhao_id, safra_id, and qtde_caixas_prev_pe are required' });
      return;
    }

    // Buscar o talhão para copiar suas informações
    const talhao = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const talhaoData = talhao[0];

    // Buscar a safra para confirmar que existe
    const safra = await fetchQuery<any>('SELECT * FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    // Verificar se já existe uma previsão para esse talhao_id e safra_id
    const existingPrevisao = await fetchQuery<any>(
      'SELECT * FROM previsoes WHERE talhao_id = ? AND safra_id = ?',
      [talhao_id, safra_id]
    );

    if (existingPrevisao.length > 0) {
      // Atualizar a previsão existente
      const sql = `
        UPDATE previsoes
        SET talhao_nome = ?, variedade = ?, data_de_plantio = ?, idade = ?, qtde_plantas = ?, qtde_caixas_prev_pe = ?
        WHERE talhao_id = ? AND safra_id = ?
      `;
      await runQuery(sql, [
        talhaoData.NOME,
        talhaoData.VARIEDADE || null,
        talhaoData.DATA_DE_PLANTIO || null,
        talhaoData.IDADE || null,
        talhaoData.qtde_plantas || null,
        qtde_caixas_prev_pe,
        talhao_id,
        safra_id,
      ]);
      console.log(`Previsão atualizada para talhao_id: ${talhao_id}, safra_id: ${safra_id}`);
      res.status(200).json({ message: 'Previsão updated successfully' });
    } else {
      // Criar uma nova previsão
      const previsaoId = generateId();
      const sql = `
        INSERT INTO previsoes (id, talhao_id, safra_id, talhao_nome, variedade, data_de_plantio, idade, qtde_plantas, qtde_caixas_prev_pe)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await runQuery(sql, [
        previsaoId,
        talhao_id,
        safra_id,
        talhaoData.NOME,
        talhaoData.VARIEDADE || null,
        talhaoData.DATA_DE_PLANTIO || null,
        talhaoData.IDADE || null,
        talhaoData.qtde_plantas || null,
        qtde_caixas_prev_pe,
      ]);
      console.log(`Previsão criada: ${previsaoId}`);
      res.status(201).json({ message: 'Previsão created successfully', id: previsaoId });
    }
  })
);

// Endpoint para deletar um KML
app.delete(
  '/kml_files/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    console.log(`Deleting KML with ID: ${id}`);
    const sql = 'DELETE FROM kml_files WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'KML deleted successfully' });
  })
);

// Iniciar o servidor após inicializar o banco de dados
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database and start server:', error);
    process.exit(1);
  }
};

// Iniciar o servidor
startServer();