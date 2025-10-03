import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Verificar se as variáveis de ambiente estão configuradas
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar configurados no .env');
}

// Criar cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase configurado e pronto para usar');

/**
 * Converte query SQLite para Supabase query
 * Parsing básico de SQL para converter para chamadas Supabase
 */
function parseSQL(sql: string, params: any[]): { 
  table: string; 
  operation: string; 
  columns?: string[];
  whereColumn?: string;
  whereValue?: any;
  orderBy?: { column: string; ascending: boolean };
} {
  const sqlLower = sql.toLowerCase().trim();
  
  // SELECT
  if (sqlLower.startsWith('select')) {
    const tableMatch = sql.match(/from\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    
    // Parse WHERE
    let whereColumn: string | undefined;
    let whereValue: any;
    const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      whereColumn = whereMatch[1];
      whereValue = params[0];
    }
    
    // Parse ORDER BY
    let orderBy: { column: string; ascending: boolean } | undefined;
    const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
    if (orderMatch) {
      orderBy = {
        column: orderMatch[1],
        ascending: !orderMatch[2] || orderMatch[2].toLowerCase() === 'asc'
      };
    }
    
    return { table, operation: 'select', whereColumn, whereValue, orderBy };
  }
  
  // INSERT
  if (sqlLower.startsWith('insert')) {
    const tableMatch = sql.match(/into\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    
    // Parse columns
    const columnsMatch = sql.match(/\(([^)]+)\)/);
    const columns = columnsMatch 
      ? columnsMatch[1].split(',').map(c => c.trim()) 
      : [];
    
    return { table, operation: 'insert', columns };
  }
  
  // UPDATE
  if (sqlLower.startsWith('update')) {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    
    // Parse WHERE para UPDATE
    const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
    let whereColumn: string | undefined;
    if (whereMatch) {
      // O último parâmetro é geralmente o WHERE em UPDATEs
      whereColumn = whereMatch[1];
    }
    
    return { table, operation: 'update', whereColumn };
  }
  
  // DELETE
  if (sqlLower.startsWith('delete')) {
    const tableMatch = sql.match(/from\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    
    const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
    const whereColumn = whereMatch ? whereMatch[1] : undefined;
    
    return { table, operation: 'delete', whereColumn };
  }
  
  throw new Error(`SQL não suportado: ${sql}`);
}

/**
 * Executa uma query SELECT e retorna múltiplos resultados
 */
export async function fetchQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const parsed = parseSQL(sql, params);
    
    let query = supabase.from(parsed.table).select('*');
    
    // Aplicar WHERE
    if (parsed.whereColumn && parsed.whereValue !== undefined) {
      query = query.eq(parsed.whereColumn, parsed.whereValue);
    }
    
    // Aplicar ORDER BY
    if (parsed.orderBy) {
      query = query.order(parsed.orderBy.column, { ascending: parsed.orderBy.ascending });
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro Supabase [${parsed.table}]:`, error.message);
      throw new Error(`Erro ao buscar dados: ${error.message}`);
    }
    
    return (data || []) as T[];
  } catch (error) {
    console.error(`❌ Erro ao executar query: ${sql}`, error);
    throw error;
  }
}

/**
 * Executa uma query INSERT, UPDATE ou DELETE
 */
export async function runQuery(sql: string, params: any[] = []): Promise<void> {
  try {
    const parsed = parseSQL(sql, params);
    
    if (parsed.operation === 'insert') {
      // Montar objeto de dados
      const data: any = {};
      if (parsed.columns) {
        parsed.columns.forEach((col, idx) => {
          data[col] = params[idx];
        });
      }
      
      const { error } = await supabase.from(parsed.table).insert(data);
      
      if (error) {
        console.error(`❌ Erro Supabase INSERT [${parsed.table}]:`, error.message);
        throw new Error(`Erro ao inserir dados: ${error.message}`);
      }
    } 
    else if (parsed.operation === 'update') {
      // Para UPDATE, os últimos parâmetros são geralmente os valores SET, 
      // e o último é o WHERE
      const whereValue = params[params.length - 1];
      const setValues = params.slice(0, -1);
      
      // Parse SET clause
      const setMatch = sql.match(/set\s+(.+?)\s+where/i);
      if (!setMatch) {
        throw new Error('UPDATE sem SET clause');
      }
      
      const setClause = setMatch[1];
      const setColumns = setClause.split(',').map(part => {
        const [col] = part.split('=').map(s => s.trim());
        return col;
      });
      
      const data: any = {};
      setColumns.forEach((col, idx) => {
        data[col] = setValues[idx];
      });
      
      if (!parsed.whereColumn) {
        throw new Error('UPDATE sem WHERE não é permitido');
      }
      
      const { error } = await supabase
        .from(parsed.table)
        .update(data)
        .eq(parsed.whereColumn, whereValue);
      
      if (error) {
        console.error(`❌ Erro Supabase UPDATE [${parsed.table}]:`, error.message);
        throw new Error(`Erro ao atualizar dados: ${error.message}`);
      }
    } 
    else if (parsed.operation === 'delete') {
      if (!parsed.whereColumn) {
        throw new Error('DELETE sem WHERE não é permitido');
      }
      
      const { error } = await supabase
        .from(parsed.table)
        .delete()
        .eq(parsed.whereColumn, params[0]);
      
      if (error) {
        console.error(`❌ Erro Supabase DELETE [${parsed.table}]:`, error.message);
        throw new Error(`Erro ao deletar dados: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao executar comando: ${sql}`, error);
    throw error;
  }
}

/**
 * Gera um ID único (compatível com o formato do SQLite)
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Inicializa o banco de dados
 */
export async function initializeDatabase(): Promise<void> {
  console.log('✅ Supabase inicializado e pronto');
  
  // Testar conexão
  try {
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = tabela não existe (ok para primeira vez)
      console.warn('⚠️ Aviso ao testar conexão:', error.message);
    } else {
      console.log('✅ Conexão com Supabase verificada');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar conexão com Supabase:', error);
  }
}
