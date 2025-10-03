# Deploy no Vercel - Fazenda Retiro

## 📦 Preparação para Deploy

### Arquitetura
- **Frontend**: Vercel (hospedagem estática)
- **Backend**: Vercel Serverless Functions
- **Banco de Dados**: SQLite (considerar migrar para PostgreSQL ou Turso)

## ⚠️ Importante: SQLite no Vercel

O Vercel usa funções serverless que são **stateless** e **efêmeras**. SQLite não é ideal para produção no Vercel porque:
- Cada função cria sua própria instância
- Alterações no banco não persistem entre invocações
- Não há sistema de arquivos persistente

### Opções de Banco para Produção:

1. **Turso (SQLite na nuvem)** - Recomendado
   - Compatível com SQLite
   - Migração mais fácil
   - Grátis até 500MB
   - Site: https://turso.tech

2. **Vercel Postgres**
   - Integração nativa
   - Requer mudança de queries

3. **PlanetScale** (MySQL)
   - Escalável
   - Requer mudança de SQL

## 🔧 Configuração do Backend

### 1. Criar `vercel.json` na raiz do backend:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2. Atualizar `package.json` do backend:
Adicionar script de build:
```json
{
  "scripts": {
    "start": "ts-node server.ts",
    "build": "tsc",
    "vercel-build": "npm run build"
  }
}
```

### 3. Configurar variáveis de ambiente no Vercel:
No dashboard da Vercel, adicionar:
- `JWT_SECRET`: Sua chave secreta (gerar nova para produção)
- `DATABASE_URL`: URL do banco (se usar Turso/Postgres)
- `NODE_ENV`: production

### 4. Atualizar CORS no `server.ts`:
```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'https://seu-app.vercel.app', // Adicionar URL do frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  // ... resto das configurações
}));
```

## 🎨 Configuração do Frontend

### 1. Criar `.env.production` na pasta web:
```
VITE_API_URL=https://seu-backend.vercel.app
```

### 2. Atualizar `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
```

### 3. Criar `vercel.json` na pasta web:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

## 🚀 Deploy

### Backend:
```bash
cd backend
npm install -g vercel
vercel login
vercel
# Seguir instruções, escolher nome do projeto
vercel --prod
```

### Frontend:
```bash
cd web
vercel
# Seguir instruções
# Anotar URL gerada (ex: fazendaretiro.vercel.app)
vercel --prod
```

## 🔄 Atualizar Configurações

1. Copie a URL do backend gerada pelo Vercel
2. Adicione no `.env.production` do frontend
3. Re-deploy do frontend:
```bash
cd web
vercel --prod
```

4. Copie a URL do frontend
5. Adicione no CORS do backend
6. Re-deploy do backend:
```bash
cd backend
vercel --prod
```

## ✅ Validação Pós-Deploy

1. Acesse a URL do frontend
2. Crie um usuário de teste
3. Faça login
4. Teste todas as funcionalidades
5. Verifique logs no dashboard da Vercel

## 🔐 Segurança em Produção

- ✅ Gerar novo JWT_SECRET (usar: `openssl rand -base64 32`)
- ✅ Usar HTTPS (automático no Vercel)
- ✅ Configurar CORS apenas para domínios conhecidos
- ✅ Habilitar rate limiting (considerar Vercel Edge Config)
- ✅ Monitorar logs de erro

## 📊 Migração para Turso (Recomendado)

### 1. Criar conta no Turso:
```bash
brew install chiselstrike/tap/turso  # Mac
# ou baixar de https://docs.turso.tech/cli/installation

turso auth signup
turso db create fazendaretiro
turso db show fazendaretiro --url
```

### 2. Instalar driver:
```bash
cd backend
npm install @libsql/client
```

### 3. Atualizar `db.ts`:
```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

export const db = client;
```

### 4. Adicionar variáveis no Vercel:
- `TURSO_DATABASE_URL`: URL do banco Turso
- `TURSO_AUTH_TOKEN`: Token de autenticação

## 🎯 Checklist Final

- [ ] Backend deployado no Vercel
- [ ] Frontend deployado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] CORS atualizado com URLs de produção
- [ ] Banco de dados em produção (Turso/Postgres)
- [ ] Teste de cadastro funcionando
- [ ] Teste de login funcionando
- [ ] Teste de rotas protegidas funcionando
- [ ] Logout funcionando
- [ ] Logs sendo monitorados

## 📝 Notas Importantes

1. **Primeiro Deploy**: Pode levar alguns minutos
2. **Domínio Customizado**: Configurar no dashboard da Vercel
3. **Limites do Free Tier**: 
   - 100GB bandwidth/mês
   - 100 serverless function invocations/dia
   - Suficiente para começar
4. **Backup**: Fazer backup regular do banco de dados

## 🆘 Troubleshooting

### Erro de CORS:
- Verificar URL do frontend no CORS do backend
- Verificar se não tem `/` no final da URL

### Erro 500 no backend:
- Checar logs no dashboard Vercel
- Verificar variáveis de ambiente
- Verificar conexão com banco

### Token não persiste:
- Verificar se localStorage funciona
- Verificar HTTPS (required for secure cookies)

### Build falha:
- Verificar todas as dependências no package.json
- Verificar tsconfig.json
- Rodar `npm run build` localmente primeiro
