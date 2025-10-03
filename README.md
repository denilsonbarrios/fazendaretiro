# 🌾 Fazenda Retiro - Sistema de Gestão Agrícola

Sistema completo de gestão de fazenda com mapeamento de talhões, controle de safras, rastreamento de colheitas e autenticação JWT.

## 📋 Funcionalidades

### ✅ Implementadas
- **Autenticação JWT**: Login/cadastro seguro com bcrypt
- **Gestão de Talhões**: Cadastro, edição, visualização
- **Gestão de Safras**: Controle de safras por ano
- **Mapeamento KML**: Upload e visualização de mapas
- **Dashboard de Colheita**: Acompanhamento de produção
- **Configurações**: Gerenciamento de variedades e tipos

### 🎯 Módulos

1. **Mapa**: Visualização geoespacial dos talhões
2. **Colheita**: Dashboard com métricas de produção
3. **Talhões**: 
   - Talhão Base: Informações permanentes
   - Talhão Safra: Dados específicos por safra
4. **KML**: Upload e gerenciamento de arquivos de mapeamento
5. **Configurações**: Tipos e variedades de cultivo

## 🛠️ Tecnologias

### Backend
- **Node.js** + **Express.js**
- **TypeScript**
- **SQLite** (desenvolvimento)
- **JWT** (jsonwebtoken)
- **Bcrypt** (hash de senhas)
- **Multer** (upload de arquivos)

### Frontend
- **React** + **TypeScript**
- **Vite** (build tool)
- **Leaflet** (mapas)
- **React Toastify** (notificações)
- **SCSS** (estilos)

## 📦 Instalação

### Pré-requisitos
- Node.js 16+
- npm ou yarn

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env com suas configurações
npm start
```

O backend estará rodando em `http://localhost:3000`

### Frontend
```bash
cd web
npm install
cp .env.example .env
# Editar .env com a URL do backend
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 🔐 Autenticação

### Primeiro Acesso
1. Acesse http://localhost:5173
2. Clique em "Não tem uma conta? Cadastre-se"
3. Preencha nome, usuário e senha
4. Faça login com as credenciais criadas

### Estrutura de Autenticação
- Token JWT com expiração de 24 horas
- Hash de senha com bcrypt (10 rounds)
- Token armazenado em localStorage
- Middleware de autenticação em todas as rotas protegidas

Para mais detalhes, veja [AUTENTICACAO.md](./AUTENTICACAO.md)

## 🚀 Deploy

### Vercel (Recomendado)
Siga as instruções detalhadas em [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)

**Resumo:**
1. Deploy do backend no Vercel
2. Deploy do frontend no Vercel
3. Configurar variáveis de ambiente
4. Atualizar CORS com URLs de produção

### ⚠️ Importante para Produção
- SQLite não é recomendado para produção no Vercel
- Considere migrar para **Turso** (SQLite na nuvem) ou **Vercel Postgres**
- Gere novo JWT_SECRET para produção (não use o de desenvolvimento)

## 📁 Estrutura do Projeto

```
fazendaretiro/
├── backend/
│   ├── server.ts          # API Express
│   ├── db.ts              # Configuração SQLite
│   ├── types.ts           # TypeScript types
│   ├── kmlParser.ts       # Parser de arquivos KML
│   ├── talhao-routes.ts   # Rotas de talhões
│   ├── .env               # Variáveis de ambiente (não commitar)
│   ├── .env.example       # Template de variáveis
│   ├── vercel.json        # Config Vercel
│   └── fazendaretiro.db   # Banco SQLite (dev)
│
├── web/
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   │   ├── LoginPage.tsx
│   │   │   ├── MapPage.tsx
│   │   │   ├── ColheitaPage.tsx
│   │   │   ├── DataPage.tsx
│   │   │   ├── KmlPage.tsx
│   │   │   └── ConfigPage.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # Contexto de autenticação
│   │   ├── hooks/
│   │   │   └── useMapData.ts
│   │   ├── styles/
│   │   │   └── main.scss
│   │   ├── api.ts         # Cliente API
│   │   ├── types.ts       # TypeScript types
│   │   ├── App.tsx        # Componente principal
│   │   └── main.tsx       # Entry point
│   ├── .env               # Variáveis de ambiente (não commitar)
│   ├── .env.example       # Template de variáveis
│   ├── vercel.json        # Config Vercel
│   └── vite.config.ts     # Config Vite
│
├── AUTENTICACAO.md        # Guia de autenticação
├── DEPLOY_VERCEL.md       # Guia de deploy
└── README.md              # Este arquivo
```

## 🗃️ Banco de Dados

### Tabelas Principais
- `users`: Usuários do sistema
- `safras`: Safras/anos agrícolas
- `talhoes`: Talhões base (permanentes)
- `talhao_safra`: Dados de talhões por safra
- `carregamentos`: Carregamentos de colheita
- `kml_files`: Arquivos KML importados
- `config_tipo`: Tipos de cultivo
- `config_variedade`: Variedades de cultivo

### Migrations
Para criar novas migrações, veja os arquivos `migration-*.ts` no backend.

## 🔧 Scripts Úteis

### Backend
```bash
npm start          # Iniciar servidor
npm run build      # Build TypeScript
npm run dev        # Modo desenvolvimento com watch
```

### Frontend
```bash
npm run dev        # Servidor desenvolvimento
npm run build      # Build produção
npm run preview    # Preview do build
```

## 📝 Variáveis de Ambiente

### Backend (.env)
```
JWT_SECRET=sua_chave_secreta_aqui
PORT=3000
DATABASE_PATH=./fazendaretiro.db
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```

## 🧪 Testes

### Testar Autenticação
```bash
# Cadastrar usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"senha123","nome":"Usuario Teste"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"senha123"}'
```

### Testar Rotas Protegidas
```bash
# Substituir TOKEN pelo token recebido no login
curl http://localhost:3000/safras \
  -H "Authorization: Bearer TOKEN"
```

## 🐛 Troubleshooting

### Erro de CORS
- Verificar URL do frontend no CORS do backend
- Verificar se porta está correta

### Erro de Autenticação
- Verificar se token está sendo enviado no header
- Verificar JWT_SECRET configurado
- Verificar expiração do token (24h)

### Erro no Build
- Limpar node_modules e reinstalar: `rm -rf node_modules && npm install`
- Verificar versão do Node.js (16+)
- Verificar tsconfig.json

## 📄 Licença

Projeto privado - Fazenda Retiro © 2025

## 👥 Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/minha-feature`
2. Commit suas mudanças: `git commit -m 'Adiciona minha feature'`
3. Push para a branch: `git push origin feature/minha-feature`
4. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação em `AUTENTICACAO.md` e `DEPLOY_VERCEL.md`
2. Consulte os logs do servidor (backend e frontend)
3. Verifique o console do navegador (F12)

## 🎯 Roadmap

- [ ] Migrar para Turso/Postgres em produção
- [ ] Adicionar testes automatizados
- [ ] Implementar refresh token
- [ ] Adicionar roles de usuário (admin, operador, etc)
- [ ] Dashboard com gráficos mais detalhados
- [ ] Exportação de relatórios (PDF, Excel)
- [ ] App mobile (React Native)
- [ ] Notificações push
- [ ] Integração com APIs de clima
- [ ] Backup automático do banco

## ✨ Changelog

### v1.0.0 (2025-10-03)
- ✅ Sistema de autenticação JWT completo
- ✅ CRUD de talhões (base e safra)
- ✅ Gestão de safras
- ✅ Upload de KML
- ✅ Dashboard de colheita
- ✅ Configurações de tipos e variedades
- ✅ Preparação para deploy no Vercel
