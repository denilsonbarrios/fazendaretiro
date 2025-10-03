# Sistema de Autenticação - Fazenda Retiro

## ✅ Implementação Completa

### Backend (Express + JWT)
- ✅ Tabela `users` criada no SQLite
- ✅ Hash de senhas com bcrypt (10 rounds)
- ✅ Endpoints de autenticação:
  - `POST /auth/register` - Cadastro de usuário
  - `POST /auth/login` - Login (retorna JWT token)
  - `GET /auth/verify` - Verificar token válido
- ✅ Middleware `authenticateToken` aplicado globalmente
- ✅ Token JWT com expiração de 24 horas
- ✅ Variáveis de ambiente configuradas (JWT_SECRET)

### Frontend (React + TypeScript)
- ✅ LoginPage com formulário de login/cadastro
- ✅ AuthContext para gerenciar estado global de autenticação
- ✅ Token armazenado em localStorage
- ✅ Verificação automática de token ao carregar app
- ✅ Headers de Authorization em todas as requisições
- ✅ Botão de logout no header
- ✅ Exibição do nome do usuário logado

## 📋 Como Testar

### 1. Criar Primeiro Usuário
1. Acesse http://localhost:5173
2. Você verá a tela de login
3. Clique em "Não tem uma conta? Cadastre-se"
4. Preencha:
   - Nome Completo: Seu nome
   - Usuário: seu_usuario
   - Senha: sua_senha_segura
5. Clique em "Cadastrar"
6. Você será redirecionado para fazer login

### 2. Fazer Login
1. Digite seu usuário e senha
2. Clique em "Entrar"
3. Você será autenticado e verá o sistema
4. No header, verá: "Olá, [Seu Nome]"

### 3. Testar Proteção de Rotas
1. Com o sistema aberto, abra DevTools (F12)
2. Vá em Application > Local Storage
3. Delete a chave "token"
4. Recarregue a página
5. Você deve ser redirecionado para a tela de login

### 4. Testar Requisições Protegidas
1. Faça login novamente
2. Tente acessar diferentes abas (Mapa, Talhões, etc.)
3. Todas as requisições devem funcionar
4. Verifique no Network do DevTools que todas têm header "Authorization: Bearer [token]"

### 5. Testar Logout
1. Clique no botão "Sair" no header
2. Você será deslogado e redirecionado para login
3. Token será removido do localStorage

### 6. Testar Backend Diretamente (Opcional)
```bash
# Cadastrar usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"senha123","nome":"Usuario Teste"}'

# Fazer login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"senha123"}'

# Resposta incluirá: {"token":"...", "user":{...}}

# Testar rota protegida
curl http://localhost:3000/safras \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 🔒 Segurança Implementada

- ✅ Senhas nunca armazenadas em texto plano (bcrypt hash)
- ✅ JWT assinado com secret key
- ✅ Token expira em 24 horas
- ✅ Middleware valida token em todas as rotas protegidas
- ✅ CORS configurado para aceitar header Authorization
- ✅ Validação de credenciais no login
- ✅ Username único (constraint no banco)

## 🚀 Próximos Passos: Deploy no Vercel

Ver arquivo `DEPLOY_VERCEL.md` para instruções de deployment.
