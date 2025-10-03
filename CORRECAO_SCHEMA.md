# 🔧 Correção do Schema Supabase

## ❌ Problema
O schema inicial não incluía todas as colunas do SQLite:
- `talhoes`: faltava coluna `COR`
- `talhao_safra`: faltava coluna `ativo`
- `carregamentos`: faltava coluna `data`
- `kml_files`: faltava coluna `content`

## ✅ Solução Rápida

### Passo 1: Executar Schema Completo no Supabase

1. Abra o Supabase Dashboard
2. Vá em **SQL Editor**
3. Click **+ New query**
4. Cole TODO o conteúdo de `backend/supabase-schema-completo.sql`
5. Click **Run** (F5)

**Resultado esperado:**
```
Schema completo criado com sucesso!
```

### Passo 2: Re-importar Dados

Terminal (na pasta backend):
```bash
npm run import-to-supabase
```

**Resultado esperado:**
```
✅ safras: 2 registros importados
✅ talhoes: 70 registros importados  
✅ talhao_safra: 145 registros importados
✅ carregamentos: 344 registros importados
✅ kml_files: 1 registros importados
🎉 Migração concluída!
📊 Total importado: 562 registros
```

### Passo 3: Verificar no Dashboard

1. Supabase Dashboard → **Table Editor**
2. Verificar cada tabela:
   - ✅ safras: 2 registros
   - ✅ talhoes: 70 registros
   - ✅ talhao_safra: 145 registros
   - ✅ carregamentos: 344 registros
   - ✅ kml_files: 1 registro

---

## 📋 Diferenças Encontradas

### Colunas Adicionadas:

**talhoes:**
```sql
"COR" TEXT  -- Coluna de cor do talhão
```

**talhao_safra:**
```sql
ativo BOOLEAN DEFAULT true  -- Se o talhão está ativo na safra
```

**carregamentos:**
```sql
data BIGINT NOT NULL  -- Data do carregamento
data_colheita BIGINT NOT NULL  -- Data da colheita
```
(Ambas mantidas para compatibilidade)

**kml_files:**
```sql
content TEXT  -- Conteúdo original do KML
geojson TEXT  -- GeoJSON convertido
```
(Ambas mantidas)

---

## 🎯 Próximo Passo

Após importação bem-sucedida, continuar com o **ROTEIRO_DEPLOY.md**:
- Passo 2: Preparar para Vercel
- Passo 3: Deploy Backend
- Passo 4: Deploy Frontend

---

## 💡 Dica

Se quiser ver o schema do seu SQLite:
```bash
cd backend
sqlite3 fazendaretiro.db

.schema talhoes
.schema talhao_safra
.schema carregamentos
.schema kml_files
```
