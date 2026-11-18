-- T209 — cadastro de empresa (Configurações › Empresas › Nova empresa).
-- Migration aditiva: colunas novas, todas anuláveis (as empresas já
-- existentes ficam sem CNPJ até alguém completá-las).
--
-- * CNPJ: 14 posições, as 12 primeiras numéricas ou alfanuméricas em
--   maiúsculas (formato de 2026) e 2 dígitos verificadores, conferidos no
--   servidor. Único entre todas as empresas.
-- * Porte: faixa de pessoas no CNPJ, lista fechada.
-- * Endereço da empresa: CEP de 8 dígitos, UF entre as 27 siglas, limites de
--   tamanho iguais aos do endereço do colaborador.

ALTER TABLE "empresa"
    ADD COLUMN "cnpj" TEXT,
    ADD COLUMN "porte" TEXT,
    ADD COLUMN "cep" TEXT,
    ADD COLUMN "logradouro" TEXT,
    ADD COLUMN "numero" TEXT,
    ADD COLUMN "complemento" TEXT,
    ADD COLUMN "bairro" TEXT,
    ADD COLUMN "cidade" TEXT,
    ADD COLUMN "uf" TEXT;

ALTER TABLE "empresa"
    ADD CONSTRAINT "empresa_cnpj_check"
        CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$'),
    ADD CONSTRAINT "empresa_porte_check"
        CHECK ("porte" IS NULL OR "porte" IN
            ('1_10', '11_50', '51_200', '201_500', '501_1000', 'mais_de_1000')),
    ADD CONSTRAINT "empresa_cep_check"
        CHECK ("cep" IS NULL OR "cep" ~ '^[0-9]{8}$'),
    ADD CONSTRAINT "empresa_uf_check"
        CHECK ("uf" IS NULL OR "uf" IN
            ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT',
             'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO',
             'RR', 'SC', 'SP', 'SE', 'TO')),
    ADD CONSTRAINT "empresa_endereco_tamanhos_check"
        CHECK (
            ("logradouro" IS NULL OR char_length("logradouro") <= 200) AND
            ("numero" IS NULL OR char_length("numero") <= 20) AND
            ("complemento" IS NULL OR char_length("complemento") <= 120) AND
            ("bairro" IS NULL OR char_length("bairro") <= 120) AND
            ("cidade" IS NULL OR char_length("cidade") <= 120)
        );

CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");
