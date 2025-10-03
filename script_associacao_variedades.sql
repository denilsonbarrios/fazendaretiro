-- Script SQL para associar tabela variedade_configs com talhoes e trazer a cor das variedades
-- Este script demonstra diferentes formas de fazer a associação

-- 1. CONSULTA BÁSICA: Talhões com suas cores configuradas de variedades
SELECT 
    t.id,
    t.TalhaoID,
    t.NOME as nome_talhao,
    t.VARIEDADE,
    t.COR as cor_atual_talhao,
    vc.name as variedade_config_nome,
    vc.default_color as cor_configurada_variedade,
    CASE 
        WHEN vc.default_color IS NOT NULL THEN vc.default_color 
        ELSE t.COR 
    END as cor_final
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
WHERE t.ativo = 1
ORDER BY t.NOME;

-- 2. CONSULTA AVANÇADA: Incluindo informações de safra e área
SELECT 
    t.id,
    t.TalhaoID,
    t.NOME as nome_talhao,
    t.TIPO,
    t.AREA,
    t.VARIEDADE,
    t.COR as cor_atual_talhao,
    vc.name as variedade_config_nome,
    vc.default_color as cor_configurada_variedade,
    CASE 
        WHEN vc.default_color IS NOT NULL THEN vc.default_color 
        ELSE t.COR 
    END as cor_final,
    t.IDADE,
    t.qtde_plantas,
    CASE 
        WHEN vc.id IS NOT NULL THEN 'SIM'
        ELSE 'NÃO'
    END as tem_configuracao_variedade
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
WHERE t.ativo = 1
ORDER BY t.VARIEDADE, t.NOME;

-- 3. CONSULTA DE ESTATÍSTICAS: Variedades e quantidades
SELECT 
    COALESCE(vc.name, t.VARIEDADE, 'SEM VARIEDADE') as variedade,
    vc.default_color as cor_configurada,
    COUNT(*) as total_talhoes,
    SUM(t.qtde_plantas) as total_plantas,
    ROUND(AVG(t.IDADE), 1) as idade_media,
    GROUP_CONCAT(t.NOME, ', ') as talhoes
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
WHERE t.ativo = 1
GROUP BY COALESCE(vc.name, t.VARIEDADE)
ORDER BY total_talhoes DESC;

-- 4. CONSULTA PARA IDENTIFICAR VARIEDADES SEM CONFIGURAÇÃO
SELECT DISTINCT
    t.VARIEDADE,
    COUNT(*) as total_talhoes,
    'Precisa configurar cor' as status
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
WHERE t.ativo = 1 
    AND t.VARIEDADE IS NOT NULL 
    AND t.VARIEDADE != ''
    AND vc.id IS NULL
GROUP BY t.VARIEDADE
ORDER BY total_talhoes DESC;

-- 5. CONSULTA PARA ATUALIZAR CORES DOS TALHÕES BASEADO NAS CONFIGURAÇÕES DE VARIEDADES
-- ATENÇÃO: Este é um UPDATE - use com cuidado!
-- Descomente as linhas abaixo se quiser aplicar as cores configuradas aos talhões

/*
UPDATE talhoes 
SET COR = (
    SELECT vc.default_color 
    FROM variedade_configs vc 
    WHERE UPPER(TRIM(talhoes.VARIEDADE)) = UPPER(TRIM(vc.name))
)
WHERE EXISTS (
    SELECT 1 
    FROM variedade_configs vc 
    WHERE UPPER(TRIM(talhoes.VARIEDADE)) = UPPER(TRIM(vc.name))
)
AND ativo = 1;
*/

-- 6. CONSULTA PARA VER O RESULTADO APÓS APLICAR AS CORES (sem fazer UPDATE)
SELECT 
    t.id,
    t.NOME as nome_talhao,
    t.VARIEDADE,
    t.COR as cor_atual,
    vc.default_color as cor_que_seria_aplicada,
    CASE 
        WHEN t.COR != vc.default_color THEN 'DIFERENTE'
        WHEN t.COR = vc.default_color THEN 'IGUAL'
        ELSE 'SEM CONFIG'
    END as status_cor
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
WHERE t.ativo = 1 AND vc.default_color IS NOT NULL
ORDER BY status_cor, t.VARIEDADE;

-- 7. CONSULTA PARA RELATÓRIO COMPLETO COM COORDENADAS (se necessário)
SELECT 
    t.id,
    t.TalhaoID,
    t.NOME as nome_talhao,
    t.TIPO,
    t.AREA,
    t.VARIEDADE,
    vc.default_color as cor_variedade_config,
    t.COR as cor_talhao,
    t.IDADE,
    t.qtde_plantas,
    tk.placemark_name,
    tk.geometry_type,
    CASE 
        WHEN tk.id IS NOT NULL THEN 'SIM'
        ELSE 'NÃO'
    END as tem_coordenadas
FROM talhoes t
LEFT JOIN variedade_configs vc ON UPPER(TRIM(t.VARIEDADE)) = UPPER(TRIM(vc.name))
LEFT JOIN talhoes_kml tk ON t.talhao_kml_id = tk.id
WHERE t.ativo = 1
ORDER BY t.VARIEDADE, t.NOME;
