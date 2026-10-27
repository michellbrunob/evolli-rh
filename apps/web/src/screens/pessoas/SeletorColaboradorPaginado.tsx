/**
 * T188 — escolha de colaborador por busca, com resultados paginados pelo
 * servidor. Substitui, nas abas Histórico funcional, Dados contratuais e
 * Horário de trabalho, o seletor montado com UMA página de 100
 * (`listarColaboradores({ tamanhoPagina: 100 })`, o teto do servidor), que
 * deixava fora quem passasse do centésimo em ordem alfabética.
 *
 * Usa só o contrato existente `GET /v1/colaboradores` (T178): `busca` por nome
 * ou matrícula, `pagina` e `tamanhoPagina`, e o filtro `situacao` quando a aba
 * pede (ex.: só ativos no Horário). A empresa nunca vai na consulta — é a da
 * sessão —, então ninguém de outra empresa aparece.
 *
 * A seleção é do contêiner (`selecionado`): buscar outro termo ou trocar de
 * página NÃO a desfaz, e ela continua à vista em "Selecionado". Não é um
 * `<form>` porque o Horário o usa dentro do próprio formulário (form dentro de
 * form é HTML inválido): Enter no campo busca, sem enviar o formulário de fora.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "../../components";
import {
  BUSCA_COLABORADORES_MAXIMO,
  listarColaboradores,
  type ColaboradorListadoApi,
  type ListarColaboradoresQuery,
} from "../../api/colaboradoresClient";
import { exibirMatricula } from "../../format/matricula";
import { PaginacaoSimples } from "./PaginacaoSimples";
import "./SeletorColaboradorPaginado.css";

/** O que o contêiner guarda da escolha: o suficiente para mostrar e consultar. */
export interface ColaboradorEscolhido {
  readonly id: string;
  readonly nome: string;
}

export interface SeletorColaboradorPaginadoProps {
  /** Prefixo dos ids dos elementos (único na tela). */
  readonly id: string;
  /** Rótulo do campo de busca. */
  readonly rotulo?: string;
  readonly selecionado: ColaboradorEscolhido | null;
  readonly onSelecionar: (colaborador: ColaboradorEscolhido | null) => void;
  /** Filtro fixo do servidor, ex.: `"ativo"` no Horário de trabalho. */
  readonly situacao?: ListarColaboradoresQuery["situacao"];
  /** Texto do botão que desfaz a escolha; sem ele, não há como desfazer. */
  readonly rotuloLimpar?: string;
  /** Erro de validação do formulário de fora (ex.: "Selecione o colaborador."). */
  readonly erro?: string;
  readonly tamanhoPagina?: number;
  readonly desabilitado?: boolean;
  /**
   * Regra que as abas já tinham: se o escopo inteiro (sem busca) tem UM só
   * colaborador e nada está escolhido, ele é escolhido sozinho. Só na carga
   * inicial — buscar nunca escolhe por conta própria.
   */
  readonly autoSelecionarUnico?: boolean;
}

type Estado =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "erro" }
  | {
      readonly tipo: "dados";
      readonly itens: readonly ColaboradorListadoApi[];
      readonly pagina: number;
      readonly totalPaginas: number;
    };

/** Mesmo corte do servidor: aparado e no teto de 160; vazio é "sem busca". */
function normalizar(termo: string): string {
  return termo.trim().slice(0, BUSCA_COLABORADORES_MAXIMO).trim();
}

export function SeletorColaboradorPaginado({
  id,
  rotulo = "Buscar colaborador por nome ou matrícula",
  selecionado,
  onSelecionar,
  situacao,
  rotuloLimpar,
  erro,
  tamanhoPagina = 10,
  desabilitado = false,
  autoSelecionarUnico = false,
}: SeletorColaboradorPaginadoProps) {
  const [digitado, setDigitado] = useState("");
  const [aplicado, setAplicado] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  // Resposta de uma busca antiga nunca sobrescreve a atual.
  const pedidoRef = useRef(0);
  // Lidos dentro da carga sem refazê-la a cada escolha.
  const selecionadoRef = useRef(selecionado);
  selecionadoRef.current = selecionado;
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;
  const autoSelecaoFeitaRef = useRef(false);

  const carregar = useCallback(
    async (busca: string, pagina: number) => {
      const pedido = ++pedidoRef.current;
      setEstado({ tipo: "carregando" });
      try {
        const query: ListarColaboradoresQuery = { pagina, tamanhoPagina };
        if (busca) query.busca = busca;
        if (situacao) query.situacao = situacao;
        const resp = await listarColaboradores(query);
        if (pedido !== pedidoRef.current) return;
        if (
          autoSelecionarUnico &&
          !autoSelecaoFeitaRef.current &&
          !busca &&
          resp.total === 1 &&
          resp.itens[0] &&
          !selecionadoRef.current
        ) {
          autoSelecaoFeitaRef.current = true;
          onSelecionarRef.current({
            id: resp.itens[0].id,
            nome: resp.itens[0].nome,
          });
        }
        setEstado({
          tipo: "dados",
          itens: resp.itens,
          pagina: resp.pagina,
          totalPaginas: Math.max(
            1,
            Math.ceil(resp.total / (resp.tamanhoPagina || tamanhoPagina)),
          ),
        });
      } catch {
        if (pedido !== pedidoRef.current) return;
        setEstado({ tipo: "erro" });
      }
    },
    [situacao, tamanhoPagina, autoSelecionarUnico],
  );

  useEffect(() => {
    void carregar(aplicado, 1);
  }, [aplicado, carregar]);

  function buscar() {
    const termo = normalizar(digitado);
    setDigitado(termo);
    // O mesmo termo reenviado também relê, desde a página 1.
    if (termo === aplicado) void carregar(termo, 1);
    else setAplicado(termo);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    buscar();
  }

  const idCampo = `${id}-busca`;
  const idErro = `${id}-erro`;
  const idResultados = `${id}-resultados`;

  return (
    <div className="pessoas-seletor-colaborador">
      <label htmlFor={idCampo} className="pessoas-seletor-colaborador__rotulo">
        {rotulo}
      </label>
      <div className="pessoas-seletor-colaborador__busca">
        <input
          id={idCampo}
          type="search"
          value={digitado}
          maxLength={BUSCA_COLABORADORES_MAXIMO}
          disabled={desabilitado}
          onChange={(e) => setDigitado(e.target.value)}
          onKeyDown={aoTeclar}
          aria-controls={idResultados}
          {...(erro
            ? { "aria-describedby": idErro, "aria-invalid": true }
            : {})}
        />
        <Button variant="secondary" disabled={desabilitado} onClick={buscar}>
          Buscar
        </Button>
      </div>
      {erro ? (
        <p id={idErro} className="pessoas-seletor-colaborador__erro">
          {erro}
        </p>
      ) : null}

      <p className="pessoas-seletor-colaborador__selecionado">
        {selecionado ? (
          <>
            Selecionado: <strong>{selecionado.nome}</strong>
            {rotuloLimpar ? (
              <>
                {" "}
                <Button
                  variant="subtle"
                  disabled={desabilitado}
                  onClick={() => onSelecionar(null)}
                >
                  {rotuloLimpar}
                </Button>
              </>
            ) : null}
          </>
        ) : (
          "Nenhum colaborador selecionado."
        )}
      </p>

      <div
        id={idResultados}
        className="pessoas-seletor-colaborador__resultados"
      >
        {estado.tipo === "carregando" ? (
          <p role="status" className="pessoas-seletor-colaborador__nota">
            Buscando colaboradores…
          </p>
        ) : estado.tipo === "erro" ? (
          <p role="alert" className="pessoas-seletor-colaborador__erro">
            Não foi possível buscar os colaboradores.{" "}
            <Button
              variant="secondary"
              onClick={() => void carregar(aplicado, 1)}
            >
              Tentar novamente
            </Button>
          </p>
        ) : estado.itens.length === 0 ? (
          <p className="pessoas-seletor-colaborador__nota">
            {aplicado
              ? `Nenhum colaborador encontrado para “${aplicado}”.`
              : "Nenhum colaborador no seu escopo."}
          </p>
        ) : (
          <>
            <ul
              aria-label="Colaboradores encontrados"
              className="pessoas-seletor-colaborador__lista"
            >
              {estado.itens.map((c) => {
                const escolhido = selecionado?.id === c.id;
                const matricula = c.vinculos[0]
                  ? exibirMatricula(c.vinculos[0].matricula)
                  : null;
                return (
                  <li key={c.id}>
                    <Button
                      variant={escolhido ? "primary" : "subtle"}
                      aria-pressed={escolhido}
                      disabled={desabilitado}
                      onClick={() => onSelecionar({ id: c.id, nome: c.nome })}
                    >
                      {c.nome}
                      {matricula ? (
                        <span className="pessoas-seletor-colaborador__matricula">
                          {" "}
                          · {matricula}
                        </span>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <PaginacaoSimples
              rotulo="Páginas de colaboradores encontrados"
              pagina={estado.pagina}
              totalPaginas={estado.totalPaginas}
              onIrPara={(p) => void carregar(aplicado, p)}
            />
          </>
        )}
      </div>
    </div>
  );
}
