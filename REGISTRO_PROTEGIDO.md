# 🔐 Guia Rápido: Cadastro Protegido + Supabase

## ✅ O que foi implementado

### 1. Cadastro Protegido com Chave
- ✅ Campo "Chave de Registro" obrigatório no cadastro
- ✅ Backend valida a chave antes de criar usuário
- ✅ Chave configurável via variável de ambiente `REGISTRATION_KEY`
- ✅ Mensagem clara quando chave é inválida

### Como usar:
1. Defina a chave no `backend/.env`: `REGISTRATION_KEY=suachaveaqui`
2. Compartilhe a chave apenas com usuários autorizados
3. Usuários precisam digitar a chave ao se cadastrar

### Em produção (Vercel):
- Configure `REGISTRATION_KEY` nas Environment Variables do Vercel
- Use uma chave forte e única (ex: `fazendaretiro@2025!secure`)
- Altere a chave se houver suspeita de vazamento

---

## 📦 Migração para Supabase

### Por que Supabase?
- ✅ PostgreSQL robusto (melhor que SQLite)
- ✅ Interface visual para gerenciar dados
- ✅ Backups automáticos
- ✅ Escalável
- ✅ Free tier generoso (500MB)
- ✅ Funciona perfeitamente no Vercel

### Passo a Passo Rápido:

#### 1. Criar Projeto no Supabase
```bash
1. Acesse https://supabase.com
2. Criar conta (grátis)
3. New Project → Nome: fazendaretiro
4. Escolher região: South America (São Paulo)
5. Aguardar ~2 minutos
```

#### 2. Executar Schema SQL
```sql
-- No dashboard Supabase: SQL Editor > New Query
-- Cole o schema completo do arquivo MIGRACAO_SUPABASE.md
-- Seção "Criar Schema no Supabase"
-- Clique em Run
```

#### 3. Instalar Dependência
```bash
cd backend
npm install @supabase/supabase-js
```

#### 4. Configurar Credenciais
Adicionar no `backend/.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...sua-key-aqui
```

Para obter as credenciais:
- Dashboard Supabase → Settings → API
- Copiar "Project URL" e "service_role secret"

#### 5. Exportar Dados do SQLite
```bash
cd backend
npm run export-sqlite
```

Isso cria `sqlite-export.json` com todos os dados.

#### 6. Importar para Supabase
```bash
npm run import-to-supabase
```

Aguarde a importação completar. Verifique os dados no dashboard do Supabase.

#### 7. Atualizar Backend (Futuro)
Quando tudo estiver validado, migrar queries do SQLite para Supabase.
Ver guia completo em `MIGRACAO_SUPABASE.md`.

---

## 🎯 Configuração Recomendada

### Desenvolvimento (.env local)
```
JWT_SECRET=fazenda-retiro-secret-2025-development-key
REGISTRATION_KEY=fazendaretiro2025
PORT=3000
DATABASE_PATH=./fazendaretiro.db
```

### Produção (Vercel Environment Variables)
```
JWT_SECRET=[gerar novo: openssl rand -base64 32]
REGISTRATION_KEY=[chave forte única]
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=[service role key do Supabase]
NODE_ENV=production
```

---

## 📋 Checklist de Segurança

- [ ] Chave de registro definida no .env
- [ ] Chave diferente para dev e produção
- [ ] Chave compartilhada apenas com usuários autorizados
- [ ] .env adicionado no .gitignore (já está)
- [ ] JWT_SECRET forte gerado para produção
- [ ] Supabase service_role key nunca exposta no frontend
- [ ] CORS configurado apenas para domínios conhecidos

---

## 🆘 Perguntas Frequentes

### Como adicionar novo usuário?
1. Fornecer a chave de registro (`REGISTRATION_KEY`) ao novo usuário
2. Usuário acessa o sistema e clica em "Cadastre-se"
3. Preenche nome, usuário, senha e **chave de registro**
4. Sistema valida e cria a conta

### Como alterar a chave de registro?
1. Atualizar `REGISTRATION_KEY` no `.env` (local) ou Vercel (produção)
2. Reiniciar servidor (ou re-deploy no Vercel)
3. Informar nova chave aos usuários autorizados

### E se a chave vazar?
1. Gerar nova chave imediatamente
2. Atualizar no ambiente de produção
3. Comunicar nova chave aos usuários legítimos
4. Monitorar tentativas de cadastro inválidas

### Como desabilitar cadastros temporariamente?
1. Definir `REGISTRATION_KEY` com valor impossível de adivinhar
2. Ou comentar a rota `/auth/register` no server.ts

### Quando migrar para Supabase?
- **Agora**: Se já tem dados importantes e quer backups automáticos
- **Antes do deploy**: Recomendado para evitar problemas de persistência no Vercel
- **Depois**: Se quiser validar tudo funcionando com SQLite primeiro

---

## 📞 Suporte

### Teste de Cadastro Local
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"teste",
    "password":"senha123",
    "nome":"Usuario Teste",
    "registrationKey":"fazendaretiro2025"
  }'
```

### Teste de Cadastro com Chave Errada
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"teste",
    "password":"senha123",
    "nome":"Usuario Teste",
    "registrationKey":"chave-errada"
  }'
```

Deve retornar: `{"error": "Chave de registro inválida..."}`

---

## ✨ Próximos Passos

1. ✅ **Testar cadastro protegido localmente**
2. ✅ **Criar projeto no Supabase**
3. ✅ **Executar schema SQL**
4. ✅ **Exportar dados do SQLite**
5. ✅ **Importar para Supabase**
6. ⏳ **Migrar queries para Supabase** (ver MIGRACAO_SUPABASE.md)
7. ⏳ **Deploy no Vercel com Supabase**
8. ⏳ **Testar em produção**

**Documentação completa:** `MIGRACAO_SUPABASE.md`
