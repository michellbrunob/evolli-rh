-- T210 — Configurações › Aparência: o tema visual da PRÓPRIA conta.
-- Migration aditiva: coluna anulável (nula = Azul Institucional, o padrão),
-- com CHECK nos quatro temas fechados. Preferência por conta, não por
-- empresa; não muda dado, permissão, relatório nem documento.

ALTER TABLE "access_user" ADD COLUMN "tema_aparencia" TEXT;

ALTER TABLE "access_user"
    ADD CONSTRAINT "access_user_tema_aparencia_check"
        CHECK ("tema_aparencia" IS NULL OR "tema_aparencia" IN
            ('azul_institucional', 'evolli_claro', 'verde_petroleo', 'alto_contraste'));
