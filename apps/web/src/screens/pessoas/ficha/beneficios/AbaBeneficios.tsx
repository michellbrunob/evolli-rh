/**
 * T215 — ficha › aba Benefícios (como a referência, 2026-11-26): o custo
 * mensal da empresa com os benefícios da pessoa (e quanto ele representa do
 * salário bruto), o custo anual, a rosca por benefício, a distribuição por
 * categoria e a lista dos benefícios vinculados. Além da referência: o
 * desconto no holerite da pessoa e as pendências (ex.: falta a data de
 * nascimento para o plano por faixa etária).
 *
 * Vincular ou mudar valores é no módulo Benefícios.
 */
import { useEffect, useState } from "react";
import type { FichaDeBeneficiosApi } from "../../../../api/beneficiosClient";
import { beneficiosDaFicha } from "../../../../api/beneficiosClient";
import { Button, StatusBadge } from "../../../../components";
import { formatarCentavos, formatarPercentual } from "../../../../format/moeda";
import {
  IconeBeneficios,
  IconeMais,
  IconeSucesso,
} from "../../../../ui/icones";
import {
  CATEGORIAS,
  ICONE_DA_CATEGORIA,
  TEXTO_DA_PENDENCIA,
  beneficiosAtivos,
} from "../../../beneficios/textosDosBeneficios";
import "./AbaBeneficios.css";

export type CarregarBeneficiosDaFicha = (
  colaboradorId: string,
) => Promise<FichaDeBeneficiosApi>;

/** Tons da cor de ação, do mais forte ao mais claro (por participação). */
const TONS = [100, 70, 48, 32, 20, 12];
const tom = (i: number) =>
  `color-mix(in srgb, var(--color-action) ${TONS[Math.min(i, TONS.length - 1)]}%, var(--surface-canvas))`;

export function AbaBeneficios({
  colaboradorId,
  primeiroNome,
  onAbrirBeneficios,
  carregar = (id) => beneficiosDaFicha(id),
}: {
  readonly colaboradorId: string;
  readonly primeiroNome: string;
  readonly onAbrirBeneficios?: () => void;
  readonly carregar?: CarregarBeneficiosDaFicha;
}) {
  const [dados, setDados] = useState<FichaDeBeneficiosApi | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregar(colaboradorId)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [carregar, colaboradorId]);

  if (falhou) {
    return (
      <p className="aba-beneficios__falha" role="alert">
        Não foi possível carregar os benefícios.
      </p>
    );
  }
  if (!dados) {
    return (
      <p className="aba-beneficios__suave" role="status">
        Carregando benefícios…
      </p>
    );
  }

  const lista = dados.beneficios;
  if (lista.length === 0) {
    return (
      <section className="aba-beneficios__vazio" aria-label="Benefícios">
        <Rosca fatias={[]} centro={null} />
        <div className="aba-beneficios__vazio-textos">
          <h2>Nenhum benefício vinculado</h2>
          <p>{`Vincule os benefícios de ${primeiroNome} para acompanhar o custo mensal, a distribuição por categoria e quanto eles representam do salário.`}</p>
          <ul className="aba-beneficios__chips" aria-label="Exemplos">
            {(["alimentacao", "saude", "bem_estar", "mobilidade"] as const).map(
              (c) => {
                const Icone = ICONE_DA_CATEGORIA[c];
                return (
                  <li key={c}>
                    <Icone tamanho={14} /> {CATEGORIAS[c].curta}
                  </li>
                );
              },
            )}
          </ul>
          {onAbrirBeneficios ? (
            <div className="aba-beneficios__acoes">
              <Button onClick={onAbrirBeneficios}>
                <IconeMais tamanho={16} />
                Vincular benefício
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const total = lista.reduce((t, b) => t + b.empresa, 0);
  const desconto = lista.reduce((t, b) => t + b.desconto, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const salario = dados.salarioBruto;
  const doSalario = salario ? (total / 100 / salario) * 100 : null;
  const porCategoria = [
    ...lista.reduce(
      (m, b) => m.set(b.categoria, (m.get(b.categoria) ?? 0) + b.empresa),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1]);
  const pendentes = lista.filter((b) => b.pendencia);

  return (
    <div className="aba-beneficios">
      <div className="aba-beneficios__topo">
        <section
          className="aba-beneficios__cartao"
          aria-labelledby="aba-beneficios-custo"
        >
          <header className="aba-beneficios__cabeca">
            <span className="aba-beneficios__icone" aria-hidden="true">
              <IconeBeneficios tamanho={18} />
            </span>
            <div>
              <h2 id="aba-beneficios-custo">Custo mensal com benefícios</h2>
              <p className="aba-beneficios__suave">
                Valor pago pela empresa todo mês
              </p>
            </div>
          </header>
          <div className="aba-beneficios__custo">
            <div className="aba-beneficios__custo-numeros">
              <p className="aba-beneficios__grande">
                <span className="aba-beneficios__moeda">R$</span>
                {formatarCentavos(total).replace("R$ ", "")}
                <span className="aba-beneficios__moeda">/mês</span>
              </p>
              {doSalario !== null ? (
                <p>
                  <span className="aba-beneficios__pilula">{`${formatarPercentual(Math.round(doSalario * 10) / 10)}% do salário bruto`}</span>{" "}
                  <span className="aba-beneficios__suave">{`sobre ${formatarCentavos(Math.round((salario ?? 0) * 100))}`}</span>
                </p>
              ) : (
                <p className="aba-beneficios__suave">
                  Sem salário no cadastro.
                </p>
              )}
              <dl className="aba-beneficios__dados">
                <div>
                  <dt>Custo anual</dt>
                  <dd>{formatarCentavos(total * 12)}</dd>
                </div>
                <div>
                  <dt>Desconto no holerite</dt>
                  <dd>{`${formatarCentavos(desconto)}/mês`}</dd>
                </div>
                <div>
                  <dt>Benefícios ativos</dt>
                  <dd>{lista.length}</dd>
                </div>
              </dl>
            </div>
            <div className="aba-beneficios__grafico">
              <Rosca
                fatias={lista.map((b, i) => ({
                  valor: b.empresa,
                  cor: tom(i),
                }))}
                centro={lista.length}
              />
              <ul
                className="aba-beneficios__legenda"
                aria-label="Participação por benefício"
              >
                {lista.map((b, i) => (
                  <li key={b.id}>
                    <span
                      className="aba-beneficios__ponto"
                      style={{ background: tom(i) }}
                      aria-hidden="true"
                    />
                    <span>
                      {b.nome}
                      <strong>{`${pct(b.empresa)}%`}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="aba-beneficios__cartao"
          aria-labelledby="aba-beneficios-categoria"
        >
          <header className="aba-beneficios__cabeca">
            <span className="aba-beneficios__icone" aria-hidden="true">
              <IconeBeneficios tamanho={18} />
            </span>
            <div>
              <h2 id="aba-beneficios-categoria">Por categoria</h2>
              <p className="aba-beneficios__suave">
                Onde o investimento está concentrado
              </p>
            </div>
          </header>
          <ul className="aba-beneficios__categorias">
            {porCategoria.map(([c, v], i) => (
              <li key={c}>
                <span className="aba-beneficios__categoria-linha">
                  <span>{CATEGORIAS[c as keyof typeof CATEGORIAS].curta}</span>
                  <span>
                    <strong>{formatarCentavos(v)}</strong>{" "}
                    <span className="aba-beneficios__suave">{`${pct(v)}%`}</span>
                  </span>
                </span>
                <span className="aba-beneficios__barra" aria-hidden="true">
                  <span style={{ width: `${pct(v)}%`, background: tom(i) }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        className="aba-beneficios__cartao"
        aria-labelledby="aba-beneficios-vinculados"
      >
        <header className="aba-beneficios__cabeca">
          <span className="aba-beneficios__icone" aria-hidden="true">
            <IconeSucesso tamanho={18} />
          </span>
          <div>
            <h2 id="aba-beneficios-vinculados">Benefícios vinculados</h2>
            <p className="aba-beneficios__suave">{`${beneficiosAtivos(lista.length)} para ${primeiroNome}`}</p>
          </div>
          {onAbrirBeneficios ? (
            <Button variant="secondary" onClick={onAbrirBeneficios}>
              <IconeMais tamanho={16} />
              Vincular benefício
            </Button>
          ) : null}
        </header>
        {pendentes.length ? (
          <p className="aba-beneficios__pendencia" role="note">
            {`${pendentes.length === 1 ? "1 benefício está" : `${pendentes.length} benefícios estão`} fora da conta até completar o cadastro: ${pendentes.map((b) => `${b.nome} (${TEXTO_DA_PENDENCIA[b.pendencia!].toLowerCase()})`).join("; ")}.`}
          </p>
        ) : null}
        <ul className="aba-beneficios__lista">
          {lista.map((b, i) => {
            const Icone = ICONE_DA_CATEGORIA[b.categoria];
            return (
              <li key={b.id}>
                <span className="aba-beneficios__icone" aria-hidden="true">
                  <Icone tamanho={18} />
                </span>
                <span className="aba-beneficios__nome">
                  <strong>{b.nome}</strong>
                  <span className="aba-beneficios__suave">
                    {CATEGORIAS[b.categoria].curta}
                  </span>
                </span>
                <span className="aba-beneficios__participacao">
                  <span className="aba-beneficios__categoria-linha">
                    <span className="aba-beneficios__suave">
                      Participação no custo
                    </span>
                    <span>{`${pct(b.empresa)}%`}</span>
                  </span>
                  <span className="aba-beneficios__barra" aria-hidden="true">
                    <span
                      style={{
                        width: `${pct(b.empresa)}%`,
                        background: tom(i),
                      }}
                    />
                  </span>
                </span>
                <span className="aba-beneficios__valor">
                  <strong>{formatarCentavos(b.empresa)}</strong>
                  <span className="aba-beneficios__suave">
                    /mês · custo da empresa
                  </span>
                  {b.desconto ? (
                    <span className="aba-beneficios__suave">{`desconto de ${formatarCentavos(b.desconto)}`}</span>
                  ) : null}
                </span>
                {b.pendencia ? (
                  <StatusBadge variant="danger">Pendente</StatusBadge>
                ) : (
                  <StatusBadge variant="success">Ativo</StatusBadge>
                )}
              </li>
            );
          })}
          {onAbrirBeneficios ? (
            <li className="aba-beneficios__vincular">
              <button type="button" onClick={onAbrirBeneficios}>
                <span className="aba-beneficios__mais" aria-hidden="true">
                  <IconeMais tamanho={16} />
                </span>
                <span className="aba-beneficios__nome">
                  <strong>Vincular outro benefício</strong>
                  <span className="aba-beneficios__suave">
                    Vale-transporte, odontológico, auxílio home office e mais.
                  </span>
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

/** Rosca (SVG) com as fatias proporcionais; vazia, um anel neutro. */
function Rosca({
  fatias,
  centro,
}: {
  readonly fatias: readonly { valor: number; cor: string }[];
  readonly centro: number | null;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  let acumulado = 0;
  return (
    <div className="aba-beneficios__rosca">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--surface-neutral)"
          strokeWidth="20"
        />
        {total > 0
          ? fatias.map((f, i) => {
              const parte = (f.valor / total) * c;
              const el = (
                <circle
                  key={i}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={f.cor}
                  strokeWidth="20"
                  strokeDasharray={`${Math.max(parte - 1.5, 0)} ${c}`}
                  strokeDashoffset={-acumulado}
                  transform="rotate(-90 70 70)"
                />
              );
              acumulado += parte;
              return el;
            })
          : null}
      </svg>
      {centro !== null ? (
        <span className="aba-beneficios__rosca-centro">
          <strong>{centro}</strong>
          <span>{centro === 1 ? "ativo" : "ativos"}</span>
        </span>
      ) : (
        <span className="aba-beneficios__rosca-centro">
          <IconeBeneficios tamanho={24} />
        </span>
      )}
    </div>
  );
}
