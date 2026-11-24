/**
 * T215 — a ficha do colaborador no desenho da referência (decisão de
 * 2026-11-23: mesma organização e mesmos textos):
 *
 * - **Cabeçalho:** faixa, foto, nome, status, tipo de contrato e cargo; à
 *   direita, ⋯ Mais ações, Exportar ficha e Editar colaborador.
 * - **Faixa de resumo:** E-mail, Telefone, Tempo de casa e Carga horária
 *   (e escala).
 * - **Portal do colaborador:** o estado do acesso (o Portal ainda não existe
 *   no Evolli: o convite fica indisponível, com o motivo dito).
 * - **Abas:** Dados do colaborador, Salários, Férias e ausências, Escala,
 *   Benefícios, Pesquisas, Documentos, Desenvolvimento e Comentários. Elas
 *   chegam uma a uma; a primeira é a de Dados, com os quatro cartões, cada
 *   um com "Editar" levando à seção certa da página Editar colaborador.
 *
 * Mais ações: Enviar convite do portal (indisponível), Registrar ausência,
 * Alterar status, Desligar colaborador (movimentação de desligamento, com a
 * data) e Desativar colaborador (decisão de 2026-11-23: nada é apagado).
 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ColaboradorApi,
  type VinculoApi,
  buscarColaborador,
  listarVinculosDoColaborador,
} from "../../../api/colaboradoresClient";
import {
  type ContratoDoColaboradorApi,
  consultarContratoDoColaborador,
  desativarColaborador,
  reativarColaborador,
} from "../../../api/edicaoColaboradorClient";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
} from "../../../api/dadosPessoaisClient";
import {
  type ContatosApi,
  consultarContatosDoColaborador,
} from "../../../api/contatosColaboradorClient";
import {
  efetivarMovimentacao,
  registrarMovimentacao,
} from "../../../api/movimentacaoClient";
import { useTrilhaComplementar } from "../../../app/trilhaComplementar";
import { AREAS_DE_EDICAO, AreaDeEdicao } from "../../../app/edicoesPendentes";
import { Button, FormActions } from "../../../components";
import type { StatusVariant } from "../../../components";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui";
import {
  IconeBaixarArquivo,
  IconeCalendario,
  IconeEditar,
  IconeMaisAcoes,
} from "../../../ui/icones";
import { formatarDiaCivil } from "../../../format/data";
import { exibirTelefone } from "../../../format/mascaras";
import { exibirCep } from "../../../format/mascaras";
import { imprimirSomente } from "../../dashboard/exportacao";
import { FotoDoColaborador } from "../FotoDoColaborador";
import { vinculoPrincipal } from "../vinculoPrincipal";
import {
  OPCOES_GENERO,
  OPCOES_NIVEL,
  mascararCpf,
} from "../NovaAdmissaoScreen";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../edicao/dadosProfissionais";
import { RegistrarAusenciaGaveta } from "../ferias/RegistrarAusenciaGaveta";
import { servicoDeAusenciasDoServidor } from "../ferias/servicoDeAusenciasDoServidor";
import type { ServicoDeAusencias } from "../ferias/tiposAusencia";
import { AbaEscala } from "./escala/AbaEscala";
import { primeiroNome } from "../tratamento";
import { ArquivosDoColaborador } from "../documentos/ArquivosDoColaborador";
import { useLotacaoVigente } from "./useLotacaoVigente";
import { AbaSalarios } from "./salarios/AbaSalarios";
import { AbaFeriasEAusencias } from "./ferias/AbaFeriasEAusencias";
import { tratamentoDe } from "../tratamento";
import { AvisoAnimado, ehAvisoDeFalha } from "../../../ui/movimento";
import {
  IconeAbaBeneficios,
  IconeAbaComentarios,
  IconeAbaDados,
  IconeAbaDesenvolvimento,
  IconeAbaDocumentos,
  IconeAbaEscala,
  IconeAbaFerias,
  IconeAbaPesquisas,
  IconeAbaSalarios,
  IconeCartaoEmergencia,
  IconeCartaoEndereco,
  IconeCartaoPessoais,
  IconeCartaoProfissionais,
  IconeResumoEmail,
  IconeResumoHorario,
  IconeResumoTelefone,
  IconeResumoTempo,
  IconePortal,
} from "./iconesDaFicha";
import "./FichaDoColaborador.css";

export const FICHA_DO_COLABORADOR_TITULO_ID = "ficha-do-colaborador-titulo";

/** 403 ou 404 do servidor: fora do escopo da sessão — nunca "erro". */
function semAcesso(erro: unknown): boolean {
  const status = (erro as { status?: unknown } | null)?.status;
  return status === 403 || status === 404;
}

export const ABAS_DA_FICHA_DE_REFERENCIA = [
  "dados",
  "salarios",
  "ferias",
  "escala",
  "beneficios",
  "pesquisas",
  "documentos",
  "desenvolvimento",
  "comentarios",
] as const;
export type AbaDaFichaDeReferencia =
  (typeof ABAS_DA_FICHA_DE_REFERENCIA)[number];

/** Seções da página "Editar colaborador" que os cartões abrem. */
export type SecaoDeEdicaoDaFicha =
  "dados-basicos" | "dados-profissionais" | "endereco";

const ROTULO_DA_ABA: Readonly<Record<AbaDaFichaDeReferencia, string>> = {
  dados: "Dados do colaborador",
  salarios: "Salários",
  ferias: "Férias e ausências",
  escala: "Escala",
  beneficios: "Benefícios",
  pesquisas: "Pesquisas",
  documentos: "Documentos",
  desenvolvimento: "Desenvolvimento",
  comentarios: "Comentários",
};

const ICONE_DA_ABA: Readonly<
  Record<AbaDaFichaDeReferencia, () => JSX.Element>
> = {
  dados: IconeAbaDados,
  salarios: IconeAbaSalarios,
  ferias: IconeAbaFerias,
  escala: IconeAbaEscala,
  beneficios: IconeAbaBeneficios,
  pesquisas: IconeAbaPesquisas,
  documentos: IconeAbaDocumentos,
  desenvolvimento: IconeAbaDesenvolvimento,
  comentarios: IconeAbaComentarios,
};

const VAZIO = "—";

// ---- regras de exibição -----------------------------------------------------

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return `${p[0]?.[0] ?? ""}${p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : ""}`.toUpperCase();
}

/** Diferença em anos e meses entre dois dias civis (`AAAA-MM-DD`). */
function anosEMeses(de: string, ate: string): { anos: number; meses: number } {
  const [a1, m1, d1] = de.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [a2, m2, d2] = ate.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  let total = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) total -= 1;
  total = Math.max(0, total);
  return { anos: Math.floor(total / 12), meses: total % 12 };
}

export function tempoDeCasa(admissao: string, hoje: string): string {
  const { anos, meses } = anosEMeses(admissao, hoje);
  const a = anos === 1 ? "1 ano" : `${anos} anos`;
  const m = meses === 1 ? "1 mês" : `${meses} meses`;
  if (anos === 0 && meses === 0) return "menos de 1 mês";
  if (anos === 0) return m;
  if (meses === 0) return a;
  return `${a} e ${m}`;
}

function idade(nascimento: string, hoje: string): number {
  return anosEMeses(nascimento, hoje).anos;
}

function diaDeHoje(): string {
  const agora = new Date();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${m}-${d}`;
}

type Status = "ativo" | "inativo" | "desligado" | "em_admissao";
const ROTULO_DO_STATUS: Readonly<
  Record<Status, { rotulo: string; variante: StatusVariant }>
> = {
  ativo: { rotulo: "Ativo", variante: "success" },
  inativo: { rotulo: "Inativo", variante: "neutral" },
  desligado: { rotulo: "Desligado", variante: "danger" },
  em_admissao: { rotulo: "Em admissão", variante: "info" },
};

/* O tratamento (o/a, ele/ela, convidado/convidada) vem do gênero do
   cadastro: `tratamentoDe` (screens/pessoas/tratamento.ts). */

// ---- peças --------------------------------------------------------------------

function Campo({
  rotulo,
  children,
}: {
  readonly rotulo: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="ficha-ref__campo">
      <dt className="ficha-ref__campo-rotulo">{rotulo}</dt>
      <dd className="ficha-ref__campo-valor">{children}</dd>
    </div>
  );
}

function Cartao({
  titulo,
  subtitulo,
  icone,
  onEditar,
  className,
  children,
}: {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly icone: ReactNode;
  readonly onEditar?: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={
        className ? `ficha-ref__cartao ${className}` : "ficha-ref__cartao"
      }
      aria-labelledby={id}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="ficha-ref__cartao-textos">
          <h3 id={id} className="ficha-ref__cartao-titulo">
            {titulo}
          </h3>
          <span className="ficha-ref__cartao-subtitulo">{subtitulo}</span>
        </span>
        {onEditar ? (
          <button
            type="button"
            className="ficha-ref__editar"
            onClick={onEditar}
          >
            <IconeEditar tamanho={14} />
            Editar
          </button>
        ) : null}
      </header>
      <dl className="ficha-ref__campos">{children}</dl>
    </section>
  );
}

// ---- a ficha --------------------------------------------------------------------

export interface FichaDoColaboradorProps {
  readonly colaboradorId: string;
  readonly aba: AbaDaFichaDeReferencia;
  readonly onTrocarAba: (aba: AbaDaFichaDeReferencia) => void;
  readonly onVoltar: () => void;
  /** RH e DP: editam, desligam e desativam. */
  readonly podeEditar?: boolean;
  /** Abre a página "Editar colaborador" na seção pedida. */
  readonly onEditar?: (secao: SecaoDeEdicaoDaFicha) => void;
  /** RH e DP definem, alteram e encerram a escala (aba Escala). */
  readonly podeOperarEscala?: boolean;
  /** Abre Jornadas de trabalho (os turnos da escala). */
  readonly onAbrirJornadas?: () => void;
  readonly servicoDeAusencias?: ServicoDeAusencias;
  /** Dia civil de hoje (testes). */
  readonly hoje?: string;
}

interface Dados {
  readonly colaborador: ColaboradorApi;
  readonly vinculo: VinculoApi | null;
  readonly contrato: ContratoDoColaboradorApi | null;
  readonly pessoais: DadosPessoaisDoColaboradorApi | null;
  readonly contatos: ContatosApi | null;
}

type Janela = "desligar" | "desativar" | "reativar" | null;

export function FichaDoColaborador({
  colaboradorId,
  aba,
  onTrocarAba,
  onVoltar,
  podeEditar = false,
  onEditar,
  podeOperarEscala = false,
  onAbrirJornadas,
  servicoDeAusencias = servicoDeAusenciasDoServidor,
  hoje = diaDeHoje(),
}: FichaDoColaboradorProps) {
  const base = useId();
  const [dados, setDados] = useState<Dados | null>(null);
  const [falha, setFalha] = useState<false | "erro" | "nao-encontrado">(false);
  const [gestor, setGestor] = useState<string | null>(null);
  const [janela, setJanela] = useState<Janela>(null);
  const [dataDesligamento, setDataDesligamento] = useState(hoje);
  const [trabalhando, setTrabalhando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    setFalha(false);
    try {
      const [colaborador, vinculos] = await Promise.all([
        buscarColaborador(colaboradorId),
        listarVinculosDoColaborador(colaboradorId),
      ]);
      // Os blocos de dados podem ser negados ao papel: cada um falha sozinho.
      const [contrato, pessoais, contatos] = await Promise.all([
        consultarContratoDoColaborador(colaboradorId).catch(() => null),
        consultarDadosPessoaisDoColaborador(colaboradorId).catch(() => null),
        consultarContatosDoColaborador(colaboradorId)
          .then((c) => c.contatos)
          .catch(() => null),
      ]);
      setDados({
        colaborador,
        vinculo: vinculoPrincipal(vinculos),
        contrato,
        pessoais,
        contatos,
      });
    } catch (erro) {
      setFalha(semAcesso(erro) ? "nao-encontrado" : "erro");
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Abrir a ficha leva o foco ao título (a página trocou; o leitor anuncia).
  useEffect(() => {
    document.getElementById(FICHA_DO_COLABORADOR_TITULO_ID)?.focus();
  }, [colaboradorId, falha]);

  const gestorId = dados?.contrato?.contrato.gestorDiretoId ?? null;
  useEffect(() => {
    setGestor(null);
    if (!gestorId) return;
    let vivo = true;
    buscarColaborador(gestorId)
      .then((g) => vivo && setGestor(g.nome))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [gestorId]);

  const lotacao = useLotacaoVigente(dados?.vinculo?.id ?? null);
  const nome = dados?.colaborador.nome ?? "";
  // A gaveta recomeça quando a pessoa muda: o objeto não pode mudar a cada desenho.
  // A aba Férias relê quando a gaveta do ⋯ registra uma ausência.
  const [versaoDasAusencias, setVersaoDasAusencias] = useState(0);
  const pessoaDaGaveta = useMemo(
    () =>
      dados ? { id: colaboradorId, nome, cargo: lotacao.cargo || null } : null,
    [dados, colaboradorId, nome, lotacao.cargo],
  );
  useTrilhaComplementar(
    nome ||
      (falha === "nao-encontrado"
        ? "Colaborador não encontrado"
        : "Ficha do colaborador"),
    onVoltar,
  );

  const perfil = dados?.pessoais?.perfilPessoal ?? null;
  const endereco = dados?.pessoais?.endereco ?? null;
  const trato = tratamentoDe(perfil?.genero, nome);
  const vinculo = dados?.vinculo ?? null;
  const contrato = dados?.contrato?.contrato ?? null;
  const desativado = dados?.contrato?.desativado ?? false;
  // Sem vínculo na empresa ativa, vale a situação do cadastro.
  const status: Status = desativado
    ? "inativo"
    : !vinculo && dados
      ? dados.colaborador.situacao === "ativo"
        ? "ativo"
        : "inativo"
      : vinculo?.situacao === "encerrado"
        ? "desligado"
        : vinculo?.situacao === "previsto"
          ? "em_admissao"
          : "ativo";
  const email = dados?.contatos?.emailPessoal ?? null;
  const telefone = dados?.contatos?.celular ?? null;
  const escala = contrato?.escala ?? null;
  const horas = contrato?.jornadaSemanalHoras ?? null;
  const cargaHoraria =
    horas !== null && escala
      ? `${horas}h semanais · ${escala}`
      : horas !== null
        ? `${horas}h semanais`
        : (escala ?? VAZIO);
  const nivel = contrato?.nivel
    ? (OPCOES_NIVEL.find((o) => o.codigo === contrato.nivel)?.rotulo ??
      contrato.nivel)
    : VAZIO;
  const genero = perfil?.genero
    ? (OPCOES_GENERO.find((o) => o.codigo === perfil.genero)?.rotulo ??
      perfil.genero)
    : VAZIO;

  async function desligar() {
    if (!vinculo || trabalhando) return;
    setTrabalhando(true);
    try {
      const mov = await registrarMovimentacao({
        vinculoId: vinculo.id,
        tipo: "desligamento",
        motivoCodigo: "encerramento_de_vinculo",
        vigenciaInicio: dataDesligamento,
      });
      if (dataDesligamento <= hoje) await efetivarMovimentacao(mov.id);
      setJanela(null);
      setAviso(
        dataDesligamento <= hoje
          ? "Colaborador desligado."
          : `Desligamento programado para ${formatarDiaCivil(dataDesligamento)}.`,
      );
      void carregar();
    } catch {
      setAviso("Não foi possível desligar agora. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  async function alternarDesativacao(acao: "desativar" | "reativar") {
    if (trabalhando) return;
    setTrabalhando(true);
    try {
      const r =
        acao === "desativar"
          ? await desativarColaborador(colaboradorId)
          : await reativarColaborador(colaboradorId);
      setJanela(null);
      setDados((d) =>
        d && d.contrato
          ? {
              ...d,
              contrato: {
                ...d.contrato,
                desativado: r.desativado,
                desativadoEm: r.desativadoEm,
              },
            }
          : d,
      );
      setAviso(
        r.desativado ? "Colaborador desativado." : "Colaborador reativado.",
      );
    } catch {
      setAviso("Não foi possível concluir agora. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  function escolherStatus(novo: string) {
    if (novo === "inativo" && !desativado) setJanela("desativar");
    else if (novo === "ativo" && desativado) setJanela("reativar");
    else if (novo === "desligado") setJanela("desligar");
    else if (novo === "ferias" || novo === "afastado") setRegistrarAberto(true);
  }

  if (falha === "nao-encontrado") {
    return (
      <div className="ficha-ref__falha">
        <h1 id={FICHA_DO_COLABORADOR_TITULO_ID} tabIndex={-1}>
          Colaborador não encontrado
        </h1>
        <p>Este colaborador não foi encontrado na empresa ativa.</p>
        <Button variant="secondary" onClick={onVoltar}>
          Voltar para Colaboradores
        </Button>
      </div>
    );
  }

  if (falha) {
    return (
      <div className="ficha-ref__falha" role="alert">
        <p>Não foi possível abrir a ficha do colaborador.</p>
        <Button variant="secondary" onClick={() => void carregar()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const statusAtual = ROTULO_DO_STATUS[status];

  return (
    <AreaDeEdicao id={AREAS_DE_EDICAO.ficha}>
      <div className="ficha-ref" ref={raizRef}>
        <section
          className="ficha-ref__perfil"
          aria-labelledby={FICHA_DO_COLABORADOR_TITULO_ID}
        >
          <div className="ficha-ref__faixa" aria-hidden="true" />
          <div className="ficha-ref__topo">
            <span className="ficha-ref__avatar" aria-hidden="true">
              {dados ? (
                <FotoDoColaborador
                  colaboradorId={colaboradorId}
                  foto={dados.colaborador.foto}
                  tamanho={256}
                >
                  {iniciais(nome)}
                </FotoDoColaborador>
              ) : null}
            </span>
            <div className="ficha-ref__identidade">
              <div className="ficha-ref__nome-linha">
                <h1
                  id={FICHA_DO_COLABORADOR_TITULO_ID}
                  tabIndex={-1}
                  className="ficha-ref__nome"
                >
                  {dados ? nome : "Ficha do colaborador"}
                </h1>
                {dados ? (
                  <>
                    <span
                      className={`ficha-ref__status-selo ficha-ref__status-selo--${status}`}
                    >
                      {statusAtual.rotulo}
                    </span>
                    {vinculo ? (
                      <span className="ficha-ref__contrato">
                        {ROTULO_DO_TIPO_DE_VINCULO[vinculo.tipo]}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="ficha-ref__cargo">
                {lotacao.cargo || (lotacao.carregada ? "Sem cargo" : "")}
              </p>
            </div>
            <div className="ficha-ref__acoes">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="ficha-ref__botao-icone"
                  aria-label="Mais ações"
                  disabled={!dados}
                >
                  <IconeMaisAcoes tamanho={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="ficha-ref__menu">
                  <p className="ficha-ref__menu-grupo">Portal do colaborador</p>
                  <DropdownMenuItem
                    className="ficha-ref__menu-item ficha-ref__menu-item--destaque"
                    aria-disabled="true"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="ficha-ref__menu-textos">
                      <span>Enviar convite do portal</span>
                      <span className="ficha-ref__menu-ajuda">
                        {email
                          ? `${trato.pronome} ainda não tem acesso`
                          : "Cadastre um e-mail antes"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <p className="ficha-ref__menu-grupo">Colaborador</p>
                  <DropdownMenuItem
                    className="ficha-ref__menu-item"
                    onSelect={() => setRegistrarAberto(true)}
                  >
                    Registrar ausência
                  </DropdownMenuItem>
                  {podeEditar ? (
                    <>
                      <RadixMenu.Sub>
                        <RadixMenu.SubTrigger className="ficha-ref__menu-item">
                          <span className="ficha-ref__menu-textos">
                            <span>Alterar status</span>
                            <span className="ficha-ref__menu-ajuda">
                              Ativo, férias, afastado…
                            </span>
                          </span>
                        </RadixMenu.SubTrigger>
                        <RadixMenu.Portal>
                          <RadixMenu.SubContent
                            className="ficha-ref__menu ficha-ref__submenu"
                            sideOffset={4}
                          >
                            <RadixMenu.RadioGroup
                              value={status === "em_admissao" ? "" : status}
                              onValueChange={escolherStatus}
                            >
                              {(
                                [
                                  ["ativo", "Ativo"],
                                  ["ferias", "Férias"],
                                  ["afastado", "Afastado"],
                                  ["inativo", "Inativo"],
                                  ["desligado", "Desligado"],
                                ] as const
                              ).map(([valor, rotulo]) => (
                                <RadixMenu.RadioItem
                                  key={valor}
                                  value={valor}
                                  className={`ficha-ref__menu-item ficha-ref__status ficha-ref__status--${valor}`}
                                >
                                  <span
                                    className="ficha-ref__status-ponto"
                                    aria-hidden="true"
                                  />
                                  {rotulo}
                                  <RadixMenu.ItemIndicator className="ficha-ref__visto">
                                    ✓
                                  </RadixMenu.ItemIndicator>
                                </RadixMenu.RadioItem>
                              ))}
                            </RadixMenu.RadioGroup>
                          </RadixMenu.SubContent>
                        </RadixMenu.Portal>
                      </RadixMenu.Sub>
                      <DropdownMenuItem
                        className="ficha-ref__menu-item ficha-ref__menu-item--perigo"
                        disabled={status === "desligado"}
                        onSelect={() => setJanela("desligar")}
                      >
                        Desligar colaborador
                      </DropdownMenuItem>
                      {desativado ? (
                        <DropdownMenuItem
                          className="ficha-ref__menu-item"
                          onSelect={() => setJanela("reativar")}
                        >
                          Reativar colaborador
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="ficha-ref__menu-item ficha-ref__menu-item--perigo"
                          onSelect={() => setJanela("desativar")}
                        >
                          Desativar colaborador
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className="ficha-ref__botao"
                disabled={!dados}
                onClick={() =>
                  raizRef.current && imprimirSomente(raizRef.current)
                }
              >
                <IconeBaixarArquivo tamanho={16} />
                Exportar ficha
              </button>
              {podeEditar && onEditar ? (
                <Button onClick={() => onEditar("dados-basicos")}>
                  <IconeEditar tamanho={16} />
                  Editar colaborador
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="ficha-ref__resumo" aria-label="Resumo do colaborador">
            <li className="ficha-ref__resumo-item">
              <IconeResumoEmail />
              <span className="ficha-ref__resumo-textos">
                <span className="ficha-ref__resumo-rotulo">E-mail</span>
                <span className="ficha-ref__resumo-valor">
                  {email ?? VAZIO}
                </span>
              </span>
            </li>
            <li className="ficha-ref__resumo-item">
              <IconeResumoTelefone />
              <span className="ficha-ref__resumo-textos">
                <span className="ficha-ref__resumo-rotulo">Telefone</span>
                <span className="ficha-ref__resumo-valor">
                  {telefone ? exibirTelefone(telefone) : VAZIO}
                </span>
              </span>
            </li>
            <li className="ficha-ref__resumo-item">
              <IconeResumoTempo />
              <span className="ficha-ref__resumo-textos">
                <span className="ficha-ref__resumo-rotulo">Tempo de casa</span>
                <span className="ficha-ref__resumo-valor">
                  {vinculo && vinculo.situacao !== "previsto"
                    ? tempoDeCasa(vinculo.dataAdmissao, hoje)
                    : VAZIO}
                </span>
              </span>
            </li>
            <li className="ficha-ref__resumo-item">
              <IconeResumoHorario />
              <span className="ficha-ref__resumo-textos">
                <span className="ficha-ref__resumo-rotulo">
                  {escala ? "Carga horária e escala" : "Carga horária"}
                </span>
                <span className="ficha-ref__resumo-valor">{cargaHoraria}</span>
              </span>
            </li>
          </ul>

          <section
            className="ficha-ref__portal"
            aria-labelledby={`${base}-portal`}
          >
            <span className="ficha-ref__portal-icone" aria-hidden="true">
              <IconePortal />
            </span>
            <span className="ficha-ref__portal-textos">
              <span className="ficha-ref__portal-titulo-linha">
                <h2 id={`${base}-portal`} className="ficha-ref__portal-titulo">
                  Portal do colaborador
                </h2>
                {dados ? (
                  email ? (
                    <span className="ficha-ref__selo">
                      <span
                        className="ficha-ref__selo-ponto"
                        aria-hidden="true"
                      />
                      {`Não ${trato.convidado}`}
                    </span>
                  ) : (
                    <span className="ficha-ref__selo ficha-ref__selo--perigo">
                      <span
                        className="ficha-ref__selo-ponto"
                        aria-hidden="true"
                      />
                      Sem e-mail
                    </span>
                  )
                ) : null}
              </span>
              <span className="ficha-ref__portal-texto">
                {email
                  ? `${trato.oNome} ainda não tem acesso. Envie o convite para ${trato.pronomeNaFrase} criar a conta.`
                  : "Cadastre um e-mail para poder enviar o convite do portal."}
              </span>
            </span>
            {email ? (
              <button
                type="button"
                className="ficha-ref__portal-botao"
                aria-disabled="true"
                title="O Portal do colaborador chega em uma próxima versão."
                onClick={(e) => e.preventDefault()}
              >
                Enviar convite
              </button>
            ) : podeEditar && onEditar ? (
              <button
                type="button"
                className="ficha-ref__botao"
                onClick={() => onEditar("dados-basicos")}
              >
                <IconeResumoEmail />
                Adicionar e-mail
              </button>
            ) : null}
          </section>
        </section>

        {aviso ? (
          <AvisoAnimado
            className="ficha-ref__aviso"
            mensagem={aviso}
            tipo={ehAvisoDeFalha(aviso) ? "neutro" : "sucesso"}
          />
        ) : null}

        <div
          className="ficha-ref__abas"
          role="tablist"
          aria-label="Seções da ficha"
        >
          {ABAS_DA_FICHA_DE_REFERENCIA.map((a) => {
            const Icone = ICONE_DA_ABA[a];
            const selecionada = a === aba;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                id={`${base}-aba-${a}`}
                aria-selected={selecionada}
                aria-controls={`${base}-painel`}
                tabIndex={selecionada ? 0 : -1}
                className={
                  selecionada
                    ? "ficha-ref__aba ficha-ref__aba--atual"
                    : "ficha-ref__aba"
                }
                onClick={() => !selecionada && onTrocarAba(a)}
              >
                <Icone />
                {ROTULO_DA_ABA[a]}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${base}-painel`}
          aria-labelledby={`${base}-aba-${aba}`}
          className="ficha-ref__painel"
        >
          {aba === "dados" ? (
            <div className="ficha-ref__grade">
              <Cartao
                titulo="Dados profissionais"
                subtitulo="Área, nível e liderança"
                icone={<IconeCartaoProfissionais />}
                {...(podeEditar && onEditar
                  ? { onEditar: () => onEditar("dados-profissionais") }
                  : {})}
                className="ficha-ref__cartao--inteiro"
              >
                <Campo rotulo="Departamento">
                  {lotacao.departamento || VAZIO}
                </Campo>
                <Campo rotulo="Nível">{nivel}</Campo>
                <Campo rotulo="Gestor direto">{gestor ?? VAZIO}</Campo>
                <Campo rotulo="Unidade">{lotacao.unidade || VAZIO}</Campo>
                <Campo rotulo="Centro de custo">
                  {lotacao.centroCusto || VAZIO}
                </Campo>
              </Cartao>
              <Cartao
                titulo="Dados pessoais"
                subtitulo="Documentos e informações civis"
                icone={<IconeCartaoPessoais />}
                {...(podeEditar && onEditar
                  ? { onEditar: () => onEditar("dados-basicos") }
                  : {})}
                className="ficha-ref__cartao--inteiro"
              >
                <Campo rotulo="Nome completo">{nome || VAZIO}</Campo>
                <Campo rotulo="CPF">
                  {perfil?.cpf ? mascararCpf(perfil.cpf) : VAZIO}
                </Campo>
                <Campo rotulo="RG">{perfil?.rg || VAZIO}</Campo>
                <Campo rotulo="Nascimento">
                  {perfil?.dataNascimento ? (
                    <>
                      {formatarDiaCivil(perfil.dataNascimento)}
                      <span className="ficha-ref__detalhe">
                        {`${idade(perfil.dataNascimento, hoje)} anos`}
                      </span>
                    </>
                  ) : (
                    VAZIO
                  )}
                </Campo>
                <Campo rotulo="Gênero">{genero}</Campo>
                <Campo rotulo="Estado civil">
                  {perfil?.estadoCivil || VAZIO}
                </Campo>
              </Cartao>
              <Cartao
                titulo="Endereço"
                subtitulo="Residência para correspondências"
                icone={<IconeCartaoEndereco />}
                {...(podeEditar && onEditar
                  ? { onEditar: () => onEditar("endereco") }
                  : {})}
                className="ficha-ref__cartao--largo"
              >
                <Campo rotulo="Logradouro">
                  {endereco?.logradouro
                    ? [endereco.logradouro, endereco.numero]
                        .filter(Boolean)
                        .join(", ")
                    : VAZIO}
                </Campo>
                <Campo rotulo="Complemento">
                  {endereco?.complemento || VAZIO}
                </Campo>
                <Campo rotulo="CEP">
                  {endereco?.cep
                    ? exibirCep(
                        endereco.cep,
                        (endereco.pais ?? "Brasil") === "Brasil",
                      )
                    : VAZIO}
                </Campo>
                <Campo rotulo="Cidade/UF">
                  {endereco?.cidade
                    ? [endereco.cidade, endereco.estado]
                        .filter(Boolean)
                        .join(" - ")
                    : VAZIO}
                </Campo>
              </Cartao>
              <Cartao
                titulo="Contato de emergência"
                subtitulo="Acionado em caso de urgência"
                icone={<IconeCartaoEmergencia />}
                {...(podeEditar && onEditar
                  ? { onEditar: () => onEditar("dados-basicos") }
                  : {})}
                className="ficha-ref__cartao--estreito"
              >
                <Campo rotulo="Nome">
                  {perfil?.contatoEmergenciaNome || VAZIO}
                </Campo>
                <Campo rotulo="Telefone">
                  {perfil?.contatoEmergenciaTelefone
                    ? exibirTelefone(perfil.contatoEmergenciaTelefone)
                    : VAZIO}
                </Campo>
              </Cartao>
            </div>
          ) : aba === "ferias" ? (
            // Só com o colaborador confirmado na empresa ativa.
            pessoaDaGaveta ? (
              <AbaFeriasEAusencias
                key={versaoDasAusencias}
                pessoa={pessoaDaGaveta}
                quem={trato.oNomeNaFrase}
                deQuem={trato.doNome}
                podeEditar={podeEditar}
                servico={servicoDeAusencias}
              />
            ) : null
          ) : aba === "salarios" ? (
            // Os salários só são lidos com o colaborador confirmado na
            // empresa ativa (fora dela, a ficha diz "não encontrado").
            dados ? (
              <AbaSalarios
                colaboradorId={colaboradorId}
                deQuem={trato.doNome}
                podeEditar={podeEditar}
              />
            ) : null
          ) : aba === "escala" ? (
            // Só com o colaborador confirmado na empresa ativa.
            dados ? (
              <AbaEscala
                colaboradorId={colaboradorId}
                nome={nome}
                primeiroNome={primeiroNome(nome)}
                podeOperar={podeOperarEscala}
                {...(onAbrirJornadas ? { onAbrirJornadas } : {})}
                hoje={hoje}
              />
            ) : null
          ) : aba === "documentos" ? (
            // Os arquivos só são lidos com o colaborador confirmado na
            // empresa ativa (fora dela, a ficha diz "não encontrado").
            dados ? (
              <ArquivosDoColaborador
                colaboradorId={colaboradorId}
                podeOperar={podeEditar}
              />
            ) : null
          ) : (
            <div className="ficha-ref__em-breve">
              <span className="ficha-ref__em-breve-icone" aria-hidden="true">
                <IconeCalendario tamanho={22} />
              </span>
              <h2 className="ficha-ref__em-breve-titulo">
                {ROTULO_DA_ABA[aba]}
              </h2>
              <p className="ficha-ref__em-breve-texto">
                Esta aba da ficha chega nas próximas versões.
              </p>
            </div>
          )}
        </div>

        <Dialog
          aberto={janela === "desligar"}
          titulo={`Desligar ${nome}?`}
          descricao={`${trato.pronome} sai da lista de ativos e perde o acesso ao portal. O histórico continua guardado na aba Desligados.`}
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={trabalhando || !dataDesligamento}
                onClick={() => void desligar()}
              >
                Desligar colaborador
              </Button>
            </FormActions>
          }
        >
          <label className="ficha-ref__janela-campo">
            <span>Data do desligamento</span>
            <input
              type="date"
              value={dataDesligamento}
              onChange={(e) => setDataDesligamento(e.target.value)}
            />
          </label>
        </Dialog>

        <Dialog
          aberto={janela === "desativar" || janela === "reativar"}
          titulo={
            janela === "reativar" ? `Reativar ${nome}?` : `Desativar ${nome}?`
          }
          descricao={
            janela === "reativar"
              ? `${trato.pronome} volta às listas de ativos, com os dados e o histórico de antes.`
              : `${trato.pronome} sai das listas de ativos. Os dados e o histórico ficam guardados, e dá para reativar depois.`
          }
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={trabalhando}
                onClick={() =>
                  void alternarDesativacao(
                    janela === "reativar" ? "reativar" : "desativar",
                  )
                }
              >
                {janela === "reativar" ? "Reativar" : "Desativar"}
              </Button>
            </FormActions>
          }
        >
          <p className="ficha-ref__janela-texto">
            {janela === "reativar"
              ? "Volta a aparecer em Ativos."
              : "Continua em Todos, marcada como Inativo."}
          </p>
        </Dialog>

        <RegistrarAusenciaGaveta
          aberta={registrarAberto}
          servico={servicoDeAusencias}
          onFechar={() => setRegistrarAberto(false)}
          onRegistrada={(_nova, avisoDoAnexo) => {
            setRegistrarAberto(false);
            setAviso(avisoDoAnexo ?? "Ausência registrada.");
            setVersaoDasAusencias((v) => v + 1);
          }}
          {...(pessoaDaGaveta ? { pessoaInicial: pessoaDaGaveta } : {})}
        />
      </div>
    </AreaDeEdicao>
  );
}
