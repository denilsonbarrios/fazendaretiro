# Migração SQLite → Supabase

## 🎯 Por que Supabase?

- ✅ PostgreSQL completo (mais robusto que SQLite)
- ✅ Interface visual para gerenciar dados
- ✅ Backups automáticos
- ✅ Row Level Security (RLS)
- ✅ Realtime subscriptions
- ✅ Storage para arquivos (KML)
- ✅ Auth integrado (pode substituir nosso JWT futuramente)
- ✅ Free tier generoso: 500MB database, 1GB file storage

## 📋 Passo 1: Configurar Supabase

### 1.1 Criar Projeto
1. Acesse https://supabase.com
2. Crie uma conta (grátis)
3. Click em "New Project"
4. Preencha:
   - Name: `fazendaretiro`
   - Database Password: **GUARDE BEM!**
   - Region: South America (São Paulo) - mais próximo do Brasil
5. Aguarde ~2 minutos (criação do projeto)

### 1.2 Obter Credenciais
1. No dashboard do projeto, vá em **Settings** > **API**
2. Anote:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Para frontend (pode expor)
   - **service_role key**: Para backend (NUNCA expor!)
3. Em **Settings** > **Database**, anote:
   - **Connection string** (modo direto)

## 📦 Passo 2: Instalar Dependências

```bash
cd backend
npm install @supabase/supabase-js
npm install --save-dev @types/node
```

## 🗄️ Passo 3: Criar Schema no Supabase

### Opção A: Via Interface SQL Editor

1. No dashboard Supabase, vá em **SQL Editor**
2. Click em **New Query**
3. Cole o script abaixo:

```sql
-- Tabela de usuários
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Tabela de safras
CREATE TABLE safras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  data_inicial_colheita BIGINT
);

-- Tabela de talhões base
CREATE TABLE talhoes (
  "TalhaoID" TEXT PRIMARY KEY,
  "NOME" TEXT NOT NULL,
  "AREA" REAL,
  "VARIEDADE" TEXT,
  "TIPO" TEXT,
  "ANO_PLANTIO" INTEGER,
  "ESPACAMENTO" TEXT,
  "geometry" TEXT
);

-- Tabela de talhões por safra
CREATE TABLE talhao_safra (
  id TEXT PRIMARY KEY,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  area REAL,
  variedade TEXT,
  tipo TEXT,
  ano_plantio INTEGER,
  espacamento TEXT,
  FOREIGN KEY (talhao_id) REFERENCES talhoes("TalhaoID") ON DELETE CASCADE,
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE,
  UNIQUE(talhao_id, safra_id)
);

-- Tabela de carregamentos
CREATE TABLE carregamentos (
  id TEXT PRIMARY KEY,
  talhao_id TEXT NOT NULL,
  safra_id TEXT NOT NULL,
  data_colheita BIGINT NOT NULL,
  quantidade REAL NOT NULL,
  unidade TEXT DEFAULT 'kg',
  observacoes TEXT,
  FOREIGN KEY (talhao_id) REFERENCES talhoes("TalhaoID") ON DELETE CASCADE,
  FOREIGN KEY (safra_id) REFERENCES safras(id) ON DELETE CASCADE
);

-- Tabela de arquivos KML
CREATE TABLE kml_files (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT,
  data_upload BIGINT NOT NULL,
  geojson TEXT
);

-- Tabela de configurações de tipo
CREATE TABLE config_tipo (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

-- Tabela de configurações de variedade
CREATE TABLE config_variedade (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

-- Índices para performance
CREATE INDEX idx_talhao_safra_talhao ON talhao_safra(talhao_id);
CREATE INDEX idx_talhao_safra_safra ON talhao_safra(safra_id);
CREATE INDEX idx_carregamentos_talhao ON carregamentos(talhao_id);
CREATE INDEX idx_carregamentos_safra ON carregamentos(safra_id);
CREATE INDEX idx_carregamentos_data ON carregamentos(data_colheita);

-- Row Level Security (desabilitar por enquanto, usar JWT)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE safras DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhao_safra DISABLE ROW LEVEL SECURITY;
ALTER TABLE carregamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kml_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_tipo DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_variedade DISABLE ROW LEVEL SECURITY;
```

4. Click em **Run** (executar)

### Opção B: Via Script (após configurar conexão)

Criar arquivo `backend/supabase-schema.sql` com o conteúdo acima e executar via script de migração.

## 🔄 Passo 4: Exportar Dados do SQLite

Criar arquivo `backend/export-sqlite-data.ts`:

```typescript
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Já está criado! Use o comando:
// npm run export-sqlite
```

Executar:
```bash
cd backend
npm run export-sqlite
```

Isso criará `sqlite-export.json` com todos os dados.

## ⬆️ Passo 5: Importar Dados para Supabase

Criar arquivo `backend/import-to-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// CONFIGURAR AQUI
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxxxx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sua-service-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importData() {
  // Ler dados exportados
  const dataPath = path.join(__dirname, 'sqlite-export.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Ordem de importação (respeitar foreign keys)
  const importOrder = [
    'users',
    'safras',
    'talhoes',
    'talhao_safra',
    'carregamentos',
    'kml_files',
    'config_tipo',
    'config_variedade'
  ];

  for (const tableName of importOrder) {
    const rows = data[tableName] || [];
    
    if (rows.length === 0) {
      console.log(`⏭️  ${tableName}: sem dados para importar`);
      continue;
    }

    console.log(`\n📥 Importando ${tableName}...`);

    // Importar em lotes de 100
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(batch);

      if (error) {
        console.error(`❌ Erro em ${tableName} (lote ${i}-${i+batchSize}):`, error.message);
      } else {
        console.log(`   ✅ Importados ${batch.length} registros`);
      }
    }

    console.log(`✅ ${tableName}: ${rows.length} registros importados`);
  }

  console.log('\n🎉 Migração concluída!');
}

importData().catch(console.error);
```

Configurar `.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=sua-service-role-key-aqui
```

Executar:
```bash
cd backend
npx ts-node import-to-supabase.ts
```

## 🔧 Passo 6: Atualizar db.ts para Supabase

Criar novo arquivo `backend/db-supabase.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios!');
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper para executar queries SQL diretas (se necessário)
export async function executeSql(query: string, params?: any[]) {
  const { data, error } = await supabase.rpc('execute_sql', {
    query,
    params
  });
  
  if (error) throw error;
  return data;
}

console.log('✅ Supabase conectado');
```

## 🔄 Passo 7: Adaptar Queries do Server

Exemplos de conversão:

### SQLite (antes):
```typescript
const users = db.prepare('SELECT * FROM users WHERE username = ?').all(username);
```

### Supabase (depois):
```typescript
const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .eq('username', username);

if (error) throw error;
```

### INSERT:
```typescript
// SQLite
db.prepare('INSERT INTO safras (id, nome, is_active) VALUES (?, ?, ?)').run(id, nome, is_active);

// Supabase
const { data, error } = await supabase
  .from('safras')
  .insert({ id, nome, is_active });
```

### UPDATE:
```typescript
// SQLite
db.prepare('UPDATE safras SET nome = ? WHERE id = ?').run(nome, id);

// Supabase
const { data, error } = await supabase
  .from('safras')
  .update({ nome })
  .eq('id', id);
```

### DELETE:
```typescript
// SQLite
db.prepare('DELETE FROM safras WHERE id = ?').run(id);

// Supabase
const { data, error } = await supabase
  .from('safras')
  .delete()
  .eq('id', id);
```

## 📝 Passo 8: Atualizar .env

```
# Backend
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...sua-key-aqui
JWT_SECRET=seu-jwt-secret
PORT=3000

# Manter DATABASE_PATH para migração gradual (opcional)
DATABASE_PATH=./fazendaretiro.db
```

## ✅ Checklist de Migração

- [ ] Criar projeto no Supabase
- [ ] Guardar credenciais em local seguro
- [ ] Executar schema SQL no Supabase
- [ ] Instalar @supabase/supabase-js
- [ ] Exportar dados do SQLite (export-sqlite-data.ts)
- [ ] Importar dados no Supabase (import-to-supabase.ts)
- [ ] Verificar dados no dashboard Supabase
- [ ] Criar db-supabase.ts
- [ ] Atualizar server.ts para usar Supabase
- [ ] Testar localmente com Supabase
- [ ] Atualizar variáveis no Vercel
- [ ] Deploy e testar em produção

## 🎯 Vantagens da Migração

- ✅ Banco persistente na nuvem
- ✅ Backups automáticos
- ✅ Escalável (pode crescer sem problemas)
- ✅ Interface visual para gerenciar dados
- ✅ APIs REST e GraphQL automáticas
- ✅ Logs de queries
- ✅ Não precisa se preocupar com storage do Vercel

## 💡 Próximos Passos (Futuro)

Depois que estiver estável:
- [ ] Migrar autenticação para Supabase Auth (mais robusto)
- [ ] Usar Supabase Storage para arquivos KML
- [ ] Implementar Row Level Security (RLS)
- [ ] Adicionar Realtime para updates ao vivo

## 🆘 Troubleshooting

### Erro de conexão:
- Verificar SUPABASE_URL e SUPABASE_SERVICE_KEY
- Verificar se IP está permitido (padrão: todos IPs permitidos)

### Erro de foreign key:
- Importar na ordem correta (users/safras/talhoes primeiro)
- Verificar se IDs existem nas tabelas referenciadas

### Performance lenta:
- Verificar índices criados
- Usar .select() com campos específicos ao invés de *
- Limitar resultados com .limit()
