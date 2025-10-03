import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseKML } from './kmlParser';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Configurar Supabase (apenas em produção)
let supabase: any = null;
if (IS_PRODUCTION && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase configurado para produção');
} else if (IS_PRODUCTION) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados!');
}

// Importar funções do DB apenas em desenvolvimento
let initializeDatabase: any;
let generateId: any;
let runQuery: any;
let fetchQuery: any;

if (!IS_PRODUCTION) {
  const dbModule = require('./db');
  initializeDatabase = dbModule.initializeDatabase;
  generateId = dbModule.generateId;
  runQuery = dbModule.runQuery;
  fetchQuery = dbModule.fetchQuery;
} else {
  // Usar módulo vazio em produção
  const dbProdModule = require('./db.prod');
  initializeDatabase = dbProdModule.initializeDatabase;
  generateId = dbProdModule.generateId;
  runQuery = dbProdModule.runQuery;
  fetchQuery = dbProdModule.fetchQuery;
}

// Configurar o multer para usar memória (compatível com serverless)
const upload = multer({ storage: multer.memoryStorage() });

// Lista de origens permitidas
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:4173',
  // Adicionar URLs de produção quando deployar:
  // 'https://fazendaretiro.vercel.app',
  // 'https://seu-dominio-custom.com',
];

// Enable CORS for requests from the frontend origin
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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

// Middleware de autenticação JWT
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Token inválido ou expirado' });
      return;
    }
    (req as any).user = user;
    next();
  });
};

// ENDPOINTS DE AUTENTICAÇÃO

// Endpoint para registrar novo usuário (protegido por palavra-chave)
app.post(
  '/auth/register',
  asyncHandler(async (req, res, next) => {
    const { username, password, nome, registrationKey } = req.body;

    // Validar campos obrigatórios
    if (!username || !password || !nome || !registrationKey) {
      res.status(400).json({ error: 'Username, password, nome e chave de registro são obrigatórios' });
      return;
    }

    // Verificar palavra-chave de registro
    const REGISTRATION_KEY = process.env.REGISTRATION_KEY || 'fazendaretiro2025';
    if (registrationKey !== REGISTRATION_KEY) {
      res.status(403).json({ error: 'Chave de registro inválida. Entre em contato com o administrador.' });
      return;
    }

    if (IS_PRODUCTION && supabase) {
      // Usar Supabase em produção
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('username', username);

      if (existingUsers && existingUsers.length > 0) {
        res.status(409).json({ error: 'Usuário já existe' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const userId = generateId();
      const created_at = Math.floor(Date.now() / 1000);

      const { error } = await supabase
        .from('users')
        .insert([{ id: userId, username, password_hash, nome, created_at }]);

      if (error) {
        console.error('Erro ao criar usuário no Supabase:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
        return;
      }

      console.log(`Usuário registrado: ${username} (ID: ${userId})`);
      res.status(201).json({ message: 'Usuário registrado com sucesso', id: userId });
    } else {
      // Usar SQLite em desenvolvimento
      const existingUser = await fetchQuery<any>('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUser.length > 0) {
        res.status(409).json({ error: 'Usuário já existe' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const userId = generateId();

      await runQuery(
        'INSERT INTO users (id, username, password_hash, nome) VALUES (?, ?, ?, ?)',
        [userId, username, password_hash, nome]
      );

      console.log(`Usuário registrado: ${username} (ID: ${userId})`);
      res.status(201).json({ message: 'Usuário registrado com sucesso', id: userId });
    }
  })
);

// Endpoint para login
app.post(
  '/auth/login',
  asyncHandler(async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username e password são obrigatórios' });
      return;
    }

    if (IS_PRODUCTION && supabase) {
      // Usar Supabase em produção
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .eq('username', username);

      if (!users || users.length === 0) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      const user = users[0];

      // Verificar senha
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      // Gerar token JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, nome: user.nome },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`Login bem-sucedido: ${username}`);
      res.status(200).json({
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          username: user.username,
          nome: user.nome
        }
      });
    } else {
      // Usar SQLite em desenvolvimento
      const users = await fetchQuery<any>('SELECT * FROM users WHERE username = ?', [username]);
      if (users.length === 0) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      const user = users[0];

      // Verificar senha
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      // Gerar token JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, nome: user.nome },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`Login bem-sucedido: ${username}`);
      res.status(200).json({
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          username: user.username,
          nome: user.nome
        }
      });
    }
  })
);

// Endpoint para verificar token (útil para validar sessão)
app.get(
  '/auth/verify',
  authenticateToken,
  asyncHandler(async (req, res, next) => {
    const user = (req as any).user;
    res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome
      }
    });
  })
);

// ENDPOINTS PROTEGIDOS (requerem autenticação)
// Aplicar middleware de autenticação para todas as rotas abaixo
app.use(authenticateToken);

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
    }    // Buscar todos os talhões KML existentes no banco de dados
    const existingTalhoesKml = await fetchQuery<any>('SELECT * FROM talhoes_kml', []);
    console.log(`Total de talhões KML existentes no banco: ${existingTalhoesKml.length}`);

    const kmlId = generateId();
    const kmlSql = `
      INSERT INTO kml_files (id, name, content)
      VALUES (?, ?, ?)
    `;
    await runQuery(kmlSql, [kmlId, req.file.originalname, kmlContent]);
    console.log('KML saved to database:', kmlId);    const processedPlacemarkNames = new Set<string>();
    let createdKmlTalhoes = 0;
    let updatedKmlTalhoes = 0;

    // Primeiro, coletar todos os placemark names do novo arquivo KML
    const newPlacemarkNames = new Set<string>();
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const placemarkName = feature.properties?.name || feature.properties?.Name;
        if (placemarkName) {
          newPlacemarkNames.add(placemarkName);
        }
      }
    }

    // Processar features do novo KML
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const placemarkName = feature.properties?.name || feature.properties?.Name;
        if (!placemarkName) {
          console.log('Feature ignorada: nome do placemark não encontrado');
          continue;
        }

        if (processedPlacemarkNames.has(placemarkName)) {
          console.log(`Placemark ${placemarkName} já processado, ignorando duplicata`);
          continue;
        }

        console.log(`Processando placemark: ${placemarkName}`);
        const geometry = feature.geometry as Polygon | MultiPolygon;
        const coordinates = geometry.coordinates;

        // Verificar se já existe um talhao_kml com o mesmo placemark_name
        const existingTalhaoKml = existingTalhoesKml.find(
          (talhaoKml: any) => talhaoKml.placemark_name === placemarkName
        );

        if (existingTalhaoKml) {
          // Talhão KML já existe, atualizar apenas as coordenadas
          const updateSql = `
            UPDATE talhoes_kml
            SET coordinates = ?, geometry_type = ?, kml_file_id = ?
            WHERE id = ?
          `;
          await runQuery(updateSql, [
            JSON.stringify(coordinates), 
            geometry.type, 
            kmlId, 
            existingTalhaoKml.id
          ]);
          console.log(`Coordenadas do talhão KML ${placemarkName} (ID: ${existingTalhaoKml.id}) atualizadas.`);
          updatedKmlTalhoes++;
        } else {
          // Criar um novo talhão KML
          const talhaoKmlId = generateId();
          const talhaoKmlSql = `
            INSERT INTO talhoes_kml (id, placemark_name, coordinates, geometry_type, kml_file_id, ativo)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          await runQuery(talhaoKmlSql, [
            talhaoKmlId,
            placemarkName,
            JSON.stringify(coordinates),
            geometry.type,
            kmlId,
            1
          ]);
          console.log(`Novo talhão KML criado: ${placemarkName} (ID: ${talhaoKmlId})`);
          createdKmlTalhoes++;
        }

        processedPlacemarkNames.add(placemarkName);
      } else {
        console.log(`Feature ignorada: geometria não é Polygon ou MultiPolygon (${feature.geometry.type})`);
      }
    }

    // Verificar talhões KML que existiam antes mas não estão no novo arquivo
    let removedKmlTalhoes = 0;
    let unlinkedTalhoes = 0;
    
    for (const existingTalhaoKml of existingTalhoesKml) {
      if (!newPlacemarkNames.has(existingTalhaoKml.placemark_name)) {
        console.log(`Talhão KML ${existingTalhaoKml.placemark_name} não encontrado no novo arquivo, removendo...`);
        
        // Primeiro, desfazer vinculações com talhões
        const vinculatedTalhoes = await fetchQuery<any>(
          'SELECT id, NOME FROM talhoes WHERE talhao_kml_id = ?', 
          [existingTalhaoKml.id]
        );
        
        if (vinculatedTalhoes.length > 0) {
          console.log(`Desfazendo vinculação de ${vinculatedTalhoes.length} talhão(ões) com o talhão KML ${existingTalhaoKml.placemark_name}`);
          await runQuery(
            'UPDATE talhoes SET talhao_kml_id = NULL WHERE talhao_kml_id = ?',
            [existingTalhaoKml.id]
          );
          unlinkedTalhoes += vinculatedTalhoes.length;
          
          for (const talhao of vinculatedTalhoes) {
            console.log(`Talhão "${talhao.NOME}" (ID: ${talhao.id}) desvinculado do talhão KML removido`);
          }
        }
        
        // Remover o talhão KML
        await runQuery('DELETE FROM talhoes_kml WHERE id = ?', [existingTalhaoKml.id]);
        console.log(`Talhão KML ${existingTalhaoKml.placemark_name} (ID: ${existingTalhaoKml.id}) removido`);
        removedKmlTalhoes++;
      }
    }    await fs.unlink(filePath);
    console.log('Temporary file deleted:', filePath);

    const message = `KML processado com sucesso. ${createdKmlTalhoes} novos talhões KML criados, ${updatedKmlTalhoes} atualizados.` +
      (removedKmlTalhoes > 0 ? ` ${removedKmlTalhoes} talhões KML removidos (não presentes no novo arquivo).` : '') +
      (unlinkedTalhoes > 0 ? ` ${unlinkedTalhoes} talhão(ões) desvinculado(s).` : '');

    res.status(200).json({ 
      message,
      kmlId,
      createdKmlTalhoes,
      updatedKmlTalhoes,
      removedKmlTalhoes,
      unlinkedTalhoes
    });
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

// Endpoint para listar talhões KML
app.get(
  '/talhoes_kml',
  asyncHandler(async (req, res, next) => {
    const talhoesKml = await fetchQuery<any>('SELECT * FROM talhoes_kml ORDER BY placemark_name', []);
    res.status(200).json(talhoesKml);
  })
);

// Endpoint para buscar talhões não vinculados a talhões KML
app.get(
  '/talhoes/sem-kml',
  asyncHandler(async (req, res, next) => {
    const talhoesSemKml = await fetchQuery<any>('SELECT * FROM talhoes WHERE talhao_kml_id IS NULL ORDER BY NOME', []);
    res.status(200).json(talhoesSemKml);
  })
);

// Endpoint para buscar talhões KML não vinculados a talhões
app.get(
  '/talhoes_kml/sem-vinculo',
  asyncHandler(async (req, res, next) => {
    const talhoesKmlSemVinculo = await fetchQuery<any>(
      `SELECT tk.* FROM talhoes_kml tk 
       LEFT JOIN talhoes t ON t.talhao_kml_id = tk.id 
       WHERE t.id IS NULL AND tk.ativo = 1
       ORDER BY tk.placemark_name`, 
      []
    );
    res.status(200).json(talhoesKmlSemVinculo);
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
      OBS: t.OBS,
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

    const talhao = await fetchQuery<any>(
      'SELECT t.TalhaoID, t.NOME, t.ativo, t.talhao_kml_id FROM talhoes t WHERE t.id = ?', 
      [id]
    );
    if (!talhao || talhao.length === 0) {
      console.log(`Talhão não encontrado para ID: ${id}`);
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    const { TalhaoID, NOME, ativo, talhao_kml_id } = talhao[0];

    if (!ativo) {
      console.log(`Talhão ID: ${id} (NOME: ${NOME}) está inativo`);
      res.status(410).json({ 
        error: `Talhão ${NOME} está inativo`,
        suggestion: 'Este talhão não está mais em uso.'
      });
      return;
    }

    // Se talhão tem referência direta para talhoes_kml
    if (talhao_kml_id) {
      const talhaoKml = await fetchQuery<any>(
        'SELECT coordinates FROM talhoes_kml WHERE id = ? AND ativo = 1', 
        [talhao_kml_id]
      );
      
      if (talhaoKml && talhaoKml.length > 0) {
        const coordinates = JSON.parse(talhaoKml[0].coordinates);
        res.status(200).json({ coordinates });
        return;
      }
    }

    // Caso não tenha referência direta, tentar buscar por nome no talhoes_kml
    const identifier = TalhaoID || NOME;
    console.log(`Buscando talhão KML por nome para talhão ID: ${id}, identifier: ${identifier}`);

    const talhaoKmlByName = await fetchQuery<any>(
      'SELECT coordinates FROM talhoes_kml WHERE placemark_name = ? AND ativo = 1', 
      [identifier]
    );

    if (!talhaoKmlByName || talhaoKmlByName.length === 0) {
      console.log(`Nenhum talhão KML encontrado para identifier: ${identifier}`);
      res.status(404).json({ 
        error: `Coordenadas não encontradas para talhão: ${identifier}`,
        suggestion: 'Verifique se um arquivo KML com o talhão correspondente foi carregado.'
      });
      return;
    }

    const coordinates = JSON.parse(talhaoKmlByName[0].coordinates);
    res.status(200).json({ coordinates });
  })
);

// Endpoint para vincular um talhão a um talhão KML
app.put(
  '/talhoes/:id/link-kml',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { talhao_kml_id } = req.body;

    if (!talhao_kml_id) {
      res.status(400).json({ error: 'Missing required field: talhao_kml_id is required' });
      return;
    }

    const talhaoAtual = await fetchQuery<any>('SELECT * FROM talhoes WHERE id = ?', [id]);
    if (!talhaoAtual || talhaoAtual.length === 0) {
      res.status(404).json({ error: 'Talhao not found' });
      return;
    }

    // Verificar se o talhao_kml_id existe
    const talhaoKml = await fetchQuery<any>('SELECT * FROM talhoes_kml WHERE id = ?', [talhao_kml_id]);
    if (!talhaoKml || talhaoKml.length === 0) {
      res.status(404).json({ error: 'Talhao KML not found' });
      return;
    }

    const sql = `
      UPDATE talhoes
      SET talhao_kml_id = ?
      WHERE id = ?
    `;
    await runQuery(sql, [talhao_kml_id, id]);
    console.log(`Talhão ${id} vinculado ao talhão KML ${talhao_kml_id}`);
    res.status(200).json({ message: 'Talhão vinculado ao KML com sucesso' });
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
      FALHAS,
      ESP,
      COR,
      qtde_plantas,
      talhao_kml_id,
      OBS,
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

    // Verificar se talhao_kml_id existe, caso fornecido
    if (talhao_kml_id) {
      const talhaoKml = await fetchQuery<any>('SELECT id FROM talhoes_kml WHERE id = ?', [talhao_kml_id]);
      if (!talhaoKml || talhaoKml.length === 0) {
        res.status(404).json({ error: 'Talhao KML not found' });
        return;
      }
    }

    const talhaoId = generateId();
    const sql = `
      INSERT INTO talhoes (id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, DATA_DE_PLANTIO, IDADE, FALHAS, ESP, COR, qtde_plantas, talhao_kml_id, OBS, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      FALHAS || null,
      ESP || null,
      COR || '#00FF00',
      qtde_plantas || null,
      talhao_kml_id || null,
      OBS || null,
      ativo !== undefined ? (ativo ? 1 : 0) : 1,
    ]);
    console.log(`Talhao criado: ${talhaoId}, TalhaoID: ${TalhaoID}, NOME: ${NOME}`);
    res.status(201).json({ message: 'Talhao created successfully', id: talhaoId });
  })
);

// Endpoint para atualizar um talhao (sem atualizar coordenadas)
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
      FALHAS,
      ESP,
      COR,
      qtde_plantas,
      talhao_kml_id,
      OBS,
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

    // Verificar se talhao_kml_id existe, caso fornecido
    if (talhao_kml_id && talhao_kml_id !== talhaoExistente.talhao_kml_id) {
      const talhaoKml = await fetchQuery<any>('SELECT id FROM talhoes_kml WHERE id = ?', [talhao_kml_id]);
      if (!talhaoKml || talhaoKml.length === 0) {
        res.status(404).json({ error: 'Talhao KML not found' });
        return;
      }
    }

    const sql = `
      UPDATE talhoes
      SET TalhaoID = ?, TIPO = ?, NOME = ?, AREA = ?, VARIEDADE = ?, PORTAENXERTO = ?, DATA_DE_PLANTIO = ?, IDADE = ?, FALHAS = ?, ESP = ?, COR = ?, qtde_plantas = ?, talhao_kml_id = ?, OBS = ?, ativo = ?
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
      FALHAS !== undefined ? FALHAS : talhaoExistente.FALHAS,
      ESP !== undefined ? ESP : talhaoExistente.ESP,
      COR !== undefined ? COR : talhaoExistente.COR,
      qtde_plantas !== undefined ? qtde_plantas : talhaoExistente.qtde_plantas,
      talhao_kml_id !== undefined ? talhao_kml_id : talhaoExistente.talhao_kml_id,
      OBS !== undefined ? OBS : talhaoExistente.OBS,
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

    const carregamentoId = generateId();
    const sql = `
      INSERT INTO carregamentos (id, data, talhao_id, qtde_plantas, variedade, motorista, placa, qte_caixa, semana, semana_colheita, safra_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    const sql = `
      UPDATE carregamentos
      SET data = ?, talhao_id = ?, qtde_plantas = ?, variedade = ?, motorista = ?, placa = ?, qte_caixa = ?, semana = ?, semana_colheita = ?, safra_id = ?
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

// ENDPOINTS TALHAO_SAFRA (CRUD por safra)

// Listar todos os talhões, trazendo dados da base e sobrescrevendo pelos da safra quando houver, incluindo coordenadas do KML
app.get(
  '/talhao_safra',
  asyncHandler(async (req, res, next) => {
    const { safra_id } = req.query;
    if (!safra_id) {
      res.status(400).json({ error: 'Parâmetro safra_id é obrigatório' });
      return;
    }
    // LEFT JOIN para trazer todos os talhões, mesmo sem vínculo na safra, incluindo coordenadas do KML
    const sql = `
      SELECT 
        COALESCE(ts.id, t.id) as id,
        t.id as talhao_id,
        t.TalhaoID,
        t.TIPO,
        t.NOME as nome_talhao,
        t.NOME,
        COALESCE(ts.area, t.AREA) as AREA,
        COALESCE(ts.variedade, t.VARIEDADE) as VARIEDADE,
        COALESCE(ts.porta_enxerto, t.PORTAENXERTO) as PORTAENXERTO,
        COALESCE(ts.data_de_plantio, t.DATA_DE_PLANTIO) as DATA_DE_PLANTIO,
        COALESCE(ts.idade, t.IDADE) as IDADE,
        COALESCE(ts.falhas, t.FALHAS) as FALHAS,
        COALESCE(ts.esp, t.ESP) as ESP,
        t.COR,
        COALESCE(ts.qtde_plantas, t.qtde_plantas) as qtde_plantas,
        tk.coordinates,
        tk.placemark_name,
        COALESCE(ts.obs, t.OBS) as OBS,
        COALESCE(ts.ativo, t.ativo) as ativo
      FROM talhoes t
      LEFT JOIN talhao_safra ts ON ts.talhao_id = t.id AND ts.safra_id = ?
      LEFT JOIN talhoes_kml tk ON tk.id = t.talhao_kml_id
    `;
    const talhoesSafra = await fetchQuery<any>(sql, [safra_id]);
    res.status(200).json(talhoesSafra);
  })
);

// Buscar um talhao_safra específico
app.get(
  '/talhao_safra/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const sql = `SELECT * FROM talhao_safra WHERE id = ?`;
    const result = await fetchQuery<any>(sql, [id]);
    if (!result || result.length === 0) {
      res.status(404).json({ error: 'Talhão por safra não encontrado' });
      return;
    }
    res.status(200).json(result[0]);
  })
);

// Criar um novo talhao_safra
app.post(
  '/talhao_safra',
  asyncHandler(async (req, res, next) => {
    const {
      talhao_id,
      safra_id,
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
    if (!talhao_id || !safra_id) {
      res.status(400).json({ error: 'Campos talhao_id e safra_id são obrigatórios' });
      return;
    }
    const id = generateId();
    const sql = `
      INSERT INTO talhao_safra (id, talhao_id, safra_id, area, variedade, qtde_plantas, porta_enxerto, data_de_plantio, idade, falhas, esp, obs, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(sql, [
      id,
      talhao_id,
      safra_id,
      area || null,
      variedade || null,
      qtde_plantas || null,
      porta_enxerto || null,
      data_de_plantio || null,
      idade || null,
      falhas || null,
      esp || null,
      obs || null,
      ativo !== undefined ? (ativo ? 1 : 0) : 1
    ]);
    res.status(201).json({ message: 'Talhão por safra criado com sucesso', id });
  })
);

// Atualizar um talhao_safra existente
app.put(
  '/talhao_safra/:id',
  asyncHandler(async (req, res, next) => {
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
    const sql = `
      UPDATE talhao_safra
      SET area = ?, variedade = ?, qtde_plantas = ?, porta_enxerto = ?, data_de_plantio = ?, idade = ?, falhas = ?, esp = ?, obs = ?, ativo = ?
      WHERE id = ?
    `;
    await runQuery(sql, [
      area || null,
      variedade || null,
      qtde_plantas || null,
      porta_enxerto || null,
      data_de_plantio || null,
      idade || null,
      falhas || null,
      esp || null,
      obs || null,
      ativo !== undefined ? (ativo ? 1 : 0) : 1,
      id
    ]);
    res.status(200).json({ message: 'Talhão por safra atualizado com sucesso' });
  })
);

// Deletar um talhao_safra
app.delete(
  '/talhao_safra/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const sql = 'DELETE FROM talhao_safra WHERE id = ?';
    await runQuery(sql, [id]);
    res.status(200).json({ message: 'Talhão por safra deletado com sucesso' });
  })
);

// Endpoint para importar talhões da base ou de outra safra para uma safra específica
app.post(
  '/talhao_safra/importar',
  asyncHandler(async (req, res, next) => {
    const { safra_id, origem } = req.body; // origem pode ser 'base' ou o id de outra safra
    if (!safra_id) {
      res.status(400).json({ error: 'safra_id é obrigatório' });
      return;
    }
    let talhoesOrigem = [];
    if (origem === 'base') {
      talhoesOrigem = await fetchQuery<any>('SELECT * FROM talhoes', []);
    } else if (origem) {
      talhoesOrigem = await fetchQuery<any>(
        'SELECT t.* FROM talhao_safra ts JOIN talhoes t ON ts.talhao_id = t.id WHERE ts.safra_id = ?',
        [origem]
      );
    } else {
      res.status(400).json({ error: 'origem inválida' });
      return;
    }
    let count = 0;
    for (const talhao of talhoesOrigem) {
      // Verifica se já existe vínculo
      const existe = await fetchQuery<any>(
        'SELECT * FROM talhao_safra WHERE talhao_id = ? AND safra_id = ?',
        [talhao.id, safra_id]
      );
      if (existe.length === 0) {
        await runQuery(
          `INSERT INTO talhao_safra (id, talhao_id, safra_id, area, variedade, qtde_plantas, porta_enxerto, data_de_plantio, idade, falhas, esp, obs, ativo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            talhao.id,
            safra_id,
            talhao.AREA || null,
            talhao.VARIEDADE || null,
            talhao.qtde_plantas || null,
            talhao.PORTAENXERTO || null,
            talhao.DATA_DE_PLANTIO || null,
            talhao.IDADE || null,
            talhao.FALHAS || null,
            talhao.ESP || null,
            talhao.OBS || null,
            talhao.ativo !== undefined ? talhao.ativo : 1
          ]
        );
        count++;
      }
    }
    res.status(200).json({ message: `Importação concluída. ${count} talhões vinculados à safra.` });
  })
);

// Endpoint para importar talhões base a partir do CSV
app.post(
  '/import-talhoes-csv',
  asyncHandler(async (req, res, next) => {
    try {
      const csvPath = path.join(__dirname, '..', 'talhoes_export_2025-06-20_050444.csv');
        if (!fsSync.existsSync(csvPath)) {
        res.status(404).json({ error: 'Arquivo CSV não encontrado' });
        return;
      }

      const csvContent = fsSync.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter((line: string) => line.trim() !== '');
      const headers = lines[0].split(',');
      
      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',');
          
          // Parse dos dados do CSV
          const talhaoData = {
            id: values[0]?.trim() || generateId(),
            TalhaoID: values[1]?.trim() || null,
            TIPO: values[2]?.trim() || 'TALHAO',
            NOME: values[3]?.trim() || '',
            AREA: values[4]?.trim() || '0 ha',
            VARIEDADE: values[5]?.trim() || '',
            PORTAENXERTO: values[6]?.trim() || '',
            DATA_DE_PLANTIO: values[7]?.trim() || '',
            IDADE: parseInt(values[8]?.trim()) || 0,
            FALHAS: parseInt(values[9]?.trim()) || 0,
            ESP: values[10]?.trim() || '',
            COR: values[11]?.trim() || '#FF0000',
            qtde_plantas: parseInt(values[12]?.trim()) || 0,
            OBS: values[14]?.trim() || '',
            ativo: parseInt(values[15]?.trim()) || 1,
            talhao_kml_id: null // Será vinculado manualmente depois
          };

          // Verificar se já existe
          const existing = await fetchQuery<any>('SELECT id FROM talhoes WHERE id = ?', [talhaoData.id]);
          
          if (existing && existing.length > 0) {
            // Atualizar existente
            const updateSql = `
              UPDATE talhoes SET 
                TalhaoID = ?, TIPO = ?, NOME = ?, AREA = ?, VARIEDADE = ?, 
                PORTAENXERTO = ?, DATA_DE_PLANTIO = ?, IDADE = ?, FALHAS = ?, 
                ESP = ?, COR = ?, qtde_plantas = ?, OBS = ?, ativo = ?
              WHERE id = ?
            `;
            await runQuery(updateSql, [
              talhaoData.TalhaoID, talhaoData.TIPO, talhaoData.NOME, talhaoData.AREA,
              talhaoData.VARIEDADE, talhaoData.PORTAENXERTO, talhaoData.DATA_DE_PLANTIO,
              talhaoData.IDADE, talhaoData.FALHAS, talhaoData.ESP, talhaoData.COR,
              talhaoData.qtde_plantas, talhaoData.OBS, talhaoData.ativo, talhaoData.id
            ]);
            updatedCount++;
          } else {
            // Criar novo
            const insertSql = `
              INSERT INTO talhoes (
                id, TalhaoID, TIPO, NOME, AREA, VARIEDADE, PORTAENXERTO, 
                DATA_DE_PLANTIO, IDADE, FALHAS, ESP, COR, qtde_plantas, 
                OBS, ativo, talhao_kml_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await runQuery(insertSql, [
              talhaoData.id, talhaoData.TalhaoID, talhaoData.TIPO, talhaoData.NOME,
              talhaoData.AREA, talhaoData.VARIEDADE, talhaoData.PORTAENXERTO,
              talhaoData.DATA_DE_PLANTIO, talhaoData.IDADE, talhaoData.FALHAS,
              talhaoData.ESP, talhaoData.COR, talhaoData.qtde_plantas,
              talhaoData.OBS, talhaoData.ativo, talhaoData.talhao_kml_id
            ]);
            importedCount++;
          }
        } catch (error) {
          console.error(`Erro ao processar linha ${i + 1}:`, error);
          errors.push(`Linha ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      console.log(`Importação concluída: ${importedCount} criados, ${updatedCount} atualizados`);
      
      res.status(200).json({
        message: 'Importação concluída com sucesso',
        imported: importedCount,
        updated: updatedCount,
        errors: errors
      });
    } catch (error) {
      console.error('Erro na importação do CSV:', error);
      res.status(500).json({ 
        error: 'Erro interno na importação do CSV',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  })
);

// Endpoint para consultar talhões com cores das variedades configuradas
app.get(
  '/talhoes/com-variedades-configs',
  asyncHandler(async (req, res, next) => {
    const sql = `
      SELECT 
        t.id,
        t.TalhaoID,
        t.NOME as nome_talhao,
        t.TIPO,
        t.AREA,
        t.VARIEDADE,
        t.COR as cor_atual_talhao,
        vc.name as variedade_config_nome,
        vc.default_color as cor_configurada_variedade,
        CASE 
          WHEN vc.default_color IS NOT NULL THEN vc.default_color 
          ELSE t.COR 
        END as cor_final,
        t.IDADE,
        t.qtde_plantas,
        CASE 
          WHEN vc.id IS NOT NULL THEN 1
          ELSE 0
        END as tem_configuracao_variedade
      FROM talhoes t
      LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
      WHERE t.ativo = 1
      ORDER BY t.VARIEDADE, t.NOME
    `;
    
    const result = await fetchQuery<any>(sql, []);
    res.status(200).json(result);
  })
);

// Endpoint para estatísticas de variedades
app.get(
  '/variedades/estatisticas',
  asyncHandler(async (req, res, next) => {
    const sql = `
      SELECT 
        COALESCE(vc.name, t.VARIEDADE, 'SEM VARIEDADE') as variedade,
        vc.default_color as cor_configurada,
        COUNT(*) as total_talhoes,
        SUM(t.qtde_plantas) as total_plantas,
        ROUND(AVG(t.IDADE), 1) as idade_media,
        CASE 
          WHEN vc.id IS NOT NULL THEN 1
          ELSE 0
        END as tem_configuracao
      FROM talhoes t
      LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
      WHERE t.ativo = 1
      GROUP BY COALESCE(vc.name, t.VARIEDADE), vc.default_color, vc.id
      ORDER BY total_talhoes DESC
    `;
    
    const result = await fetchQuery<any>(sql, []);
    res.status(200).json(result);
  })
);

// Endpoint para aplicar cores das variedades configuradas aos talhões
app.put(
  '/talhoes/aplicar-cores-variedades',
  asyncHandler(async (req, res, next) => {
    console.log('Aplicando cores das variedades configuradas aos talhões...');
    
    // Primeiro, buscar quais talhões serão afetados
    const talhoesParaAtualizar = await fetchQuery<any>(`
      SELECT 
        t.id,
        t.NOME,
        t.VARIEDADE,
        t.COR as cor_atual,
        vc.default_color as cor_nova
      FROM talhoes t
      INNER JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
      WHERE t.ativo = 1 AND t.COR != vc.default_color
    `, []);
    
    if (talhoesParaAtualizar.length === 0) {
      res.status(200).json({ 
        message: 'Nenhum talhão precisa de atualização de cor',
        atualizados: 0
      });
      return;
    }
    
    // Aplicar as cores
    const updateSql = `
      UPDATE talhoes 
      SET COR = (
        SELECT vc.default_color 
        FROM variedade_configs vc 
        WHERE UPPER(TRIM(talhoes.VARIEDADE)) = UPPER(TRIM(vc.name))
      )
      WHERE EXISTS (
        SELECT 1 
        FROM variedade_configs vc 
        WHERE UPPER(TRIM(talhoes.VARIEDADE)) = UPPER(TRIM(vc.name))
      )
      AND ativo = 1
    `;
    
    await runQuery(updateSql, []);
    
    console.log(`Cores aplicadas a ${talhoesParaAtualizar.length} talhões`);
    
    res.status(200).json({ 
      message: `Cores das variedades aplicadas com sucesso a ${talhoesParaAtualizar.length} talhão(ões)`,
      atualizados: talhoesParaAtualizar.length,
      detalhes: talhoesParaAtualizar
    });
  })
);

// Iniciar o servidor após inicializar o banco de dados
const startServer = async () => {
  try {
    // TODO: Migrar para Supabase em produção
    // SQLite não funciona no Vercel (serverless)
    if (process.env.NODE_ENV !== 'production') {
      await initializeDatabase();
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to initialize database and start server:', error);
    process.exit(1);
  }
};

// Iniciar o servidor
startServer();