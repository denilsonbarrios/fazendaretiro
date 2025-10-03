# Script para gerar JWT_SECRET seguro para produção

## Windows (PowerShell)
```powershell
# Gerar string aleatória segura
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

## Linux/Mac (bash)
```bash
# Gerar string aleatória segura
openssl rand -base64 32
```

## Node.js
```javascript
// Executar no Node.js REPL ou criar arquivo generate-secret.js
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('base64');
console.log('JWT_SECRET=' + secret);
```

## Uso
1. Execute um dos comandos acima
2. Copie o resultado
3. No Vercel Dashboard:
   - Vá em Settings > Environment Variables
   - Adicione: `JWT_SECRET` = valor_gerado
   - Selecione os ambientes: Production, Preview, Development
4. Re-deploy do backend

## ⚠️ IMPORTANTE
- NUNCA commitar o JWT_SECRET real no Git
- Use secrets diferentes para desenvolvimento e produção
- Guarde o secret em local seguro (password manager)
- Se o secret vazar, gere um novo imediatamente
