-- Script SQL simples para associar variedade_configs com talhoes
-- Comando mais direto para visualizar a associação

-- Consulta principal: Talhões com cores das variedades configuradas
SELECT 
    t.NOME as talhao,
    t.VARIEDADE as variedade,
    t.COR as cor_atual_talhao,
    vc.default_color as cor_configurada_variedade,
    t.AREA as area,
    t.IDADE as idade
FROM talhoes t
LEFT JOIN variedade_configs vc ON t.VARIEDADE = vc.name
WHERE t.ativo = 1
ORDER BY t.VARIEDADE, t.NOME;

-- Para executar no terminal do banco (se disponível):
-- sqlite3 fazendaretiro.db < script_associacao_simples.sql
