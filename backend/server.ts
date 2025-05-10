import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import { parseKML } from './kmlParser';
import { initializeDatabase, generateId, runQuery, fetchQuery } from './db';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar o multer para salvar arquivos no diretório 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Enable CORS for requests from the frontend origin
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5000'], // Permitir frontend em portas diferentes
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

  let currentDate = new Date(start);
  while (currentDate <= end) {
    const weekOfYear = getWeekOfYear(currentDate);
    const year = currentDate.getFullYear();
    weeks.push({ weekOfYear, year });
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
};

// Endpoint para upload de KML
app.post(
  '/kml/upload',
  upload.single('kmlFile'),
  asyncHandler(async (req, res, next) => {
    console.log('Received KML upload request');

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

    const filePath = req.file.path;
    const kmlContent = await fs.readFile(filePath, 'utf-8');
    console.log('KML file read successfully, length:', kmlContent.length);

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

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.log('No features found in KML');
      res.status(400).json({ error: 'No features found in KML file' });
      return;
    }

    const kmlId = generateId();
    const kmlSql = `
      INSERT INTO kml_files (id, name, content)
      VALUES (?, ?, ?)
    `;
    await runQuery(kmlSql, [kmlId, req.file.originalname, kmlContent]);
    console.log('KML saved to database:', kmlId);

    const existingTalhaoIds = new Set<string>();
    const talhaoSql = `
      INSERT INTO talhoes (id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, DATA_DE_PLANTIO, IDADE, PRODUCAO_CAIXA, PRODUCAO_HECTARE, COR, qtde_plantas, coordinates, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ativo: 1,
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
            talhao.ativo,
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

    const safra = await fetchQuery<any>('SELECT * FROM safras WHERE id = ?', [id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const semanas = await fetchQuery<any>('SELECT semana_ano, semana_colheita FROM semanas_colheita WHERE safra_id = ? ORDER BY semana_ano', [id]);
    res.status(200).json(semanas);
  })
);

// Endpoint para listar KMLs
app.get(
  '/kml_files',
  asyncHandler(async (req, res, next) => {
    const kmls = await fetchQuery<any>('SELECT * FROM kml_files', []);
    res.status(200).json(kmls);
  })
);

// Endpoint para listar talhões
app.get(
  '/talhoes',
  asyncHandler(async (req, res, next) => {
    const talhoes = await fetchQuery<any>('SELECT * FROM talhoes', []);
    console.log('Talhões retornados:', talhoes.map((t: any) => ({
      id: t.id,
      TalhaoID: t.TalhaoID,
      NOME: t.NOME,
      ativo: t.ativo,
    })));
    res.status(200).json(talhoes);
  })
);

// Novo endpoint para calcular a produção de caixas de um talhão
app.get(
  '/talhoes/:id/producao_caixa',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { safra_id } = req.query;

    if (!safra_id) {
      res.status(400).json({ error: 'Missing required query parameter: safra_id is required' });
      return;
    }

    const talhao = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhao || talhao.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const carregamentos = await fetchQuery<any>(
      'SELECT qte_caixa FROM carregamentos WHERE talhao_id = ? AND safra_id = ?',
      [id, safra_id]
    );

    const totalCaixas = carregamentos.reduce((sum: number, c: any) => sum + c.qte_caixa, 0);

    res.status(200).json({ totalCaixas });
  })
);

// Endpoint para buscar as coordenadas de um talhao a partir do KML
app.get(
  '/talhoes/:id/coordinates',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const talhao = await fetchQuery<any>('SELECT TalhaoID, NOME, ativo FROM talhoes WHERE id = ?', [id]);
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para ID: ${id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { TalhaoID, NOME, ativo } = talhao[0];
    const identifier = TalhaoID || NOME;
    if (!identifier) {
      console.log(`Talhão ID: ${id} não possui TalhaoID ou NOME válido`);
      res.status(400).json({ error: 'Talhao does not have a valid TalhaoID or NOME to match with KML' });
      return;
    }

    if (!ativo) {
      console.log(`Talhão ID: ${id} (TalhaoID/NOME: ${identifier}) está inativo, não buscando coordenadas no KML`);
      res.status(410).json({ 
        error: `Talhão ${identifier} está inativo e não possui coordenadas associadas`,
        suggestion: 'Este talhão não está mais em uso. Registros históricos podem estar disponíveis, mas coordenadas não serão buscadas.'
      });
      return;
    }

    console.log(`Buscando KML para talhão ID: ${id}, identifier: ${identifier}`);

    const kmlFiles = await fetchQuery<any>('SELECT content FROM kml_files ORDER BY ROWID DESC LIMIT 1', []);
    if (!kmlFiles || kmlFiles.length === 0) {
      console.log('Nenhum arquivo KML encontrado no banco de dados');
      res.status(404).json({ error: 'No KML files found in the database' });
      return;
    }

    const kmlContent = kmlFiles[0].content;
    console.log(`KML encontrado, tamanho do conteúdo: ${kmlContent.length} caracteres`);

    let geojson: FeatureCollection;
    try {
      geojson = parseKML(kmlContent);
      console.log(`KML parseado com sucesso, número de features: ${geojson.features.length}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during KML parsing';
      console.error('Failed to parse KML:', errorMessage);
      res.status(400).json({ error: 'Failed to parse KML file', details: errorMessage });
      return;
    }

    const feature = geojson.features.find((f) => {
      const featureName = f.properties?.name || f.properties?.Name;
      const isMatch = featureName === identifier && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
      console.log(`Verificando feature: name=${featureName}, type=${f.geometry.type}, match=${isMatch}`);
      return isMatch;
    });

    if (!feature) {
      console.log(`Nenhuma feature correspondente encontrada no KML para TalhaoID/NOME: ${identifier}`);
      res.status(404).json({ 
        error: `No matching feature found in KML for TalhaoID/NOME: ${identifier}`,
        suggestion: 'Verifique se um arquivo KML com o talhão correspondente foi carregado e se o nome no KML corresponde ao TalhaoID ou NOME.'
      });
      return;
    }

    const geometry = feature.geometry as Polygon | MultiPolygon;
    if (!geometry.coordinates) {
      console.log('Geometria inválida: coordenadas não encontradas');
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

    if (!coordinates) {
      res.status(400).json({ error: 'Missing required field: coordinates is required' });
      return;
    }

    const talhaoAtual = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhaoAtual || talhaoAtual.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

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
      ativo,
    } = req.body;

    if (!NOME) {
      res.status(400).json({ error: 'Missing required field: NOME is required' });
      return;
    }

    if (TalhaoID) {
      const existingTalhao = await fetchQuery<any>(
        'SELECT id FROM talhoes WHERE TalhaoID = ?',
        [TalhaoID]
      );
      if (existingTalhao.length > 0) {
        res.status(409).json({ error: `TalhaoID ${TalhaoID} já está em uso por outro talhão` });
        return;
      }
    }

    const talhaoId = generateId();
    const sql = `
      INSERT INTO talhoes (id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, DATA_DE_PLANTIO, IDADE, PRODUCAO_CAIXA, PRODUCAO_HECTARE, COR, qtde_plantas, coordinates, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ativo !== undefined ? (ativo ? 1 : 0) : 1,
    ]);
    console.log(`Talhao criado: ${talhaoId}, TalhaoID: ${TalhaoID}, NOME: ${NOME}`);
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
      ativo,
    } = req.body;

    if (!NOME) {
      res.status(400).json({ error: 'Missing required field: NOME is required' });
      return;
    }

    const talhaoAtual = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhaoAtual || talhaoAtual.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const talhaoExistente = talhaoAtual[0];

    if (TalhaoID && TalhaoID !== talhaoExistente.TalhaoID) {
      const existingTalhaoWithId = await fetchQuery<any>(
        'SELECT id FROM talhoes WHERE TalhaoID = ? AND id != ?',
        [TalhaoID, id]
      );
      if (existingTalhaoWithId.length > 0) {
        res.status(409).json({ error: `TalhaoID ${TalhaoID} já está em uso por outro talhão` });
        return;
      }
    }

    const sql = `
      UPDATE talhoes
      SET TalhaoID = ?, TIPO = ?, NOME = ?, AREA = ?, VARIEDADE = ?, PORTAENXERTO = ?, DATA_DE_PLANTIO = ?, IDADE = ?, PRODUCAO_CAIXA = ?, PRODUCAO_HECTARE = ?, COR = ?, qtde_plantas = ?, ativo = ?
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
      ativo !== undefined ? (ativo ? 1 : 0) : talhaoExistente.ativo,
      id,
    ]);
    console.log(`Talhao atualizado: ${id}, novo TalhaoID: ${TalhaoID}`);
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

// Endpoint para listar motoristas
app.get(
  '/motoristas',
  asyncHandler(async (req, res, next) => {
    const { search } = req.query;
    let motoristas;
    if (search) {
      const searchTerm = search.toString().toUpperCase();
      motoristas = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome LIKE ? ORDER BY nome', [`${searchTerm}%`]);
    } else {
      motoristas = await fetchQuery<any>('SELECT * FROM motoristas ORDER BY nome', []);
    }
    res.status(200).json(motoristas);
  })
);

// Endpoint para criar um motorista
app.post(
  '/motoristas',
  asyncHandler(async (req, res, next) => {
    const { nome } = req.body;

    if (!nome) {
      res.status(400).json({ error: 'Nome do motorista é obrigatório' });
      return;
    }

    const motoristaNome = nome.toUpperCase();

    const existingMotorista = await fetchQuery<{ id: string }>(
      'SELECT id FROM motoristas WHERE nome = ?',
      [motoristaNome]
    );

    if (existingMotorista.length > 0) {
      res.status(409).json({ error: 'Motorista já existe' });
      return;
    }

    const motoristaId = generateId();
    await runQuery(
      'INSERT INTO motoristas (id, nome) VALUES (?, ?)',
      [motoristaId, motoristaNome]
    );

    console.log(`Motorista criado: ${motoristaNome} (ID: ${motoristaId})`);
    res.status(201).json({ id: motoristaId, nome: motoristaNome });
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

    if (!data || !talhao_id || !safra_id || qte_caixa === undefined) {
      res.status(400).json({ error: 'Missing required fields: data, talhao_id, safra_id, and qte_caixa are required' });
      return;
    }

    console.log(`Recebido talhao_id: ${talhao_id}`);

    const talhao = await fetchQuery<any>('SELECT id, NOME, qtde_plantas, VARIEDADE as variedade FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para talhao_id: ${talhao_id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { qtde_plantas, variedade, NOME } = talhao[0];
    console.log(`Talhão encontrado: ID=${talhao_id}, NOME=${NOME}, qtde_plantas=${qtde_plantas}, variedade=${variedade}`);

    const safra = await fetchQuery<any>('SELECT data_inicial_colheita FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const dataInicialColheita = safra[0].data_inicial_colheita;

    const carregamentoDate = new Date(data);
    const semanaAno = getWeekOfYear(carregamentoDate);
    console.log(`Semana do ano para ${carregamentoDate.toISOString()}: ${semanaAno}`);

    let semanaColheita = null;
    if (dataInicialColheita) {
      semanaColheita = getWeeksDifference(dataInicialColheita, data);
      console.log(`Semana da colheita (início: ${new Date(dataInicialColheita).toISOString()}, carregamento: ${carregamentoDate.toISOString()}): ${semanaColheita}`);

      const weeksBetween = getWeeksBetween(dataInicialColheita, data);
      for (const week of weeksBetween) {
        const weekOfYear = week.weekOfYear;
        const weekYear = week.year;
        const referenceDate = new Date(weekYear, 0, (weekOfYear - 1) * 7 + 1);
        const semanaColheitaForWeek = getWeeksDifference(dataInicialColheita, referenceDate.getTime());

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

    let motoristaNome = motorista?.trim();
    if (motoristaNome) {
      motoristaNome = motoristaNome.toUpperCase();
      const existingMotorista = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome = ?', [motoristaNome]);
      if (!existingMotorista || existingMotorista.length === 0) {
        const motoristaId = generateId();
        await runQuery('INSERT INTO motoristas (id, nome) VALUES (?, ?)', [motoristaId, motoristaNome]);
        console.log(`Motorista ${motoristaNome} criado com ID ${motoristaId}`);
      }
    }

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

    if (!data || !talhao_id || !safra_id || qte_caixa === undefined) {
      res.status(400).json({ error: 'Missing required fields: data, talhao_id, safra_id, and qte_caixa are required' });
      return;
    }

    const carregamentoAtual = await fetchQuery<any>('SELECT * FROM carregamentos WHERE id = ?', [id]);
    if (!carregamentoAtual || carregamentoAtual.length === 0) {
      res.status(404).json({ error: 'Carregamento not found' });
      return;
    }

    console.log(`Recebido talhao_id para atualização: ${talhao_id}`);

    const talhao = await fetchQuery<any>('SELECT id, NOME, qtde_plantas, VARIEDADE as variedade FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para talhao_id: ${talhao_id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { qtde_plantas, variedade, NOME } = talhao[0];
    console.log(`Talhão encontrado: ID=${talhao_id}, NOME=${NOME}, qtde_plantas=${qtde_plantas}, variedade=${variedade}`);

    const safra = await fetchQuery<any>('SELECT data_inicial_colheita FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const dataInicialColheita = safra[0].data_inicial_colheita;

    const carregamentoDate = new Date(data);
    const semanaAno = getWeekOfYear(carregamentoDate);
    console.log(`Semana do ano para ${carregamentoDate.toISOString()}: ${semanaAno}`);

    let semanaColheita = null;
    if (dataInicialColheita) {
      semanaColheita = getWeeksDifference(dataInicialColheita, data);
      console.log(`Semana da colheita (início: ${new Date(dataInicialColheita).toISOString()}, carregamento: ${carregamentoDate.toISOString()}): ${semanaColheita}`);

      const weeksBetween = getWeeksBetween(dataInicialColheita, data);
      for (const week of weeksBetween) {
        const weekOfYear = week.weekOfYear;
        const weekYear = week.year;
        const referenceDate = new Date(weekYear, 0, (weekOfYear - 1) * 7 + 1);
        const semanaColheitaForWeek = getWeeksDifference(dataInicialColheita, referenceDate.getTime());

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

    let motoristaNome = motorista?.trim();
    if (motoristaNome) {
      motoristaNome = motoristaNome.toUpperCase();
      const existingMotorista = await fetchQuery<any>('SELECT * FROM motoristas WHERE nome = ?', [motoristaNome]);
      if (!existingMotorista || existingMotorista.length === 0) {
        const motoristaId = generateId();
        await runQuery('INSERT INTO motoristas (id, nome) VALUES (?, ?)', [motoristaId, motoristaNome]);
        console.log(`Motorista ${motoristaNome} criado com ID ${motoristaId}`);
      }
    }

    const carregamentosAnteriores = await fetchQuery<any>(
      'SELECT qte_caixa FROM carregamentos WHERE safra_id = ? AND data <= ? AND id != ?',
      [safra_id, data, id]
    );
    const totalAcumulado = carregamentosAnteriores.reduce((sum, carregamento) => sum + (carregamento.qte_caixa || 0), 0) + qte_caixa;

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

    if (!talhao_id || !safra_id || qtde_caixas_prev_pe === undefined) {
      res.status(400).json({ error: 'Missing required fields: talhao_id, safra_id, and qtde_caixas_prev_pe are required' });
      return;
    }

    const talhao = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [talhao_id]);
    if (!talhao || talhao.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const talhaoData = talhao[0];

    const safra = await fetchQuery<any>('SELECT * FROM safras WHERE id = ?', [safra_id]);
    if (!safra || safra.length === 0) {
      res.status(404).json({ error: 'Safra not found' });
      return;
    }

    const existingPrevisao = await fetchQuery<any>(
      'SELECT * FROM previsoes WHERE talhao_id = ? AND safra_id = ?',
      [talhao_id, safra_id]
    );

    if (existingPrevisao.length > 0) {
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