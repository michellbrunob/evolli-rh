/**
 * T198 — ficha unificada do colaborador, em PÁGINA PRÓPRIA (D17), no lugar do
 * modal aberto pela listagem (D22). Cada aba tem endereço próprio (D18): a
 * rota é `#/pessoas/colaboradores/:id/:aba`, e é o shell quem a lê e escreve.
 *
 * Só contratos que já existem (D20), sem endpoint novo:
 * - `GET /v1/colaboradores/:id` e `/:id/vinculos` — nome e vínculos, no escopo
 *   da sessão (colaborador de outra empresa: 404, e a página diz "não
 *   encontrado", sem sugerir que exista);
 * - `GET /v1/vinculos/:id/alocacoes` — a lotação vigente do vínculo principal
 *   (a alocação aberta, `vigenteAte === null`);
 * - `GET /v1/cargos/:id` e `/v1/departamentos/:id` — os nomes, pelo id, sem o
 *   teto de 100 dos catálogos;
 * - `GET /v1/horarios/vinculos?colaboradorId=` — a jornada vigente.
 *
 * O cabeçalho segue a regra da listagem (T184, T185): vínculo principal pela
 * mesma ordem (`vinculoPrincipal`); lotação e jornada vigentes só para vínculo
 * ATIVO; previsto ou encerrado diz "Sem lotação vigente" e "Sem jornada
 * vigente". A admissão é a data do servidor; "tempo de empresa" não é
 * calculado aqui (D19). Contatos ficam só na aba de dados (D19).
 *
 * As abas reaproveitam as seções que já existiam (dados pessoais, contatos,
 * vida funcional, jornada) e a tela de Dados contratuais, já fixada neste
 * colaborador. Edição: as mesmas regras de antes — dados e contatos para RH e
 * DP, jornada só para o RH, `master_tecnico` só lê (D23). Quem recusa é o
 * servidor.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Button,
  DataTable,
  FormActions,
  FormField,
  Modal,
  StatusBadge,
  TrilhaNavegacao,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type ColaboradorApi,
  type RetificarColaboradorDto,
  type SituacaoVinculo,
  type TipoVinculo,
  type VinculoApi,
  buscarColaborador,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import { buscarCargo } from "../../api/cargoClient";
import { buscarDepartamento } from "../../api/organizacaoClient";
import { listarAlocacoesVinculo } from "../../api/vinculoContratualClient";
import {
  type VinculoHorarioApi,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { destinoPorId, tituloDoGrupoDe } from "../../app/mapaNavegacao";
import { type AbaDaFicha, ABAS_DA_FICHA } from "../../app/rotasDoShell";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { formatarDiaCivil } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import { ContatosColaboradorSecao } from "./ContatosColaboradorSecao";
import { DadosContratuaisScreen } from "./DadosContratuaisScreen";
import { DadosPessoaisColaboradorSecao } from "./DadosPessoaisColaboradorSecao";
import { JornadaColaboradorSecao } from "./JornadaColaboradorSecao";
import {
  type AlvoHistoricoFuncional,
  VidaFuncionalColaboradorSecao,
} from "./VidaFuncionalColaboradorSecao";
import { jornadaDeHoje, rotuloDaJornada } from "./jornadaColaborador";
import { vinculoPrincipal } from "./vinculoPrincipal";
import "./FichaColaboradorScreen.css";

/** `id` do `h1` da ficha: o shell rotula o `<main>` por ele. */
export const FICHA_COLABORADOR_TITULO_ID = "ficha-colaborador-titulo";

/** Rótulo de cada aba, na ordem da navegação interna. */
export const ROTULO_DA_ABA: Readonly<Record<AbaDaFicha, string>> = {
  dados: "Dados do colaborador",
  "vida-funcional": "Vida funcional",
  contratuais: "Dados contratuais",
  jornada: "Jornada de trabalho",
};

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const ROTULO_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  ativo: "Ativo",
  previsto: "Previsto",
  encerrado: "Encerrado",
};

const VARIANTE_SITUACAO_VINCULO: Record<SituacaoVinculo, StatusVariant> = {
  ativo: "success",
  previsto: "info",
  encerrado: "neutral",
};

/** Dia civil do navegador, `AAAA-MM-DD` — a mesma regra da listagem (T185). */
function diaDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** 403 ou 404 do servidor: fora do escopo da sessão — nunca "erro". */
function semAcesso(erro: unknown): boolean {
  const status = (erro as { status?: unknown } | null)?.status;
  return status === 403 || status === 404;
}

/** Referência resolvida pelo id: código, nome e se segue ativa. */
interface ReferenciaDaFicha {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ativa: boolean;
}

type EstadoDoColaborador =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "nao-encontrado" }
  | { readonly tipo: "erro" }
  | {
      readonly tipo: "dados";
      readonly colaborador: ColaboradorApi;
      readonly vinculos: readonly VinculoApi[];
    };

type EstadoDaLotacao =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "sem-lotacao" }
  | { readonly tipo: "erro" }
  | {
      readonly tipo: "dados";
      readonly vinculoId: string;
      readonly cargo: ReferenciaDaFicha | null;
      readonly departamento: ReferenciaDaFicha | null;
    };

type EstadoDaJornada =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "erro" }
  | { readonly tipo: "dados"; readonly vigente: VinculoHorarioApi | null };

export interface FichaColaboradorScreenProps {
  readonly colaboradorId: string;
  /** A aba exibida — vem da rota. */
  readonly aba: AbaDaFicha;
  /** Pede outra aba: o shell troca a rota, e a nova aba volta por `aba`. */
  readonly onTrocarAba: (aba: AbaDaFicha) => void;
  /** Volta à listagem de Colaboradores. */
  readonly onVoltar: () => void;
  /** T181 — dados pessoais, endereço e contatos editáveis (RH e DP). */
  readonly podeEditarFicha?: boolean;
  /** T183 — atribuir, trocar e encerrar jornada (só o RH). */
  readonly podeOperarJornada?: boolean;
  /** T187 — atalho da Vida funcional para o Histórico funcional. */
  readonly onAbrirHistoricoFuncional?: (alvo: AlvoHistoricoFuncional) => void;
  /** T176 — "Completar contatos" da Nova admissão: foco nos contatos. */
  readonly focarContatos?: boolean;
  /** Dia civil de referência (testes); padrão: hoje no navegador. */
  readonly hoje?: string;
}

export function FichaColaboradorScreen({
  colaboradorId,
  aba,
  onTrocarAba,
  onVoltar,
  podeEditarFicha = false,
  podeOperarJornada = false,
  onAbrirHistoricoFuncional,
  focarContatos = false,
  hoje = diaDeHoje(),
}: FichaColaboradorScreenProps) {
  const prefixo = useId();
  const idDaAba = (a: AbaDaFicha) => `${prefixo}-aba-${a}`;
  const idDoPainel = (a: AbaDaFicha) => `${prefixo}-painel-${a}`;
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  const [estado, setEstado] = useState<EstadoDoColaborador>({
    tipo: "carregando",
  });
  const [lotacao, setLotacao] = useState<EstadoDaLotacao>({
    tipo: "carregando",
  });
  const [jornada, setJornada] = useState<EstadoDaJornada>({
    tipo: "carregando",
  });
  /** Abas já abertas: ficam montadas (escondidas), sem perder edição. */
  const [abasVisitadas, setAbasVisitadas] = useState<ReadonlySet<AbaDaFicha>>(
    () => new Set([aba]),
  );

  // Edição em andamento em qualquer bloco da ficha.
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const salvandoNomeRef = useRef(false);
  const [contatosAlterados, setContatosAlterados] = useState(false);
  const [salvandoContatos, setSalvandoContatos] = useState(false);
  const [dadosPessoaisAlterados, setDadosPessoaisAlterados] = useState(false);
  const [salvandoDadosPessoais, setSalvandoDadosPessoais] = useState(false);
  const [jornadaAlterada, setJornadaAlterada] = useState(false);
  const [salvandoJornada, setSalvandoJornada] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const colaborador = estado.tipo === "dados" ? estado.colaborador : null;
  const vinculos = estado.tipo === "dados" ? estado.vinculos : [];
  const principal = estado.tipo === "dados" ? vinculoPrincipal(vinculos) : null;
  const nomeAlterado =
    colaborador !== null && nomeEdicao.trim() !== colaborador.nome;
  const alterada =
    nomeAlterado ||
    contatosAlterados ||
    dadosPessoaisAlterados ||
    jornadaAlterada;
  const salvando =
    salvandoNome ||
    salvandoContatos ||
    salvandoDadosPessoais ||
    salvandoJornada;

  // T189 — edição não salva ou gravação em curso: a troca de empresa avisa
  // antes de descartar, como fazia o modal.
  useEdicaoEmAndamento("Ficha do colaborador", {
    pendente: alterada,
    salvando,
  });

  // ---- Leitura do colaborador e dos vínculos ------------------------------
  // A página é remontada por colaborador (a `key` é o id): uma resposta
  // atrasada só vale enquanto ESTA montagem estiver viva.
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);

  const carregarColaborador = useCallback(async () => {
    setEstado({ tipo: "carregando" });
    try {
      const [dados, lista] = await Promise.all([
        buscarColaborador(colaboradorId),
        listarVinculosDoColaborador(colaboradorId),
      ]);
      if (!vivaRef.current) return;
      setEstado({ tipo: "dados", colaborador: dados, vinculos: lista });
      setNomeEdicao(dados.nome);
    } catch (erro) {
      if (!vivaRef.current) return;
      setEstado({ tipo: semAcesso(erro) ? "nao-encontrado" : "erro" });
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregarColaborador();
  }, [carregarColaborador]);

  // ---- Lotação vigente do vínculo principal (só ativo) --------------------
  const principalId = principal?.id ?? null;
  const principalAtivo = principal?.situacao === "ativo";
  const carregarLotacao = useCallback(async (vinculoId: string) => {
    setLotacao({ tipo: "carregando" });
    try {
      const alocacoes = await listarAlocacoesVinculo(vinculoId);
      const vigente = alocacoes.find((a) => a.vigenteAte === null) ?? null;
      if (!vigente) {
        if (vivaRef.current) setLotacao({ tipo: "sem-lotacao" });
        return;
      }
      const [cargo, departamento] = await Promise.all([
        vigente.cargoId ? buscarCargo(vigente.cargoId) : null,
        vigente.departamentoId
          ? buscarDepartamento(vigente.departamentoId)
          : null,
      ]);
      if (!vivaRef.current) return;
      const referencia = (
        r: { id: string; codigo: string; nome: string; status: string } | null,
      ): ReferenciaDaFicha | null =>
        r
          ? {
              id: r.id,
              codigo: r.codigo,
              nome: r.nome,
              ativa: r.status === "ativo",
            }
          : null;
      setLotacao({
        tipo: "dados",
        vinculoId,
        cargo: referencia(cargo),
        departamento: referencia(departamento),
      });
    } catch {
      if (vivaRef.current) setLotacao({ tipo: "erro" });
    }
  }, []);

  useEffect(() => {
    if (estado.tipo !== "dados") return;
    if (!principalId || !principalAtivo) {
      setLotacao({ tipo: "sem-lotacao" });
      return;
    }
    void carregarLotacao(principalId);
  }, [estado.tipo, principalId, principalAtivo, carregarLotacao]);

  // ---- Jornada vigente (só com vínculo ativo) -----------------------------
  const carregarJornada = useCallback(async () => {
    setJornada({ tipo: "carregando" });
    try {
      const resposta = await listarVinculosHorario({
        colaboradorId,
        tamanhoPagina: 100,
      });
      if (!vivaRef.current) return;
      setJornada({
        tipo: "dados",
        vigente: jornadaDeHoje(resposta.itens, hoje),
      });
    } catch {
      if (vivaRef.current) setJornada({ tipo: "erro" });
    }
  }, [colaboradorId, hoje]);

  useEffect(() => {
    if (estado.tipo !== "dados") return;
    if (!principalAtivo) {
      setJornada({ tipo: "dados", vigente: null });
      return;
    }
    void carregarJornada();
  }, [estado.tipo, principalAtivo, carregarJornada]);

  // ---- Foco -----------------------------------------------------------------
  // Ao abrir (ou ao trocar de colaborador, que remonta a página), o foco vai
  // ao título quando ele chega: quem usa teclado ou leitor de tela sabe onde
  // está. Na troca de aba, o foco fica na própria aba (ver `aoTeclarNaAba`).
  const focouTituloRef = useRef(false);
  useEffect(() => {
    if (focouTituloRef.current) return;
    if (estado.tipo === "carregando") return;
    focouTituloRef.current = true;
    // "Completar contatos": o foco é da seção de contatos, não do título.
    if (focarContatos && estado.tipo === "dados") return;
    tituloRef.current?.focus();
  }, [estado.tipo, focarContatos]);

  useEffect(() => {
    setAbasVisitadas((atual) =>
      atual.has(aba) ? atual : new Set([...atual, aba]),
    );
  }, [aba]);

  // Título do documento com o nome da pessoa, enquanto a ficha estiver aberta.
  useEffect(() => {
    if (!colaborador) return;
    const anterior = document.title;
    document.title = `${colaborador.nome} — Colaboradores`;
    return () => {
      document.title = anterior;
    };
  }, [colaborador]);

  // ---- Abas: setas, Home e End movem o foco; Enter e Espaço ativam ---------
  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    const atual = ABAS_DA_FICHA.indexOf(
      (evento.currentTarget.dataset.aba ?? aba) as AbaDaFicha,
    );
    let alvo: number | null = null;
    if (evento.key === "ArrowRight") alvo = (atual + 1) % ABAS_DA_FICHA.length;
    if (evento.key === "ArrowLeft")
      alvo = (atual - 1 + ABAS_DA_FICHA.length) % ABAS_DA_FICHA.length;
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = ABAS_DA_FICHA.length - 1;
    if (alvo === null) return;
    evento.preventDefault();
    document.getElementById(idDaAba(ABAS_DA_FICHA[alvo]!))?.focus();
  }

  // ---- Nome -----------------------------------------------------------------
  async function salvarNome() {
    if (!colaborador || salvandoNomeRef.current) return;
    const nome = nomeEdicao.trim();
    if (!nome) {
      setErroNome("Nome é obrigatório.");
      return;
    }
    if (nome.length > 160) {
      setErroNome("Nome deve ter no máximo 160 caracteres.");
      return;
    }
    salvandoNomeRef.current = true;
    setSalvandoNome(true);
    setErroNome(null);
    try {
      const dto: RetificarColaboradorDto = { nome };
      const atualizado = await retificarColaborador(colaborador.id, dto);
      if (!vivaRef.current) return;
      // Só o NOME vem da resposta: a situação devolvida é a global.
      setEstado((prev) =>
        prev.tipo === "dados"
          ? {
              ...prev,
              colaborador: { ...prev.colaborador, nome: atualizado.nome },
            }
          : prev,
      );
      setNomeEdicao(atualizado.nome);
    } catch (erro: unknown) {
      if (!vivaRef.current) return;
      setErroNome(
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar o nome. Tente novamente.",
      );
    } finally {
      salvandoNomeRef.current = false;
      if (vivaRef.current) setSalvandoNome(false);
    }
  }

  // ---- Voltar ---------------------------------------------------------------
  function pedirVoltar() {
    if (salvando) return;
    if (alterada) {
      setConfirmandoSaida(true);
      return;
    }
    onVoltar();
  }

  // ---- Trilha ---------------------------------------------------------------
  const rotuloColaboradores = destinoPorId("pessoas")?.label ?? "Colaboradores";
  const trilha = [
    { rotulo: tituloDoGrupoDe("pessoas") ?? "Gestão de Pessoas" },
    { rotulo: rotuloColaboradores, onSelecionar: pedirVoltar },
    {
      rotulo:
        colaborador?.nome ??
        (estado.tipo === "nao-encontrado"
          ? "Colaborador não encontrado"
          : "Ficha do colaborador"),
    },
  ];

  if (estado.tipo !== "dados") {
    return (
      <div className="ficha-colaborador">
        <TrilhaNavegacao itens={trilha} />
        <h1
          id={FICHA_COLABORADOR_TITULO_ID}
          ref={tituloRef}
          tabIndex={-1}
          className="ficha-colaborador__titulo"
        >
          {estado.tipo === "nao-encontrado"
            ? "Colaborador não encontrado"
            : "Ficha do colaborador"}
        </h1>
        {estado.tipo === "carregando" ? (
          <p role="status" className="ficha-colaborador__texto">
            Carregando a ficha…
          </p>
        ) : estado.tipo === "nao-encontrado" ? (
          <div className="ficha-colaborador__aviso">
            <p className="ficha-colaborador__texto">
              Este colaborador não foi encontrado na empresa ativa.
            </p>
            <Button variant="secondary" onClick={onVoltar}>
              Voltar para {rotuloColaboradores}
            </Button>
          </div>
        ) : (
          <div className="ficha-colaborador__aviso" role="alert">
            <p className="ficha-colaborador__texto">
              Não foi possível carregar a ficha.
            </p>
            <Button
              variant="secondary"
              onClick={() => void carregarColaborador()}
            >
              Tentar de novo
            </Button>
          </div>
        )}
      </div>
    );
  }

  const nome = estado.colaborador.nome;
  // Situação NA EMPRESA ATIVA, como na listagem: ativo se há vínculo ativo
  // nela. A situação de `GET /colaboradores/:id` é a global e não serve aqui.
  const ativoNaEmpresa = vinculos.some((v) => v.situacao === "ativo");
  const outrosVinculos = vinculos.filter((v) => v.id !== principal?.id);

  const colunasVinculos: DataTableColumn<VinculoApi>[] = [
    {
      key: "matricula",
      header: "Matrícula",
      cell: (v) => exibirMatricula(v.matricula),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (v) => ROTULO_TIPO_VINCULO[v.tipo] ?? v.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge variant={VARIANTE_SITUACAO_VINCULO[v.situacao]}>
          {ROTULO_SITUACAO_VINCULO[v.situacao] ?? v.situacao}
        </StatusBadge>
      ),
    },
    {
      key: "admissao",
      header: "Admissão",
      cell: (v) => formatarDiaCivil(v.dataAdmissao),
    },
    {
      key: "desligamento",
      header: "Desligamento",
      cell: (v) => formatarDiaCivil(v.dataDesligamento),
    },
  ];

  /** "COD — Nome", com a marca de inativa quando for o caso. */
  function referenciaNoCabecalho(
    r: ReferenciaDaFicha | null,
    faltando: string,
  ) {
    if (!r) return faltando;
    return (
      <>
        {r.codigo} — {r.nome}
        {r.ativa ? null : " (inativo)"}
      </>
    );
  }

  function lotacaoNoCabecalho() {
    if (!principal) return "Sem vínculo nesta empresa";
    // Previsto ou encerrado: não há lotação vigente, nem o que esperar.
    if (!principalAtivo) return "Sem lotação vigente";
    if (lotacao.tipo === "carregando") return "Carregando lotação…";
    if (lotacao.tipo === "erro") {
      return (
        <>
          Não foi possível carregar a lotação.{" "}
          <Button
            variant="secondary"
            onClick={() => void carregarLotacao(principal.id)}
          >
            Tentar de novo
          </Button>
        </>
      );
    }
    if (lotacao.tipo === "sem-lotacao") return "Sem lotação vigente";
    return (
      <>
        <span>
          Cargo: {referenciaNoCabecalho(lotacao.cargo, "Não informado")}
        </span>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span>
          Departamento:{" "}
          {referenciaNoCabecalho(lotacao.departamento, "Não informado")}
        </span>
      </>
    );
  }

  function jornadaNoCabecalho() {
    if (!principal || !principalAtivo) return "Sem jornada vigente";
    if (jornada.tipo === "carregando") return "Carregando jornada…";
    if (jornada.tipo === "erro") {
      return (
        <>
          Não foi possível carregar a jornada.{" "}
          <Button variant="secondary" onClick={() => void carregarJornada()}>
            Tentar de novo
          </Button>
        </>
      );
    }
    if (!jornada.vigente) return "Sem jornada vigente";
    const tabela = jornada.vigente.tabela;
    return (
      <>
        {rotuloDaJornada(tabela)}
        {tabela.ativo ? null : (
          <>
            {" "}
            <StatusBadge variant="warning">Jornada inativa</StatusBadge>
          </>
        )}
      </>
    );
  }

  // A lotação conhecida, no formato que a Vida funcional já usava (T187).
  const lotacaoDaVidaFuncional =
    lotacao.tipo === "dados"
      ? {
          vinculoId: lotacao.vinculoId,
          lotacao: {
            cargo: lotacao.cargo,
            departamento: lotacao.departamento,
          },
        }
      : null;

  return (
    <div className="ficha-colaborador">
      <TrilhaNavegacao itens={trilha} />

      <header className="ficha-colaborador__cabecalho">
        <div className="ficha-colaborador__identidade">
          <h1
            id={FICHA_COLABORADOR_TITULO_ID}
            ref={tituloRef}
            tabIndex={-1}
            className="ficha-colaborador__titulo"
          >
            {nome}
          </h1>
          <p className="ficha-colaborador__selos">
            <StatusBadge variant={ativoNaEmpresa ? "success" : "neutral"}>
              {ativoNaEmpresa ? "Ativo" : "Inativo"} nesta empresa
            </StatusBadge>
          </p>
          <p className="ficha-colaborador__lotacao">{lotacaoNoCabecalho()}</p>
        </div>

        <dl className="ficha-colaborador__resumo">
          <div className="ficha-colaborador__item">
            <dt>Vínculo principal</dt>
            <dd>
              {principal ? (
                <>
                  {ROTULO_TIPO_VINCULO[principal.tipo] ?? principal.tipo} ·{" "}
                  {exibirMatricula(principal.matricula)} ·{" "}
                  <StatusBadge
                    variant={VARIANTE_SITUACAO_VINCULO[principal.situacao]}
                  >
                    {ROTULO_SITUACAO_VINCULO[principal.situacao]}
                  </StatusBadge>
                </>
              ) : (
                "Sem vínculo nesta empresa"
              )}
            </dd>
          </div>
          <div className="ficha-colaborador__item">
            <dt>Admissão</dt>
            <dd>
              {principal ? formatarDiaCivil(principal.dataAdmissao) : "—"}
            </dd>
          </div>
          {principal?.situacao === "encerrado" ? (
            <div className="ficha-colaborador__item">
              <dt>Desligamento</dt>
              <dd>{formatarDiaCivil(principal.dataDesligamento)}</dd>
            </div>
          ) : null}
          <div className="ficha-colaborador__item">
            <dt>Jornada vigente</dt>
            <dd>{jornadaNoCabecalho()}</dd>
          </div>
        </dl>
      </header>

      <div
        role="tablist"
        aria-label={`Seções da ficha de ${nome}`}
        className="ficha-colaborador__abas"
      >
        {ABAS_DA_FICHA.map((a) => {
          const selecionada = a === aba;
          return (
            <button
              key={a}
              type="button"
              role="tab"
              id={idDaAba(a)}
              data-aba={a}
              aria-selected={selecionada}
              aria-controls={idDoPainel(a)}
              tabIndex={selecionada ? 0 : -1}
              className={
                selecionada
                  ? "ficha-colaborador__aba ficha-colaborador__aba--ativa"
                  : "ficha-colaborador__aba"
              }
              onClick={() => {
                if (!selecionada) onTrocarAba(a);
              }}
              onKeyDown={aoTeclarNaAba}
            >
              {ROTULO_DA_ABA[a]}
            </button>
          );
        })}
      </div>

      {ABAS_DA_FICHA.map((a) =>
        abasVisitadas.has(a) || a === aba ? (
          <section
            key={a}
            role="tabpanel"
            id={idDoPainel(a)}
            aria-labelledby={idDaAba(a)}
            hidden={a !== aba}
            className="ficha-colaborador__painel"
          >
            {/* Vida funcional e Jornada já abrem com o próprio título (h2);
                as outras abas reúnem várias seções, e o h2 as agrupa para
                quem navega por títulos. */}
            {a === "dados" || a === "contratuais" ? (
              <h2 className="ficha-colaborador__so-leitor">
                {ROTULO_DA_ABA[a]}
              </h2>
            ) : null}
            {a === "dados" ? (
              <>
                {podeEditarFicha ? (
                  <div className="ficha-colaborador__nome">
                    <FormField
                      id={`${prefixo}-nome`}
                      label="Nome"
                      {...(erroNome ? { error: erroNome } : {})}
                    >
                      {(control) => (
                        <input
                          type="text"
                          maxLength={160}
                          value={nomeEdicao}
                          onChange={(e) => {
                            setNomeEdicao(e.target.value);
                            setErroNome(null);
                          }}
                          {...control}
                        />
                      )}
                    </FormField>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void salvarNome()}
                      disabled={salvandoNome || !nomeAlterado}
                    >
                      {salvandoNome ? "Salvando…" : "Salvar nome"}
                    </Button>
                  </div>
                ) : null}
                <DadosPessoaisColaboradorSecao
                  colaboradorId={colaboradorId}
                  podeEditar={podeEditarFicha}
                  onAlteradoChange={setDadosPessoaisAlterados}
                  onSalvandoChange={setSalvandoDadosPessoais}
                />
                <ContatosColaboradorSecao
                  colaboradorId={colaboradorId}
                  onAlteradoChange={setContatosAlterados}
                  onSalvandoChange={setSalvandoContatos}
                  focarAoCarregar={focarContatos}
                  podeEditar={podeEditarFicha}
                />
              </>
            ) : a === "vida-funcional" ? (
              <>
                <VidaFuncionalColaboradorSecao
                  key={`vida-${principal?.id ?? "sem-vinculo"}`}
                  colaboradorId={colaboradorId}
                  nomeColaborador={nome}
                  vinculo={principal}
                  lotacaoDaLinha={lotacaoDaVidaFuncional}
                  {...(onAbrirHistoricoFuncional
                    ? { onAbrirHistorico: onAbrirHistoricoFuncional }
                    : {})}
                  atalhoBloqueado={alterada || salvando}
                />
                {outrosVinculos.length > 0 ? (
                  <section className="ficha-colaborador__vinculos">
                    <h2 className="ficha-colaborador__subtitulo">
                      Outros vínculos nesta empresa
                    </h2>
                    <div className="ficha-colaborador__quadro">
                      <DataTable
                        caption={`Outros vínculos — ${nome}`}
                        columns={colunasVinculos}
                        rows={outrosVinculos}
                        rowKey={(v) => v.id}
                      />
                    </div>
                  </section>
                ) : null}
              </>
            ) : a === "contratuais" ? (
              <DadosContratuaisScreen
                colaborador={{ id: colaboradorId, nome }}
              />
            ) : (
              <JornadaColaboradorSecao
                colaboradorId={colaboradorId}
                podeOperar={podeOperarJornada}
                onAlteradoChange={setJornadaAlterada}
                onSalvandoChange={setSalvandoJornada}
              />
            )}
          </section>
        ) : null,
      )}

      <Modal
        aberto={confirmandoSaida}
        titulo="Sair da ficha sem salvar?"
        descricao="Há alterações não salvas nesta ficha. Saindo agora, elas serão descartadas."
        onFechar={() => setConfirmandoSaida(false)}
      >
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmandoSaida(false)}
          >
            Continuar editando
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setConfirmandoSaida(false);
              onVoltar();
            }}
          >
            Sair sem salvar
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}
