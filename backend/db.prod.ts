// Módulo vazio para compatibilidade com Vercel
// Em produção, usamos Supabase diretamente
export const initializeDatabase = async () => {
  console.log('SQLite não disponível em produção - usando Supabase');
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 11);
};

export const runQuery = async () => {
  throw new Error('runQuery não disponível em produção. Use Supabase.');
};

export const fetchQuery = async () => {
  throw new Error('fetchQuery não disponível em produção. Use Supabase.');
};
