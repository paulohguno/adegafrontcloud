install/banco.sql
-- ============================================================
--  ADEGA ERP — Schema PostgreSQL
--  Preparado para migração futura do IndexedDB para Postgres
--  Execute com: psql -U seu_usuario -d adega_db -f schema.sql
-- ============================================================

-- Extensão para UUID (recomendado para IDs distribuídos)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    telefone    VARCHAR(30),
    email       VARCHAR(255),
    observacoes TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes (nome);

-- ============================================================
--  ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS estoque (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    quantidade  INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    custo       NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (custo >= 0),
    unidade     VARCHAR(30) DEFAULT 'un',   -- ex: un, ml, kg, garrafa
    descricao   TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_nome ON estoque (nome);

-- Histórico de movimentações de estoque (auditoria)
CREATE TABLE IF NOT EXISTS estoque_movimentos (
    id              SERIAL PRIMARY KEY,
    estoque_id      INTEGER NOT NULL REFERENCES estoque(id) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
    quantidade      INTEGER NOT NULL,
    custo_unitario  NUMERIC(10, 2),
    motivo          VARCHAR(255),         -- ex: 'venda', 'entrada manual', 'ajuste inventário'
    referencia_id   INTEGER,              -- id da venda se for saída por venda
    usuario         VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_estoque ON estoque_movimentos (estoque_id);

-- ============================================================
--  PRODUTOS (COMBOS/COMPOSIÇÃO)
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    preco       NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    descricao   TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos (nome);

-- Composição: relação produto ↔ itens de estoque
CREATE TABLE IF NOT EXISTS produto_composicao (
    id          SERIAL PRIMARY KEY,
    produto_id  INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    estoque_id  INTEGER NOT NULL REFERENCES estoque(id) ON DELETE RESTRICT,
    quantidade  INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    UNIQUE (produto_id, estoque_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_comp_produto  ON produto_composicao (produto_id);
CREATE INDEX IF NOT EXISTS idx_prod_comp_estoque  ON produto_composicao (estoque_id);

-- ============================================================
--  VENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS vendas (
    id              SERIAL PRIMARY KEY,
    produto_id      INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    produto_nome    VARCHAR(255) NOT NULL,   -- desnormalizado para histórico
    cliente_id      INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    cliente_nome    VARCHAR(255),            -- desnormalizado para histórico
    valor           NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    custo_producao  NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    lucro           NUMERIC(10, 2) GENERATED ALWAYS AS (valor - custo_producao) STORED,
    status          VARCHAR(20) NOT NULL DEFAULT 'finalizada'
                        CHECK (status IN ('pendente', 'finalizada', 'cancelada')),
    observacoes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendas_cliente   ON vendas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_produto   ON vendas (produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_status    ON vendas (status);
CREATE INDEX IF NOT EXISTS idx_vendas_created   ON vendas (created_at DESC);

-- ============================================================
--  PENDÊNCIAS (substitui o estado em memória do JS)
-- ============================================================
CREATE TABLE IF NOT EXISTS pendencias (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produto_id      INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    produto_nome    VARCHAR(255) NOT NULL,
    composicao      JSONB NOT NULL DEFAULT '[]',  -- snapshot dos itens na hora do pedido
    preco           NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    custo_calculado NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status          VARCHAR(20) NOT NULL DEFAULT 'aberta'
                        CHECK (status IN ('aberta', 'finalizada', 'cancelada')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pendencias_cliente ON pendencias (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_status  ON pendencias (status);

-- ============================================================
--  VIEWS ÚTEIS
-- ============================================================

-- Resumo financeiro
CREATE OR REPLACE VIEW vw_resumo_financeiro AS
SELECT
    COUNT(*)                                AS total_vendas,
    SUM(valor)                              AS receita_bruta,
    SUM(custo_producao)                     AS total_custos,
    SUM(lucro)                              AS lucro_liquido,
    ROUND(AVG(valor), 2)                    AS ticket_medio,
    ROUND(SUM(lucro) / NULLIF(SUM(valor),0) * 100, 2) AS margem_pct
FROM vendas
WHERE status = 'finalizada';

-- Estoque com valor
CREATE OR REPLACE VIEW vw_estoque_valor AS
SELECT
    id,
    nome,
    quantidade,
    custo,
    ROUND(quantidade * custo, 2) AS valor_total,
    CASE
        WHEN quantidade = 0   THEN 'zerado'
        WHEN quantidade < 10  THEN 'baixo'
        WHEN quantidade > 100 THEN 'alto'
        ELSE 'normal'
    END AS status_estoque
FROM estoque
WHERE ativo = TRUE;

-- Top produtos por receita
CREATE OR REPLACE VIEW vw_top_produtos AS
SELECT
    produto_nome,
    COUNT(*)        AS qtd_vendas,
    SUM(valor)      AS receita_total,
    SUM(lucro)      AS lucro_total
FROM vendas
WHERE status = 'finalizada'
GROUP BY produto_nome
ORDER BY receita_total DESC;

-- Top clientes por receita
CREATE OR REPLACE VIEW vw_top_clientes AS
SELECT
    COALESCE(cliente_nome, 'Balcão') AS cliente,
    COUNT(*)                          AS qtd_vendas,
    SUM(valor)                        AS receita_total
FROM vendas
WHERE status = 'finalizada'
GROUP BY cliente_nome
ORDER BY receita_total DESC;

-- ============================================================
--  FUNÇÃO: abater estoque ao finalizar venda
-- ============================================================
CREATE OR REPLACE FUNCTION fn_abater_estoque_venda()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    comp JSONB;
    item JSONB;
    est_id  INTEGER;
    est_qty INTEGER;
    est_custo NUMERIC;
BEGIN
    -- Apenas quando status muda para 'finalizada'
    IF NEW.status = 'finalizada' AND (OLD.status IS DISTINCT FROM 'finalizada') THEN

        -- Iterar sobre composição (array JSON)
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.composicao)
        LOOP
            est_id  := (item->>'id')::INTEGER;
            est_qty := (item->>'qtdConsumo')::INTEGER;

            SELECT custo INTO est_custo FROM estoque WHERE id = est_id;

            UPDATE estoque
               SET quantidade  = quantidade - est_qty,
                   updated_at  = NOW()
             WHERE id = est_id AND quantidade >= est_qty;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Estoque insuficiente para item id %', est_id;
            END IF;

            -- Registrar movimento
            INSERT INTO estoque_movimentos (estoque_id, tipo, quantidade, custo_unitario, motivo, referencia_id)
            VALUES (est_id, 'saida', est_qty, est_custo, 'venda', NEW.id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

-- Associar trigger à tabela pendencias
CREATE TRIGGER trg_abater_estoque_pendencia
    AFTER UPDATE ON pendencias
    FOR EACH ROW
    EXECUTE FUNCTION fn_abater_estoque_venda();

-- ============================================================
--  FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clientes_updated_at   BEFORE UPDATE ON clientes   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_estoque_updated_at    BEFORE UPDATE ON estoque     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_produtos_updated_at   BEFORE UPDATE ON produtos    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_pendencias_updated_at BEFORE UPDATE ON pendencias  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
--  DADOS INICIAIS DE EXEMPLO (opcional — comente se não quiser)
-- ============================================================
/*
INSERT INTO clientes (nome, telefone) VALUES
    ('João Silva', '(47) 99999-0001'),
    ('Maria Souza', '(47) 99999-0002'),
    ('Carlos Lima', '(47) 99999-0003');

INSERT INTO estoque (nome, quantidade, custo, unidade) VALUES
    ('Vinho Tinto Malbec 750ml', 50, 35.00, 'garrafa'),
    ('Taça de Cristal',          100, 8.50, 'un'),
    ('Tábua de Frios',            30, 22.00, 'un'),
    ('Água Mineral 500ml',        200, 1.50, 'garrafa'),
    ('Espumante Brut 750ml',      40, 42.00, 'garrafa');

INSERT INTO produtos (nome, preco) VALUES
    ('Taça de Malbec', 25.00),
    ('Kit Degustação', 89.00),
    ('Espumante + Tábua', 75.00);

INSERT INTO produto_composicao (produto_id, estoque_id, quantidade) VALUES
    (1, 1, 1), (1, 2, 1),
    (2, 1, 1), (2, 2, 2), (2, 3, 1),
    (3, 5, 1), (3, 3, 1), (3, 2, 2);
*/

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
