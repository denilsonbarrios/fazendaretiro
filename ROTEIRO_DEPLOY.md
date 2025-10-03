# 🚀 Roteiro de Deploy: Fazenda Retiro

## ✅ STATUS ATUAL
- [x] Autenticação JWT implementada
- [x] Cadastro protegido com chave
- [x] Sistema funcionando localmente
- [x] Scripts de migração criados
- [ ] Supabase configurado
- [ ] Deploy no Vercel

---

## 🎯 FASE 1: SUPABASE (15-20 minutos)

### Passo 1.1: Criar Projeto Supabase
```
⏱️ Tempo: 5 minutos

1. Acesse: https://supabase.com
2. Fazer login/criar conta (grátis)
3. Click "New Project"
4. Preencher:
   - Organization: Criar nova (seu nome/empresa)
   - Name: fazendaretiro
   - Database Password: [GERAR FORTE E GUARDAR!]
   - Region: South America (São Paulo)
   - Pricing Plan: Free
5. Click "Create new project"
6. ⏳ Aguardar 2-3 minutos (tomar café ☕)
```

**⚠️ IMPORTANTE:** Guarde a senha do banco em lugar seguro!

---

### Passo 1.2: Obter Credenciais
```
⏱️ Tempo: 2 minutos

No dashboard do projeto criado:

1. Settings (ícone de engrenagem) → API
2. Copiar e guardar:
   
   ✅ Project URL
   https://xxxxxxxxxxxxx.supabase.co
   
   ✅ Project API keys → anon public
   eyJhbGc... (longo)
   
   ✅ Project API keys → service_role (CLICAR "Reveal")
   eyJhbGc... (longo) - NUNCA EXPOR!

3. Settings → Database
4. Copiar:
   
   ✅ Connection string → URI (para referência futura)
```

**Salvar tudo em arquivo de texto temporário!**

---

### Passo 1.3: Criar Schema no Supabase
```
⏱️ Tempo: 3 minutos

1. No dashboard Supabase → SQL Editor (ícone de código)
2. Click "+ New query"
3. Copiar TODO o SQL abaixo e colar:
```

```sql
-- Criar todas as tabelas
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE safras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  data_inicial_colheita BIGINT
);

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

CREATE TABLE kml_files (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT,
  data_upload BIGINT NOT NULL,
  geojson TEXT
);

CREATE TABLE config_tipo (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

CREATE TABLE config_variedade (
  id TEXT PRIMARY KEY,
  valor TEXT UNIQUE NOT NULL
);

-- Criar índices
CREATE INDEX idx_talhao_safra_talhao ON talhao_safra(talhao_id);
CREATE INDEX idx_talhao_safra_safra ON talhao_safra(safra_id);
CREATE INDEX idx_carregamentos_talhao ON carregamentos(talhao_id);
CREATE INDEX idx_carregamentos_safra ON carregamentos(safra_id);
CREATE INDEX idx_carregamentos_data ON carregamentos(data_colheita);

-- Desabilitar RLS (usando JWT próprio)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE safras DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE talhao_safra DISABLE ROW LEVEL SECURITY;
ALTER TABLE carregamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kml_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_tipo DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_variedade DISABLE ROW LEVEL SECURITY;
```

```
4. Click "Run" (ou F5)
5. Verificar: "Success. No rows returned"
6. Conferir: Table Editor (ícone de tabela) → deve mostrar as 8 tabelas
```

---

### Passo 1.4: Configurar Credenciais Localmente
```
⏱️ Tempo: 2 minutos

Editar backend/.env:
```

```bash
# Adicionar no final do arquivo:
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...sua-service-role-key-completa
```

---

### Passo 1.5: Instalar Dependência
```
⏱️ Tempo: 2 minutos

Terminal:
cd backend
npm install @supabase/supabase-js
```

---

### Passo 1.6: Exportar Dados do SQLite
```
⏱️ Tempo: 1 minuto

Terminal (na pasta backend):
npm run export-sqlite

Resultado esperado:
✅ users: X registros
✅ safras: X registros
✅ talhoes: X registros
...
📦 Dados exportados para: sqlite-export.json
```

---

### Passo 1.7: Importar Dados para Supabase
```
⏱️ Tempo: 2 minutos

Terminal (na pasta backend):
npm run import-to-supabase

Resultado esperado:
📥 Importando users...
   ✅ Lote 1: X registros
✅ users: X registros importados
...
🎉 Migração concluída!
```

---

### Passo 1.8: Verificar no Dashboard
```
⏱️ Tempo: 1 minuto

No Supabase:
1. Table Editor → users (verificar se tem seus usuários)
2. Table Editor → safras (verificar safras)
3. Table Editor → talhoes (verificar talhões)

✅ Se tudo apareceu: SUCESSO!
❌ Se deu erro: verificar logs e repetir importação
```

---

## 🎯 FASE 2: PREPARAR PARA VERCEL (10 minutos)

### Passo 2.1: Gerar Secrets de Produção
```
⏱️ Tempo: 3 minutos

Terminal (PowerShell):

# Gerar JWT_SECRET
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$jwt_secret = [Convert]::ToBase64String($bytes)
Write-Host "JWT_SECRET=$jwt_secret"

# Copiar e guardar o resultado!

# Gerar REGISTRATION_KEY (ou criar uma personalizada)
Write-Host "REGISTRATION_KEY=FazendaRetiro@2025Seguro!"
```

**Guardar:**
- JWT_SECRET gerado
- REGISTRATION_KEY escolhida
- SUPABASE_URL (já tem)
- SUPABASE_SERVICE_KEY (já tem)

---

### Passo 2.2: Criar Conta Vercel
```
⏱️ Tempo: 3 minutos

1. Acesse: https://vercel.com
2. Sign up com GitHub (recomendado)
3. Autorizar acesso ao GitHub
4. Instalar Vercel CLI (opcional, mas recomendado):

Terminal:
npm install -g vercel

5. Login:
vercel login
```

---

### Passo 2.3: Preparar Frontend
```
⏱️ Tempo: 2 minutos

Criar arquivo: web/.env.production

VITE_API_URL=https://fazendaretiro-backend.vercel.app

(vamos ajustar a URL depois que o backend subir)
```

---

### Passo 2.4: Verificar Arquivos de Config
```
⏱️ Tempo: 2 minutos

Verificar que existem:
✅ backend/vercel.json
✅ web/vercel.json
✅ backend/.env.example
✅ web/.env.example

(Já foram criados anteriormente)
```

---

## 🎯 FASE 3: DEPLOY BACKEND (10 minutos)

### Passo 3.1: Deploy Inicial
```
⏱️ Tempo: 5 minutos

Terminal (na pasta backend):
cd backend
vercel

Responder:
? Set up and deploy "backend"? Y
? Which scope? (sua conta)
? Link to existing project? N
? What's your project's name? fazendaretiro-backend
? In which directory is your code located? ./
? Want to override the settings? N

⏳ Aguardar deploy...
✅ Production: https://fazendaretiro-backend-xxxxx.vercel.app
```

**COPIAR A URL DO BACKEND!**

---

### Passo 3.2: Configurar Environment Variables
```
⏱️ Tempo: 3 minutos

1. Acessar: https://vercel.com/dashboard
2. Selecionar projeto "fazendaretiro-backend"
3. Settings → Environment Variables
4. Adicionar (uma por vez):

   Variable Name: JWT_SECRET
   Value: [colar o JWT_SECRET gerado]
   Environments: [x] Production [x] Preview [x] Development
   → Add

   Variable Name: REGISTRATION_KEY
   Value: FazendaRetiro@2025Seguro!
   Environments: [x] Production [x] Preview [x] Development
   → Add

   Variable Name: SUPABASE_URL
   Value: [colar URL do Supabase]
   Environments: [x] Production [x] Preview [x] Development
   → Add

   Variable Name: SUPABASE_SERVICE_KEY
   Value: [colar service_role key do Supabase]
   Environments: [x] Production [x] Preview [x] Development
   → Add

   Variable Name: NODE_ENV
   Value: production
   Environments: [x] Production
   → Add
```

---

### Passo 3.3: Re-deploy Backend
```
⏱️ Tempo: 2 minutos

Terminal (na pasta backend):
vercel --prod

Ou pelo dashboard:
Deployments → ... (três pontinhos) → Redeploy

✅ Aguardar novo deploy com variáveis configuradas
```

---

### Passo 3.4: Testar Backend
```
⏱️ Tempo: 2 minutos

Terminal:
curl https://fazendaretiro-backend-xxxxx.vercel.app/auth/verify

Esperado: {"error":"Token não fornecido"}
✅ Backend funcionando!

Testar cadastro:
curl -X POST https://fazendaretiro-backend-xxxxx.vercel.app/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"teste\",\"password\":\"senha123\",\"nome\":\"Teste\",\"registrationKey\":\"FazendaRetiro@2025Seguro!\"}"

Esperado: {"message":"Usuário criado com sucesso"}
✅ Cadastro funcionando!
```

---

## 🎯 FASE 4: DEPLOY FRONTEND (10 minutos)

### Passo 4.1: Atualizar CORS no Backend
```
⏱️ Tempo: 3 minutos

Editar: backend/server.ts

Localizar:
const allowedOrigins = [
  'http://localhost:5173',
  ...
];

Adicionar a URL do frontend que será gerada:
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:4173',
  'https://fazendaretiro.vercel.app',
  'https://fazendaretiro-xxxxx.vercel.app', // Wildcards da Vercel
];

Commit e push:
git add .
git commit -m "Add production CORS origins"
git push

Re-deploy backend:
cd backend
vercel --prod
```

---

### Passo 4.2: Criar .env.production
```
⏱️ Tempo: 1 minuto

Editar: web/.env.production

VITE_API_URL=https://fazendaretiro-backend-xxxxx.vercel.app

(usar a URL real do backend)
```

---

### Passo 4.3: Deploy Frontend
```
⏱️ Tempo: 5 minutos

Terminal (na pasta web):
cd web
vercel

Responder:
? Set up and deploy "web"? Y
? Which scope? (sua conta)
? Link to existing project? N
? What's your project's name? fazendaretiro
? In which directory is your code located? ./
? Want to override the settings? N

⏳ Aguardar deploy...
✅ Production: https://fazendaretiro-xxxxx.vercel.app
```

**COPIAR A URL DO FRONTEND!**

---

### Passo 4.4: Configurar Environment Variable
```
⏱️ Tempo: 2 minutos

1. Dashboard Vercel → projeto "fazendaretiro" (frontend)
2. Settings → Environment Variables
3. Adicionar:

   Variable Name: VITE_API_URL
   Value: https://fazendaretiro-backend-xxxxx.vercel.app
   Environments: [x] Production [x] Preview [x] Development
   → Add
```

---

### Passo 4.5: Re-deploy Frontend
```
⏱️ Tempo: 2 minutos

Terminal:
vercel --prod

✅ Aguardar deploy final
```

---

## 🎯 FASE 5: AJUSTES FINAIS (5 minutos)

### Passo 5.1: Atualizar CORS com URL Real
```
⏱️ Tempo: 3 minutos

Agora que tem a URL real do frontend:

1. Editar: backend/server.ts
2. Adicionar URL exata:

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:4173',
  'https://fazendaretiro-xxxxx.vercel.app', // URL REAL
];

3. Commit e push:
git add .
git commit -m "Update CORS with real frontend URL"
git push

4. Re-deploy backend:
cd backend
vercel --prod
```

---

### Passo 5.2: Testar Produção
```
⏱️ Tempo: 5 minutos

1. Acessar: https://fazendaretiro-xxxxx.vercel.app
2. Verificar tela de login carrega
3. Abrir DevTools (F12) → Console
4. Não deve ter erros de CORS
5. Tentar cadastrar:
   - Nome: Seu Nome
   - Usuário: seu_usuario
   - Senha: senha_forte
   - Chave: FazendaRetiro@2025Seguro!
6. Fazer login
7. Testar navegação:
   - Mapa
   - Talhões
   - Colheita
   - KML
   - Config
8. Fazer logout

✅ Tudo funcionando? SUCESSO! 🎉
```

---

## 🎯 FASE 6: DOMÍNIO CUSTOM (OPCIONAL)

### Se quiser usar domínio próprio:
```
1. Comprar domínio (ex: fazendaretiro.com)
2. Dashboard Vercel → Projeto Frontend → Settings → Domains
3. Add Domain → fazendaretiro.com
4. Configurar DNS conforme instruções
5. Adicionar domínio no CORS do backend
6. Re-deploy backend
```

---

## ✅ CHECKLIST FINAL

- [ ] Supabase: Projeto criado
- [ ] Supabase: Schema executado
- [ ] Supabase: Dados migrados
- [ ] Backend: Deploy feito
- [ ] Backend: Environment variables configuradas
- [ ] Backend: Testado (auth/verify retorna erro esperado)
- [ ] Frontend: Deploy feito
- [ ] Frontend: Environment variable configurada
- [ ] CORS: URLs de produção adicionadas
- [ ] Teste E2E: Cadastro funcionando
- [ ] Teste E2E: Login funcionando
- [ ] Teste E2E: Navegação funcionando
- [ ] Teste E2E: Logout funcionando

---

## 📊 RESUMO DE URLs E SECRETS

**Guardar em lugar seguro:**

```
SUPABASE:
- URL: https://xxxxx.supabase.co
- Service Key: eyJhbGc...
- Database Password: ********

VERCEL:
- Backend: https://fazendaretiro-backend-xxxxx.vercel.app
- Frontend: https://fazendaretiro-xxxxx.vercel.app

SECRETS:
- JWT_SECRET: ************************
- REGISTRATION_KEY: FazendaRetiro@2025Seguro!
```

---

## 🆘 TROUBLESHOOTING

### Erro de CORS
```
Sintoma: Console mostra "blocked by CORS policy"
Solução: 
1. Verificar URL do frontend no allowedOrigins
2. Não esquecer https:// no início
3. Não colocar / no final
4. Re-deploy backend após alterar
```

### Erro 500 no backend
```
Sintoma: Requisições retornam 500
Solução:
1. Dashboard Vercel → Backend → Deployments → View Function Logs
2. Verificar erro específico
3. Geralmente: environment variable faltando
4. Adicionar e re-deploy
```

### Login não funciona em produção
```
Sintoma: Login funciona local mas não em produção
Solução:
1. Verificar SUPABASE_URL e SUPABASE_SERVICE_KEY no Vercel
2. Verificar se dados foram importados (Table Editor)
3. Verificar logs do backend
```

### Frontend não carrega
```
Sintoma: Tela branca ou erro
Solução:
1. F12 → Console (ver erro)
2. Verificar VITE_API_URL configurada
3. Testar URL do backend manualmente
4. Re-deploy frontend
```

---

## 🎉 FIM!

**Tempo total estimado: ~50-60 minutos**

Deploy completo com:
✅ Banco de dados robusto (Supabase)
✅ Backend serverless (Vercel)
✅ Frontend otimizado (Vercel)
✅ Autenticação segura (JWT + chave de registro)
✅ HTTPS automático
✅ Backups automáticos
✅ Escalável

**Próximos passos futuros:**
- Configurar domínio customizado
- Monitorar uso no dashboard
- Adicionar mais funcionalidades
- Configurar alertas de erro
