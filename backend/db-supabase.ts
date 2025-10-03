import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar configurados no .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Funções helper para manter compatibilidade com código SQLite

export async function query(sql: string, params: any[] = []): Promise<any> {
  // Esta é uma função placeholder - Supabase usa API REST, não SQL direto
  throw new Error('Use o cliente supabase diretamente para queries');
}

export async function run(sql: string, params: any[] = []): Promise<any> {
  // Esta é uma função placeholder
  throw new Error('Use o cliente supabase diretamente para operações');
}

export async function get(sql: string, params: any[] = []): Promise<any> {
  // Esta é uma função placeholder
  throw new Error('Use o cliente supabase diretamente para queries');
}

export async function all(sql: string, params: any[] = []): Promise<any[]> {
  // Esta é uma função placeholder
  throw new Error('Use o cliente supabase diretamente para queries');
}
