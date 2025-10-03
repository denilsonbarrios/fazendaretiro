# ✅ Checklist de Deploy - Fazenda Retiro

## 📋 Pré-Deploy

### Desenvolvimento
- [x] Sistema de autenticação implementado
- [x] Todas as rotas protegidas
- [x] Frontend integrado com backend
- [x] Variáveis de ambiente configuradas
- [x] CORS configurado
- [x] .gitignore atualizado
- [x] Documentação criada

### Testes Locais
- [ ] Criar usuário funciona
- [ ] Login funciona
- [ ] Token persiste após reload
- [ ] Logout funciona
- [ ] Rotas protegidas retornam 401 sem token
- [ ] Todas as páginas funcionam (Mapa, Talhões, Colheita, KML, Config)
- [ ] Upload de KML funciona
- [ ] CRUD de talhões funciona
- [ ] CRUD de safras funciona

## 🔐 Segurança

### Secrets
- [ ] Gerar novo JWT_SECRET para produção (`openssl rand -base64 32`)
- [ ] NUNCA commitar .env real no Git
- [ ] Confirmar que .env está no .gitignore
- [ ] Guardar JWT_SECRET em local seguro (password manager)

### CORS
- [ ] Configurar CORS para aceitar apenas domínios conhecidos
- [ ] Adicionar URL do frontend de produção na lista allowedOrigins
- [ ] Testar que outros domínios são bloqueados

## 🗄️ Banco de Dados

### Decisão de Banco
- [ ] Decidir entre Turso / Vercel Postgres / PlanetScale
- [ ] Se Turso: Criar conta e database
- [ ] Se Vercel Postgres: Configurar no dashboard
- [ ] Exportar dados de desenvolvimento se necessário

### Migration (se mudar de SQLite)
- [ ] Backup do banco atual
- [ ] Instalar driver do novo banco
- [ ] Atualizar db.ts com novo cliente
- [ ] Testar conexão local
- [ ] Migrar estrutura de tabelas
- [ ] Migrar dados se necessário

## 🚀 Deploy Backend

### Preparação
- [ ] Instalar Vercel CLI: `npm install -g vercel`
- [ ] Login no Vercel: `vercel login`
- [ ] Verificar vercel.json criado
- [ ] Adicionar script de build no package.json

### Deploy
- [ ] `cd backend`
- [ ] `vercel` (primeira vez)
- [ ] Anotar URL gerada
- [ ] Configurar variáveis de ambiente no dashboard:
  - [ ] JWT_SECRET
  - [ ] DATABASE_URL (se usar Turso/Postgres)
  - [ ] TURSO_AUTH_TOKEN (se usar Turso)
  - [ ] NODE_ENV=production
- [ ] `vercel --prod` (deploy final)

### Validação Backend
- [ ] Acesse https://seu-backend.vercel.app/auth/verify
- [ ] Deve retornar 401 (sem token)
- [ ] Teste criar usuário via curl
- [ ] Teste fazer login via curl
- [ ] Teste rota protegida com token

## 🎨 Deploy Frontend

### Preparação
- [ ] Criar .env.production com URL do backend deployado
- [ ] Verificar vercel.json criado
- [ ] Testar build local: `npm run build && npm run preview`

### Deploy
- [ ] `cd web`
- [ ] `vercel` (primeira vez)
- [ ] Anotar URL gerada
- [ ] Configurar environment variables no dashboard:
  - [ ] VITE_API_URL=https://seu-backend.vercel.app
- [ ] `vercel --prod` (deploy final)

### Validação Frontend
- [ ] Acessar https://seu-frontend.vercel.app
- [ ] Verificar que carrega a tela de login
- [ ] Console sem erros (F12)
- [ ] Network mostra requisições para backend correto

## 🔄 Integração

### Atualizar Backend com URL do Frontend
- [ ] Copiar URL do frontend
- [ ] Adicionar no allowedOrigins do server.ts:
  ```typescript
  const allowedOrigins = [
    'http://localhost:5173',
    'https://seu-frontend.vercel.app', // ADICIONAR AQUI
  ];
  ```
- [ ] Commit e push
- [ ] Re-deploy backend: `vercel --prod`

### Teste End-to-End
- [ ] Acessar frontend de produção
- [ ] Criar novo usuário
- [ ] Fazer login
- [ ] Verificar que nome aparece no header
- [ ] Testar cada página/funcionalidade
- [ ] Fazer logout
- [ ] Fazer login novamente

## 📊 Monitoramento

### Vercel Dashboard
- [ ] Verificar logs do backend
- [ ] Verificar logs do frontend
- [ ] Configurar alertas se disponível
- [ ] Verificar métricas de uso

### Testes Funcionais
- [ ] Criar safra
- [ ] Criar talhão base
- [ ] Criar talhão safra
- [ ] Upload de KML
- [ ] Visualizar mapa
- [ ] Visualizar dashboard de colheita
- [ ] Atualizar configurações

## 🎯 Domínio Custom (Opcional)

- [ ] Comprar domínio (ex: fazendaretiro.com)
- [ ] Configurar no Vercel Dashboard
- [ ] Atualizar DNS do domínio
- [ ] Adicionar domínio no CORS do backend
- [ ] Testar com domínio custom

## 📱 PWA (Opcional)

- [ ] Adicionar manifest.json
- [ ] Adicionar service worker
- [ ] Configurar ícones
- [ ] Testar instalação no mobile

## 📈 Otimizações Futuras

- [ ] Configurar CDN para assets estáticos
- [ ] Implementar cache de API
- [ ] Adicionar lazy loading de componentes
- [ ] Otimizar bundle size
- [ ] Implementar code splitting
- [ ] Adicionar analytics (Google Analytics, Posthog, etc)

## 🆘 Rollback Plan

Se algo der errado:
- [ ] Anotar última versão funcionando
- [ ] Vercel permite rollback via dashboard
- [ ] Restaurar variáveis de ambiente anteriores
- [ ] Restaurar banco de dados do backup

## 📝 Documentação

- [ ] Atualizar README com URLs de produção
- [ ] Documentar processo de deploy para equipe
- [ ] Criar guia de troubleshooting
- [ ] Documentar variáveis de ambiente necessárias

## ✨ Pós-Deploy

- [ ] Comunicar equipe sobre novo sistema
- [ ] Criar usuários para equipe
- [ ] Treinar usuários se necessário
- [ ] Coletar feedback inicial
- [ ] Planejar próximas features

## 🎉 Deploy Completo!

Quando todos os checkboxes estiverem marcados:
- Sistema está em produção
- Usuários podem acessar
- Monitoramento ativo
- Documentação completa

**Parabéns! 🚀**

---

## 📞 Suporte Pós-Deploy

### Logs
```bash
# Ver logs do backend
vercel logs https://seu-backend.vercel.app

# Ver logs do frontend
vercel logs https://seu-frontend.vercel.app
```

### Comandos Úteis
```bash
# Re-deploy backend
cd backend && vercel --prod

# Re-deploy frontend
cd web && vercel --prod

# Ver deployments
vercel list

# Ver domínios
vercel domains list
```

### Links Importantes
- Dashboard Vercel: https://vercel.com/dashboard
- Documentação Vercel: https://vercel.com/docs
- Turso Dashboard: https://app.turso.tech (se usar Turso)
