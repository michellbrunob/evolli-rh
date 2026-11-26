/**
 * T215 — "Adicionar pessoas" (como a referência): quem ainda não recebe o
 * benefício, com o valor e o desconto previstos; filtros por nome,
 * departamento, contrato e desligados; "Entram a partir de" (este mês ou os
 * dois seguintes).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PessoaDoBeneficioApi } from "../../api/beneficiosClient";
import { Button } from "../../components";
import {
  formatarCompetenciaPorExtenso,
  formatarMesReferencia,
} from "../../format/data";
import { formatarCentavos } from "../../format/moeda";
import { IconButton } from "../../ui";
import { IconeVoltar } from "../../ui/icones";
import {
  competenciaDoMesAtual,
  competenciaVizinha,
} from "../../app/rotasDoShell";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../pessoas/edicao/dadosProfissionais";
import { PessoaNaLinha } from "./comuns";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";
import {
  TEXTO_DA_OBSERVACAO,
  TEXTO_DA_PENDENCIA,
  maiuscula,
  pessoas as nPessoas,
} from "./textosDosBeneficios";

export const ADICIONAR_TITULO_ID = "beneficio-adicionar-titulo";

export function AdicionarPessoasDoBeneficio({
  servico,
  beneficioId,
  nome,
  competenciaInicial,
  onSair,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly nome: string;
  readonly competenciaInicial: string;
  readonly onSair: (mensagem?: string) => void;
}) {
  const atual = competenciaDoMesAtual();
  const opcoes = [0, 1, 2].map((d) => competenciaVizinha(atual, d));
  const [aPartirDe, setAPartirDe] = useState(
    opcoes.includes(competenciaInicial) ? competenciaInicial : atual,
  );
  const [desligados, setDesligados] = useState(false);
  const [lista, setLista] = useState<PessoaDoBeneficioApi[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [contrato, setContrato] = useState("");
  const [pilula, setPilula] = useState<"todos" | "marcados" | "nao">("todos");
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await servico.candidatosDoBeneficio(
        beneficioId,
        aPartirDe,
        desligados,
      );
      setLista(r.pessoas);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [servico, beneficioId, aPartirDe, desligados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const departamentos = useMemo(
    () => [
      ...new Map(
        (lista ?? [])
          .filter((p) => p.departamentoId)
          .map((p) => [p.departamentoId!, p.departamento ?? ""]),
      ).entries(),
    ],
    [lista],
  );
  const contratos = useMemo(
    () => [...new Set((lista ?? []).map((p) => p.contrato))],
    [lista],
  );
  const visiveis = (lista ?? []).filter((p) => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()))
      return false;
    if (departamento && p.departamentoId !== departamento) return false;
    if (contrato && p.contrato !== contrato) return false;
    const m = marcados.includes(p.colaboradorId);
    if (pilula === "marcados") return m;
    if (pilula === "nao") return !m;
    return true;
  });
  const escolhidos = (lista ?? []).filter((p) =>
    marcados.includes(p.colaboradorId),
  );
  const empresa = escolhidos.reduce((t, p) => t + p.empresa, 0);
  const todos =
    visiveis.length > 0 &&
    visiveis.every((p) => marcados.includes(p.colaboradorId));

  async function adicionar() {
    setSalvando(true);
    setFalha(null);
    try {
      const r = await servico.adicionarPessoasAoBeneficio(
        beneficioId,
        aPartirDe,
        marcados.map((colaboradorId) => ({ colaboradorId })),
      );
      onSair(
        `${nPessoas(r.adicionadas)} ${r.adicionadas === 1 ? "adicionada" : "adicionadas"} a partir de ${formatarMesReferencia(aPartirDe)}.`,
      );
    } catch {
      setFalha("Não foi possível adicionar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="beneficios beneficios--com-rodape">
      <header className="beneficios__cabecalho">
        <IconButton
          label={`Voltar para ${nome}`}
          icon={<IconeVoltar tamanho={18} />}
          onClick={() => onSair()}
        />
        <div className="beneficios__titulos">
          <h1 id={ADICIONAR_TITULO_ID} className="beneficios__titulo">
            Adicionar pessoas
          </h1>
          <p className="beneficios__subtitulo">
            {lista
              ? `${nome} · ${lista.length === 1 ? "1 colaborador ainda não recebe" : `${lista.length} colaboradores ainda não recebem`} este benefício.`
              : nome}
          </p>
        </div>
      </header>

      <div className="beneficios__filtros">
        <input
          type="search"
          className="beneficios__busca"
          aria-label="Buscar colaborador"
          placeholder="Nome do colaborador"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          aria-label="Departamento"
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
        >
          <option value="">Departamento: todos</option>
          {departamentos.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Contrato"
          value={contrato}
          onChange={(e) => setContrato(e.target.value)}
        >
          <option value="">Contrato: todos</option>
          {contratos.map((c) => (
            <option key={c} value={c}>
              {(ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[c] ?? c}
            </option>
          ))}
        </select>
        <label className="beneficios__chip">
          <input
            type="checkbox"
            checked={desligados}
            onChange={(e) => setDesligados(e.target.checked)}
          />
          Incluir desligados
        </label>
      </div>
      <div role="tablist" aria-label="Mostrar" className="beneficios__pilulas">
        {(
          [
            ["todos", "Todos", lista?.length ?? 0],
            ["marcados", "Marcados", marcados.length],
            ["nao", "Não marcados", (lista?.length ?? 0) - marcados.length],
          ] as const
        ).map(([v, r, n]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={pilula === v}
            onClick={() => setPilula(v)}
          >
            {r} <span className="beneficios__contagem">{n}</span>
          </button>
        ))}
      </div>

      {falhou ? (
        <div className="beneficios__erro" role="alert">
          <p>Não foi possível carregar as pessoas.</p>
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : !lista ? (
        <p role="status" className="beneficios__suave">
          Carregando…
        </p>
      ) : lista.length === 0 ? (
        <p className="beneficios__suave beneficios__sem-linhas">
          Todas as pessoas ativas já recebem este benefício.
        </p>
      ) : (
        <div className="beneficios__tabela-caixa">
          <table
            className="beneficios__tabela"
            aria-label="Pessoas que ainda não recebem"
          >
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os visíveis"
                    checked={todos}
                    onChange={(e) =>
                      setMarcados((m) =>
                        e.target.checked
                          ? [
                              ...new Set([
                                ...m,
                                ...visiveis.map((p) => p.colaboradorId),
                              ]),
                            ]
                          : m.filter(
                              (x) =>
                                !visiveis.some((p) => p.colaboradorId === x),
                            ),
                      )
                    }
                  />
                </th>
                <th scope="col">Colaborador</th>
                <th scope="col">Departamento</th>
                <th scope="col">Contrato</th>
                <th scope="col" className="beneficios__numero">
                  Valor previsto/mês
                </th>
                <th scope="col" className="beneficios__numero">
                  Desconto previsto
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr
                  key={p.colaboradorId}
                  data-marcada={marcados.includes(p.colaboradorId) || undefined}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Marcar ${p.nome}`}
                      checked={marcados.includes(p.colaboradorId)}
                      onChange={(e) =>
                        setMarcados((m) =>
                          e.target.checked
                            ? [...m, p.colaboradorId]
                            : m.filter((x) => x !== p.colaboradorId),
                        )
                      }
                    />
                  </td>
                  <td>
                    <PessoaNaLinha
                      nome={p.nome}
                      detalhe={p.cargo}
                      alerta={p.desligado ? "Desligado" : null}
                    />
                  </td>
                  <td>{p.departamento ?? "—"}</td>
                  <td>
                    {(ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[
                      p.contrato
                    ] ?? p.contrato}
                  </td>
                  <td className="beneficios__numero">
                    {formatarCentavos(p.valor)}
                  </td>
                  <td className="beneficios__numero beneficios__forte">
                    {p.pendencia ? (
                      <span className="beneficios__alerta">
                        {TEXTO_DA_PENDENCIA[p.pendencia]}
                      </span>
                    ) : p.observacao === "estagio_sem_desconto" ? (
                      <span>
                        —{" "}
                        <span className="beneficios__suave">
                          {TEXTO_DA_OBSERVACAO.estagio_sem_desconto}
                        </span>
                      </span>
                    ) : (
                      formatarCentavos(p.desconto)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="beneficios__rodape-fixo">
        <label className="beneficios__campo-rotulado">
          <span>Entram a partir de</span>
          <select
            value={aPartirDe}
            onChange={(e) => setAPartirDe(e.target.value)}
          >
            {opcoes.map((c) => (
              <option key={c} value={c}>
                {`${maiuscula(formatarCompetenciaPorExtenso(c, "barra"))} · valores previstos`}
              </option>
            ))}
          </select>
        </label>
        <span className="beneficios__rodape-resumo">
          <strong>{nPessoas(marcados.length)}</strong>
          <span className="beneficios__suave">{`+ ${formatarCentavos(empresa)}/mês para a empresa`}</span>
        </span>
        {falha ? (
          <span className="beneficios__erro" role="alert">
            {falha}
          </span>
        ) : null}
        <Button variant="secondary" onClick={() => onSair()}>
          Cancelar
        </Button>
        <Button
          disabled={marcados.length === 0 || salvando}
          onClick={() => void adicionar()}
        >
          {`Adicionar ${nPessoas(marcados.length)}`}
        </Button>
      </div>
    </div>
  );
}
