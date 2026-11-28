/**
 * T215 — Novo benefício e Editar configuração (como a referência,
 * 2026-11-26): 4 etapas — Dados básicos, Valores, Colaboradores e Revisão.
 *
 * O cálculo é sempre do servidor: a cada mudança, a prévia traz o exemplo
 * por pessoa (Valores), o limite do PAT, os exemplos do vale-transporte, as
 * regras da ANS e cada pessoa ativa calculada (Colaboradores). O rascunho
 * fica salvo neste navegador enquanto se preenche (só no cadastro novo).
 */
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BeneficioApi,
  BeneficioDto,
  CategoriaBeneficio,
  FolhaBeneficio,
  PreviaApi,
  RegrasDoBeneficioApi,
  TipoDeValorBeneficio,
} from "../../api/beneficiosClient";
import { ApiError } from "../../api/colaboradoresClient";
import { Button, FormActions, StatusBadge } from "../../components";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../components/cadastro/CadastroEmEtapas";
import {
  diaCivilDeHoje,
  formatarCompetenciaPorExtenso,
  formatarCompetenciaAbreviada,
  formatarDiaCivil,
  formatarMesReferencia,
} from "../../format/data";
import {
  competenciaDoMesAtual,
  competenciaVizinha,
} from "../../app/rotasDoShell";
import { formatarCentavos, formatarPercentual } from "../../format/moeda";
import { Dialog, IconButton, ListaDeEscolha } from "../../ui";
import { IconeMais, IconeRemover } from "../../ui/icones";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../pessoas/edicao/dadosProfissionais";
import {
  CampoNumero,
  CampoReais,
  CartoesDeOpcao,
  PessoaNaLinha,
  Segmentado,
} from "./comuns";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";
import {
  CATEGORIAS,
  FAIXAS_DA_ANS,
  FOLHAS,
  ORDEM_DAS_CATEGORIAS,
  TEXTO_DA_OBSERVACAO,
  TEXTO_DA_PENDENCIA,
  maiuscula,
  nomeDaEscala,
  pessoas as nPessoas,
  tituloDoTipo,
} from "./textosDosBeneficios";

export const ASSISTENTE_TITULO_ID = "beneficio-assistente-titulo";
const CHAVE_DO_RASCUNHO = "evolli-beneficio-rascunho";

const ETAPAS = [
  {
    titulo: "Dados básicos",
    subtitulo: "Nome, categoria e folha",
    descricao: "O que é o benefício, quando começa e como aparece no holerite.",
  },
  {
    titulo: "Valores",
    subtitulo: "Quem paga o quê",
    descricao: "Quanto custa, quanto a empresa paga e quanto é descontado.",
  },
  { titulo: "Colaboradores", subtitulo: "Quem recebe", descricao: "" },
  {
    titulo: "Revisão",
    subtitulo: "Conferir e salvar",
    descricao: "Confira antes de salvar. Se algo der errado, nada é gravado.",
  },
];

export interface EstadoDoAssistente {
  nome: string;
  categoria: CategoriaBeneficio | null;
  folha: FolhaBeneficio;
  inicio: string;
  fim: string;
  observacao: string;
  tipoValor: TipoDeValorBeneficio | null;
  valorMensal: number | null;
  valorDia: number | null;
  diasModo: "uteis" | "escala";
  individualModo: "plano" | "livre";
  planos: { id: string; nome: string; valor: number | null }[];
  faixas: (number | null)[];
  colaboradorPaga: {
    calculo: "percentual" | "valor";
    titular: number | null;
    dependente: number | null;
  };
  coparticipacao: boolean | null;
  quemPaga: {
    modo: "empresa_parte" | "colaborador_tudo" | "empresa_tudo";
    calculo: "percentual" | "valor";
    empresa: number | null;
  };
  vt: { percentualSalario: number | null; empresaCusteiaTudo: boolean };
  temMensalidade: boolean | null;
  mensalidade: number | null;
  mensalidadeQuemPaga: "empresa" | "colaborador";
  modoAntecipacao: "variavel" | "percentual" | null;
  percentualAntecipacao: number | null;
  diaDesconto: number | null;
  marcados: Record<
    string,
    { planoId: string | null; valorIndividual: number | null }
  >;
}

const primeiroDoMes = () => `${diaCivilDeHoje().slice(0, 7)}-01`;

export function estadoInicial(): EstadoDoAssistente {
  return {
    nome: "",
    categoria: null,
    folha: "desconto",
    inicio: primeiroDoMes(),
    fim: "",
    observacao: "",
    tipoValor: null,
    valorMensal: null,
    valorDia: null,
    diasModo: "uteis",
    individualModo: "plano",
    planos: [{ id: "plano-1", nome: "", valor: null }],
    faixas: Array.from({ length: 10 }, () => null),
    colaboradorPaga: { calculo: "percentual", titular: null, dependente: null },
    coparticipacao: null,
    quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: null },
    vt: { percentualSalario: 6, empresaCusteiaTudo: false },
    temMensalidade: null,
    mensalidade: null,
    mensalidadeQuemPaga: "empresa",
    modoAntecipacao: null,
    percentualAntecipacao: null,
    diaDesconto: null,
    marcados: {},
  };
}

/** O benefício gravado → o estado do assistente (Editar configuração). */
export function estadoDe(b: BeneficioApi): EstadoDoAssistente {
  const r = b.regras;
  const base = estadoInicial();
  return {
    ...base,
    nome: b.nome,
    categoria: b.categoria,
    folha: b.folha,
    inicio: b.inicio,
    fim: b.fim ?? "",
    observacao: b.observacao ?? "",
    tipoValor: b.tipoValor,
    valorMensal: r.valorMensal,
    valorDia: r.valorDia,
    diasModo: r.diasModo,
    individualModo: r.individualModo,
    planos: r.planos.length ? r.planos.map((p) => ({ ...p })) : base.planos,
    faixas: r.faixas.length === 10 ? [...r.faixas] : base.faixas,
    colaboradorPaga: { ...r.colaboradorPaga },
    coparticipacao: b.tipoValor === "faixa_etaria" ? r.coparticipacao : null,
    quemPaga: { ...r.quemPaga },
    vt: { ...r.vt },
    temMensalidade: r.antecipacao ? r.antecipacao.mensalidade !== null : null,
    mensalidade: r.antecipacao?.mensalidade ?? null,
    mensalidadeQuemPaga: r.antecipacao?.mensalidadeQuemPaga ?? "empresa",
    modoAntecipacao: r.antecipacao?.modo ?? null,
    percentualAntecipacao: r.antecipacao?.percentual ?? null,
    diaDesconto: r.antecipacao?.diaDesconto ?? null,
  };
}

/** O estado → o corpo enviado ao servidor. */
export function dtoDo(e: EstadoDoAssistente): BeneficioDto {
  const regras: Partial<RegrasDoBeneficioApi> = {
    valorMensal: e.valorMensal,
    valorDia: e.valorDia,
    diasModo: e.diasModo,
    individualModo: e.individualModo,
    planos: e.planos
      .filter((p) => p.nome.trim() || p.valor !== null)
      .map((p) => ({ id: p.id, nome: p.nome.trim(), valor: p.valor ?? 0 })),
    faixas: e.faixas.map((f) => f ?? 0),
    colaboradorPaga: {
      calculo: e.colaboradorPaga.calculo,
      titular: e.colaboradorPaga.titular ?? 0,
      dependente: e.colaboradorPaga.dependente ?? 0,
    },
    coparticipacao: e.coparticipacao === true,
    quemPaga: { ...e.quemPaga, empresa: e.quemPaga.empresa ?? 0 },
    vt: {
      percentualSalario: e.vt.percentualSalario ?? 6,
      empresaCusteiaTudo: e.vt.empresaCusteiaTudo,
    },
    antecipacao:
      e.tipoValor === "antecipacao"
        ? {
            mensalidade: e.temMensalidade ? e.mensalidade : null,
            mensalidadeQuemPaga: e.mensalidadeQuemPaga,
            modo: e.modoAntecipacao ?? "variavel",
            percentual: e.percentualAntecipacao,
            diaDesconto: e.diaDesconto,
          }
        : null,
  };
  return {
    nome: e.nome.trim(),
    categoria: e.categoria ?? "outros",
    folha: e.folha,
    tipoValor: e.tipoValor ?? "fixo",
    inicio: e.inicio,
    fim: e.fim || null,
    observacao: e.observacao.trim() || null,
    regras,
    pessoas: Object.entries(e.marcados).map(([colaboradorId, m]) => ({
      colaboradorId,
      planoId:
        e.tipoValor === "individual" && e.individualModo === "plano"
          ? m.planoId
          : null,
      valorIndividual:
        e.tipoValor === "individual" && e.individualModo === "livre"
          ? m.valorIndividual
          : null,
    })),
  };
}

type Erros = Partial<Record<string, string>>;

/** O que falta na etapa (campo → mensagem). */
export function errosDaEtapa(
  etapa: number,
  e: EstadoDoAssistente,
  previa: PreviaApi | null,
): Erros {
  const erros: Erros = {};
  if (etapa === 0) {
    if (!e.nome.trim())
      erros.nome = "Dê um nome ao benefício (o do fornecedor, por exemplo).";
    if (!e.categoria) erros.categoria = "Escolha a categoria.";
    if (!e.inicio) erros.inicio = "Informe a data de início.";
    if (e.categoria && CATEGORIAS[e.categoria].terminoObrigatorio && !e.fim) {
      erros.fim =
        "Informe o término do contrato: obrigatório para planos de saúde e seguros.";
    } else if (e.fim && e.inicio && e.fim < e.inicio) {
      erros.fim = "O término vem depois do início.";
    }
  }
  if (etapa === 1) {
    if (!e.tipoValor) erros.tipoValor = "Escolha como o valor é definido.";
    if (e.tipoValor === "fixo" && !e.valorMensal)
      erros.valorMensal = "Informe o valor do benefício.";
    if (e.tipoValor === "dia_util" && !e.valorDia)
      erros.valorDia = "Informe o valor por dia.";
    if (e.tipoValor === "individual" && e.individualModo === "plano") {
      const validos = e.planos.filter((p) => p.nome.trim() && p.valor !== null);
      if (validos.length === 0)
        erros.planos = "Cadastre ao menos um plano com nome e valor.";
    }
    if (e.tipoValor === "faixa_etaria") {
      if (e.faixas.some((f) => !f))
        erros.faixas = "Preencha a mensalidade das 10 faixas.";
      else if (
        previa?.ans &&
        (!previa.ans.seisVezesOk || !previa.ans.variacaoOk)
      ) {
        erros.faixas = "Ajuste a tabela às regras da ANS.";
      }
      if (e.coparticipacao === null)
        erros.coparticipacao = "Diga se tem coparticipação.";
    }
    if (e.tipoValor === "antecipacao") {
      if (e.temMensalidade === null)
        erros.mensalidade = "Diga se o produto tem mensalidade.";
      else if (e.temMensalidade && !e.mensalidade)
        erros.mensalidade = "Informe a mensalidade por pessoa.";
      if (!e.modoAntecipacao)
        erros.antecipacao = "Escolha como funciona a antecipação.";
      else if (
        e.modoAntecipacao === "percentual" &&
        (!e.percentualAntecipacao || !e.diaDesconto)
      ) {
        erros.antecipacao = "Informe o percentual e o dia do desconto.";
      }
    }
    if (
      e.quemPaga.modo === "empresa_parte" &&
      e.quemPaga.calculo === "percentual" &&
      (e.quemPaga.empresa ?? 0) > 100
    ) {
      erros.quemPaga = "A empresa paga até 100%.";
    }
  }
  return erros;
}

const faltam = (n: number) =>
  n === 1
    ? "Falta 1 informação para continuar"
    : `Faltam ${n} informações para continuar`;

function lerRascunho(): EstadoDoAssistente | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DO_RASCUNHO);
    return bruto
      ? { ...estadoInicial(), ...(JSON.parse(bruto) as EstadoDoAssistente) }
      : null;
  } catch {
    return null;
  }
}
function gravarRascunho(e: EstadoDoAssistente | null) {
  try {
    if (e) window.localStorage.setItem(CHAVE_DO_RASCUNHO, JSON.stringify(e));
    else window.localStorage.removeItem(CHAVE_DO_RASCUNHO);
  } catch {
    /* sem armazenamento: o rascunho só não fica guardado */
  }
}

export function AssistenteDeBeneficio({
  servico,
  base,
  competenciaDaEdicao,
  onSair,
  onSalvo,
  onVerPessoas,
}: {
  readonly servico: ServicoDeBeneficios;
  /** Editar configuração: o benefício gravado. */
  readonly base?: BeneficioApi;
  /** Editar: a competência aberta no detalhe (padrão de "Vale a partir de"). */
  readonly competenciaDaEdicao?: string;
  readonly onSair: () => void;
  readonly onSalvo: (id: string, aviso: string) => void;
  readonly onVerPessoas?: () => void;
}) {
  const editando = base !== undefined;
  const id = useId();
  const [estado, setEstado] = useState<EstadoDoAssistente>(() =>
    base ? estadoDe(base) : (lerRascunho() ?? estadoInicial()),
  );
  const [atual, setAtual] = useState(0);
  const [alcancada, setAlcancada] = useState(editando ? ETAPAS.length - 1 : 0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [previa, setPrevia] = useState<PreviaApi | null>(null);
  const [desligados, setDesligados] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [sair, setSair] = useState(false);
  const [busca, setBusca] = useState("");
  const [pilula, setPilula] = useState<
    "todos" | "marcados" | "pendencia" | "nao"
  >("todos");
  const [avisoRascunho, setAvisoRascunho] = useState<string | null>(null);
  const pedido = useRef(0);
  // "Vale a partir de" (edição): este mês ou os dois seguintes.
  const mesesDaMudanca = [0, 1, 2].map((d) =>
    competenciaVizinha(competenciaDoMesAtual(), d),
  );
  const [valeAPartirDe, setValeAPartirDe] = useState(
    competenciaDaEdicao && mesesDaMudanca.includes(competenciaDaEdicao)
      ? competenciaDaEdicao
      : mesesDaMudanca[0]!,
  );

  const [avisoDoMes, setAvisoDoMes] = useState<string | null>(null);

  /** Outro mês: as regras daquele mês entram no formulário (dados básicos ficam). */
  async function mudarValeAPartirDe(c: string) {
    setValeAPartirDe(c);
    if (!base) return;
    try {
      const d = await servico.obterBeneficio(base.id, c);
      const daquele = estadoDe(d.beneficio);
      setEstado((e) => ({
        ...daquele,
        nome: e.nome,
        categoria: e.categoria,
        folha: e.folha,
        inicio: e.inicio,
        fim: e.fim,
        observacao: e.observacao,
        marcados: e.marcados,
      }));
      setAvisoDoMes(
        `Valores de ${formatarMesReferencia(c)} carregados. As mudanças valem desse mês em diante.`,
      );
    } catch {
      setAvisoDoMes(
        "Não foi possível carregar os valores desse mês. Tente de novo.",
      );
    }
  }

  const mudar = (parcial: Partial<EstadoDoAssistente>) =>
    setEstado((e) => ({ ...e, ...parcial }));

  // Rascunho no navegador (só no cadastro novo).
  useEffect(() => {
    if (!editando && (estado.nome || estado.categoria)) gravarRascunho(estado);
  }, [estado, editando]);

  // A prévia do servidor (com espera curta entre as teclas).
  const dto = useMemo(() => dtoDo(estado), [estado]);
  useEffect(() => {
    if (!estado.categoria) return;
    const meu = ++pedido.current;
    const t = setTimeout(() => {
      servico
        .previaDoBeneficio({
          ...dto,
          competencia: (estado.inicio || primeiroDoMes()).slice(0, 7),
          incluirDesligados: desligados,
        })
        .then((p) => {
          if (meu === pedido.current) setPrevia(p);
        })
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [dto, desligados, estado.categoria, estado.inicio, servico]);

  const erros = errosDaEtapa(atual, estado, previa);
  const qtdErros = Object.keys(erros).length;
  const erroDe = (campo: string) =>
    mostrarErros && erros[campo] ? (
      <p className="beneficios__erro" id={`${id}-${campo}-erro`}>
        {erros[campo]}
      </p>
    ) : null;

  const info = estado.categoria ? CATEGORIAS[estado.categoria] : null;
  const competencia = (estado.inicio || primeiroDoMes()).slice(0, 7);
  const marcadosIds = Object.keys(estado.marcados);
  const pessoasMarcadas = (previa?.pessoas ?? []).filter(
    (p) => estado.marcados[p.colaboradorId],
  );
  const totais = pessoasMarcadas.reduce(
    (t, p) => ({
      empresa: t.empresa + p.empresa,
      desconto: t.desconto + p.desconto,
      pendentes: t.pendentes + (p.pendencia ? 1 : 0),
    }),
    { empresa: 0, desconto: 0, pendentes: 0 },
  );

  function escolherCategoria(c: CategoriaBeneficio) {
    const i = CATEGORIAS[c];
    mudar({
      categoria: c,
      folha: i.folhaPadrao,
      // Como a referência: o primeiro tipo da categoria já vem marcado.
      tipoValor:
        estado.tipoValor &&
        i.tipos.includes(estado.tipoValor) &&
        c !== "mobilidade"
          ? estado.tipoValor
          : i.tipos[0]!,
      quemPaga:
        i.folhaPadrao === "fora_da_folha"
          ? { modo: "empresa_tudo", calculo: "percentual", empresa: 100 }
          : estado.quemPaga.modo === "empresa_tudo"
            ? { modo: "empresa_parte", calculo: "percentual", empresa: null }
            : estado.quemPaga,
    });
  }

  async function salvar() {
    setSalvando(true);
    setFalha(null);
    try {
      if (base) {
        const semPessoas: BeneficioDto = { ...dto };
        delete semPessoas.pessoas;
        await servico.alterarBeneficio(base.id, {
          ...semPessoas,
          aPartirDe: valeAPartirDe,
        });
        onSalvo(
          base.id,
          `Configuração salva. Mudanças nos valores valem a partir de ${formatarMesReferencia(valeAPartirDe)}.`,
        );
      } else {
        const criado = await servico.criarBeneficio(dto);
        gravarRascunho(null);
        const n = marcadosIds.length;
        onSalvo(
          criado.id,
          `${criado.nome} cadastrado. ${n === 1 ? "1 pessoa recebe" : `${n} pessoas recebem`} a partir de ${formatarMesReferencia(competencia)}.`,
        );
      }
    } catch (e) {
      const campos =
        e instanceof ApiError && e.status === 422 ? (e.erros ?? []) : [];
      setFalha(
        campos.length
          ? `Confira: ${campos.map((c) => c.campo.replace("regras.", "")).join(", ")}.`
          : "Não foi possível salvar o benefício. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function aoEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (qtdErros > 0) {
      setMostrarErros(true);
      return;
    }
    setMostrarErros(false);
    if (atual === ETAPAS.length - 1) {
      void salvar();
      return;
    }
    const proxima = editando && atual === 1 ? 3 : atual + 1;
    setAtual(proxima);
    setAlcancada((a) => Math.max(a, proxima));
  }

  // ---------------------------------------------------------- etapa 1
  const etapa1 = (
    <div key="1" className="beneficios__etapa">
      {mostrarErros && qtdErros > 0 ? <FaixaDeErros n={qtdErros} /> : null}
      <SecaoDoCadastro
        titulo="Identificação"
        descricao="Aparece na lista, no Portal do colaborador e na folha."
      >
        <LinhaDoCadastro
          rotulo="Benefício *"
          ajuda="O nome do benefício ou do fornecedor."
          paraId={`${id}-nome`}
        >
          <input
            id={`${id}-nome`}
            className="beneficios__texto"
            maxLength={120}
            placeholder="Ex.: Vale-refeição do fornecedor X"
            value={estado.nome}
            aria-invalid={(mostrarErros && !!erros.nome) || undefined}
            onChange={(e) => mudar({ nome: e.target.value })}
          />
          {erroDe("nome")}
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Categoria *"
          ajuda="Define as regras da lei que valem para o benefício."
          grupo={false}
        >
          <ListaDeEscolha
            id={`${id}-categoria`}
            aria-label="Categoria"
            vazio="Escolha a categoria"
            valor={estado.categoria ?? ""}
            onMudar={(v) => escolherCategoria(v as CategoriaBeneficio)}
            opcoes={ORDEM_DAS_CATEGORIAS.map((c) => ({
              valor: c,
              rotulo: CATEGORIAS[c].rotulo,
              ...(CATEGORIAS[c].sub ? { descricao: CATEGORIAS[c].sub! } : {}),
            }))}
          />
          {info ? <p className="beneficios__suave">{info.ajuda}</p> : null}
          {erroDe("categoria")}
        </LinhaDoCadastro>
      </SecaoDoCadastro>
      <SecaoDoCadastro
        titulo="Contrato"
        descricao="Vigência controla quando o benefício entra nas folhas."
      >
        <LinhaDoCadastro
          rotulo="Vigência *"
          ajuda={
            info?.terminoObrigatorio
              ? "Término obrigatório para planos de saúde e seguros."
              : "Data de início. O término é opcional."
          }
        >
          <div className="beneficios__lado-a-lado">
            <label className="beneficios__campo-rotulado">
              <span>Início</span>
              <input
                type="date"
                value={estado.inicio}
                onChange={(e) => mudar({ inicio: e.target.value })}
              />
            </label>
            <label className="beneficios__campo-rotulado">
              <span>
                {info?.terminoObrigatorio ? "Término" : "Término (opcional)"}
              </span>
              <input
                type="date"
                value={estado.fim}
                min={estado.inicio || undefined}
                onChange={(e) => mudar({ fim: e.target.value })}
              />
            </label>
          </div>
          {erroDe("inicio")}
          {erroDe("fim")}
        </LinhaDoCadastro>
      </SecaoDoCadastro>
      <SecaoDoCadastro
        titulo="Folha de pagamento"
        descricao="Define se o valor vira desconto, adicional ou só controle de custo."
      >
        <LinhaDoCadastro
          rotulo="Como entra na folha *"
          ajuda="Uma escolha só: como o valor aparece no holerite de cada pessoa."
          grupo={false}
        >
          <CartoesDeOpcao
            rotulo="Como entra na folha"
            valor={estado.folha}
            onMudar={(folha) =>
              mudar({
                folha,
                quemPaga:
                  folha === "fora_da_folha"
                    ? {
                        modo: "empresa_tudo",
                        calculo: "percentual",
                        empresa: 100,
                      }
                    : folha === "desconto" &&
                        estado.quemPaga.modo === "empresa_tudo"
                      ? {
                          modo: "empresa_parte",
                          calculo: "percentual",
                          empresa: null,
                        }
                      : estado.quemPaga,
              })
            }
            opcoes={(Object.keys(FOLHAS) as FolhaBeneficio[]).map((f) => ({
              valor: f,
              titulo: FOLHAS[f].titulo,
              ajuda: FOLHAS[f].ajuda,
            }))}
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Observação"
          ajuda="Opcional. Só o RH vê."
          paraId={`${id}-obs`}
        >
          <textarea
            id={`${id}-obs`}
            className="beneficios__texto"
            rows={3}
            maxLength={500}
            placeholder="Ex.: cartão entregue na admissão; recarga todo dia 1º."
            value={estado.observacao}
            onChange={(e) => mudar({ observacao: e.target.value })}
          />
        </LinhaDoCadastro>
      </SecaoDoCadastro>
    </div>
  );

  // ---------------------------------------------------------- etapa 2
  const ehVt = estado.categoria === "mobilidade";
  const quemPagaPorDia = estado.tipoValor === "dia_util";
  const unidadeEmpresa = quemPagaPorDia ? "por dia" : "por mês";
  const blocoQuemPaga =
    estado.tipoValor === "faixa_etaria" ||
    estado.tipoValor === "antecipacao" ||
    ehVt ? null : (
      <LinhaDoCadastro
        rotulo={
          estado.folha === "adicional"
            ? "Quem paga o benefício?"
            : "Quem paga o benefício? *"
        }
        ajuda={
          estado.folha === "adicional"
            ? "Definido pela etapa 1: adicional no salário."
            : estado.folha === "fora_da_folha"
              ? "Nada vai para o holerite: a parte do colaborador é só registrada."
              : estado.tipoValor === "individual"
                ? "Vale para o valor de cada pessoa."
                : "A parte do colaborador vira desconto no holerite."
        }
        grupo={false}
      >
        {estado.folha === "adicional" ? (
          <div className="beneficios__caixa-fixa">
            <span className="beneficios__opcao-titulo">
              A empresa paga tudo, junto com o salário
            </span>
            <span className="beneficios__suave">
              O valor inteiro entra como adicional no holerite. Nada é
              descontado do colaborador.
            </span>
          </div>
        ) : (
          <CartoesDeOpcao
            rotulo="Quem paga o benefício"
            valor={estado.quemPaga.modo}
            onMudar={(modo) =>
              mudar({ quemPaga: { ...estado.quemPaga, modo } })
            }
            opcoes={[
              ...(estado.folha === "fora_da_folha"
                ? [
                    {
                      valor: "empresa_tudo" as const,
                      titulo: "A empresa paga tudo",
                      ajuda: "Nada é cobrado do colaborador.",
                    },
                  ]
                : []),
              {
                valor: "empresa_parte" as const,
                titulo: "A empresa paga uma parte",
                ajuda:
                  estado.folha === "fora_da_folha"
                    ? "A parte do colaborador é só registrada para controle, não vai ao holerite."
                    : "O restante é descontado no holerite do colaborador.",
                conteudo: (
                  <div className="beneficios__parte">
                    <div className="beneficios__parte-linha">
                      <span>Calcular em</span>
                      <Segmentado
                        rotulo="Calcular em"
                        valor={estado.quemPaga.calculo}
                        onMudar={(calculo) =>
                          mudar({
                            quemPaga: {
                              ...estado.quemPaga,
                              calculo,
                              empresa: null,
                            },
                          })
                        }
                        opcoes={[
                          { valor: "percentual", rotulo: "% do valor" },
                          {
                            valor: "valor",
                            rotulo: quemPagaPorDia
                              ? "R$ por dia"
                              : "R$ por mês",
                          },
                        ]}
                      />
                    </div>
                    <div className="beneficios__parte-linha">
                      <span>Empresa paga</span>
                      {estado.quemPaga.calculo === "percentual" ? (
                        <CampoNumero
                          rotulo="Empresa paga (% do valor)"
                          decimal
                          max={100}
                          sufixo="% do valor"
                          valor={estado.quemPaga.empresa}
                          onMudar={(empresa) =>
                            mudar({ quemPaga: { ...estado.quemPaga, empresa } })
                          }
                        />
                      ) : (
                        <CampoReais
                          rotulo={`Empresa paga (R$ ${unidadeEmpresa})`}
                          sufixo={unidadeEmpresa}
                          valor={estado.quemPaga.empresa}
                          onMudar={(empresa) =>
                            mudar({ quemPaga: { ...estado.quemPaga, empresa } })
                          }
                        />
                      )}
                    </div>
                    {previa && estado.tipoValor !== "individual" ? (
                      <p className="beneficios__suave">
                        {`Empresa paga ${formatarCentavos(previa.exemplo.empresa)} · colaborador paga ${formatarCentavos(previa.exemplo.valor - previa.exemplo.empresa)} (${previa.exemplo.valor ? formatarPercentual(((previa.exemplo.valor - previa.exemplo.empresa) / previa.exemplo.valor) * 100) : 0}%)${quemPagaPorDia ? " no mês" : ""}`}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              ...(estado.folha === "desconto"
                ? [
                    {
                      valor: "colaborador_tudo" as const,
                      titulo: "O colaborador paga tudo",
                      ajuda: "O valor inteiro é descontado no holerite.",
                    },
                  ]
                : []),
            ]}
          />
        )}
        {erroDe("quemPaga")}
      </LinhaDoCadastro>
    );

  const tipos = info?.tipos ?? [];
  const etapa2 = (
    <div key="2" className="beneficios__etapa">
      {mostrarErros && qtdErros > 0 ? <FaixaDeErros n={qtdErros} /> : null}
      {editando ? (
        <SecaoDoCadastro
          titulo="Quando a mudança começa"
          descricao="Os meses antes dela ficam com os valores de antes."
        >
          <LinhaDoCadastro
            rotulo="Vale a partir de *"
            ajuda="Competência em que a mudança começa."
            grupo={false}
          >
            <ListaDeEscolha
              aria-label="Vale a partir de"
              valor={valeAPartirDe}
              onMudar={(c) => void mudarValeAPartirDe(c)}
              opcoes={mesesDaMudanca.map((c) => ({
                valor: c,
                rotulo: `${formatarMesReferencia(c)} · valores previstos`,
              }))}
            />
            {avisoDoMes ? (
              <p className="beneficios__suave" role="status">
                {avisoDoMes}
              </p>
            ) : null}
          </LinhaDoCadastro>
        </SecaoDoCadastro>
      ) : null}
      {estado.tipoValor !== "antecipacao" &&
      estado.categoria !== "antecipacao" ? (
        <SecaoDoCadastro titulo="Como o valor é definido" descricao="">
          <LinhaDoCadastro
            rotulo="Tipo de valor *"
            ajuda={
              ehVt
                ? "Vale-transporte é calculado por dia trabalhado."
                : "Escolha como o custo de cada pessoa é calculado."
            }
            grupo={false}
          >
            <CartoesDeOpcao
              rotulo="Tipo de valor"
              valor={estado.tipoValor}
              onMudar={(tipoValor) => mudar({ tipoValor })}
              opcoes={tipos.map((t) => ({
                valor: t,
                ...tituloDoTipo(estado.categoria!, t),
              }))}
            />
            {erroDe("tipoValor")}
          </LinhaDoCadastro>
        </SecaoDoCadastro>
      ) : null}

      {estado.tipoValor === "fixo" ? (
        <SecaoDoCadastro titulo="Valores por pessoa" descricao="">
          <LinhaDoCadastro
            rotulo="Valor do benefício *"
            ajuda="Quanto o benefício vale por pessoa no mês (o que o fornecedor cobra)."
            grupo={false}
          >
            <CampoReais
              rotulo="Valor do benefício"
              sufixo="/mês"
              valor={estado.valorMensal}
              onMudar={(valorMensal) => mudar({ valorMensal })}
            />
            {erroDe("valorMensal")}
          </LinhaDoCadastro>
          {blocoQuemPaga}
        </SecaoDoCadastro>
      ) : null}

      {estado.tipoValor === "dia_util" ? (
        <SecaoDoCadastro
          titulo={ehVt ? "Passagens" : "Valores por dia"}
          descricao=""
        >
          <LinhaDoCadastro
            rotulo="Valor por dia *"
            ajuda={
              ehVt
                ? "Ida e volta. Dá para ajustar pessoa a pessoa depois."
                : "Quanto a pessoa recebe por dia trabalhado."
            }
            grupo={false}
          >
            <CampoReais
              rotulo="Valor por dia"
              sufixo={ehVt ? "/dia (ida + volta)" : "/dia"}
              valor={estado.valorDia}
              onMudar={(valorDia) => mudar({ valorDia })}
            />
            {erroDe("valorDia")}
          </LinhaDoCadastro>
          <LinhaDoCadastro
            rotulo="Dias no mês *"
            ajuda="Quantos dias cada pessoa recebe no mês."
            grupo={false}
          >
            <CartoesDeOpcao
              rotulo="Dias no mês"
              valor={estado.diasModo}
              onMudar={(diasModo) => mudar({ diasModo })}
              opcoes={[
                {
                  valor: "uteis" as const,
                  titulo: ehVt
                    ? "Dias úteis do mês para todos"
                    : "Dias úteis do mês",
                  ajuda: `Segunda a sexta, sem feriados nacionais, do estado e municipais da empresa. ${previa ? `${previa.diasUteis} dias em ${formatarMesReferencia(competencia)}.` : ""}`,
                },
                {
                  valor: "escala" as const,
                  titulo: "Pela escala de cada pessoa",
                  ajuda:
                    "Com escala publicada, conta os dias escalados de cada pessoa. Sem ela, usa a escala do cadastro (12x36 = 15 dias, 6x1 = 26). Dá para ajustar pessoa a pessoa.",
                },
              ]}
            />
          </LinhaDoCadastro>
          {blocoQuemPaga}
        </SecaoDoCadastro>
      ) : null}

      {estado.tipoValor === "individual" ? (
        <SecaoDoCadastro titulo="Valores por pessoa" descricao="">
          <LinhaDoCadastro
            rotulo="Como é o valor de cada pessoa? *"
            ajuda={
              estado.individualModo === "plano"
                ? "Na próxima etapa você escolhe quem recebe e o plano de cada um."
                : "Na próxima etapa você escolhe quem recebe e digita o valor de cada um."
            }
            grupo={false}
          >
            <CartoesDeOpcao
              rotulo="Como é o valor de cada pessoa"
              valor={estado.individualModo}
              onMudar={(individualModo) => mudar({ individualModo })}
              opcoes={[
                {
                  valor: "plano" as const,
                  titulo: "Por plano",
                  ajuda:
                    "Cada pessoa fica em um plano do fornecedor. Você cadastra os planos uma vez.",
                  conteudo: (
                    <div className="beneficios__planos">
                      {estado.planos.map((p, i) => (
                        <div key={p.id} className="beneficios__plano">
                          <input
                            className="beneficios__texto"
                            aria-label={`Nome do plano ${i + 1}`}
                            placeholder="Ex.: Básico"
                            maxLength={60}
                            value={p.nome}
                            onChange={(e) =>
                              mudar({
                                planos: estado.planos.map((x, j) =>
                                  j === i ? { ...x, nome: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <CampoReais
                            rotulo={`Valor por mês do plano ${i + 1}`}
                            valor={p.valor}
                            onMudar={(valor) =>
                              mudar({
                                planos: estado.planos.map((x, j) =>
                                  j === i ? { ...x, valor } : x,
                                ),
                              })
                            }
                          />
                          <IconButton
                            label={`Tirar o plano ${i + 1}`}
                            icon={<IconeRemover tamanho={16} />}
                            variant="subtle"
                            disabled={estado.planos.length === 1}
                            onClick={() =>
                              mudar({
                                planos: estado.planos.filter((_, j) => j !== i),
                              })
                            }
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          mudar({
                            planos: [
                              ...estado.planos,
                              {
                                id: `plano-${Date.now().toString(36)}`,
                                nome: "",
                                valor: null,
                              },
                            ],
                          })
                        }
                      >
                        <IconeMais tamanho={16} />
                        Adicionar plano
                      </Button>
                      {erroDe("planos")}
                    </div>
                  ),
                },
                {
                  valor: "livre" as const,
                  titulo: "Valor livre",
                  ajuda:
                    "Você digita o valor de cada pessoa. Bom para reembolsos e auxílios.",
                },
              ]}
            />
          </LinhaDoCadastro>
          {blocoQuemPaga}
        </SecaoDoCadastro>
      ) : null}

      {estado.tipoValor === "faixa_etaria" ? (
        <TabelaDaOperadora
          estado={estado}
          mudar={mudar}
          previa={previa}
          erroDe={erroDe}
        />
      ) : null}

      {estado.categoria === "antecipacao" ? (
        <>
          <SecaoDoCadastro titulo="Mensalidade do produto" descricao="">
            <LinhaDoCadastro
              rotulo="O produto tem mensalidade? *"
              ajuda="Valor que o fornecedor cobra por pessoa (por vida), todo mês."
              grupo={false}
            >
              <CartoesDeOpcao
                rotulo="O produto tem mensalidade"
                valor={
                  estado.temMensalidade === null
                    ? null
                    : estado.temMensalidade
                      ? "sim"
                      : "nao"
                }
                onMudar={(v) =>
                  mudar({
                    temMensalidade: v === "sim",
                    tipoValor: "antecipacao",
                  })
                }
                opcoes={[
                  {
                    valor: "nao" as const,
                    titulo: "Sem mensalidade",
                    ajuda: "O produto não tem custo por pessoa.",
                  },
                  {
                    valor: "sim" as const,
                    titulo: "Tem mensalidade",
                    ajuda:
                      "Cobrada de todas as pessoas no benefício, mesmo sem antecipar no mês.",
                    conteudo: (
                      <div className="beneficios__parte">
                        <div className="beneficios__parte-linha">
                          <span>Valor por pessoa</span>
                          <CampoReais
                            rotulo="Mensalidade por pessoa"
                            sufixo="por mês"
                            valor={estado.mensalidade}
                            onMudar={(mensalidade) => mudar({ mensalidade })}
                          />
                        </div>
                        <div className="beneficios__parte-linha">
                          <span>Quem paga</span>
                          <Segmentado
                            rotulo="Quem paga a mensalidade"
                            valor={estado.mensalidadeQuemPaga}
                            onMudar={(mensalidadeQuemPaga) =>
                              mudar({ mensalidadeQuemPaga })
                            }
                            opcoes={[
                              { valor: "empresa", rotulo: "Empresa" },
                              {
                                valor: "colaborador",
                                rotulo: "Desconta do colaborador",
                              },
                            ]}
                          />
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
              {erroDe("mensalidade")}
            </LinhaDoCadastro>
          </SecaoDoCadastro>
          <SecaoDoCadastro titulo="Como funciona a antecipação" descricao="">
            <LinhaDoCadastro
              rotulo="Valor antecipado *"
              ajuda="Sempre descontado no holerite do colaborador."
              grupo={false}
            >
              <CartoesDeOpcao
                rotulo="Valor antecipado"
                valor={estado.modoAntecipacao}
                onMudar={(modoAntecipacao) =>
                  mudar({ modoAntecipacao, tipoValor: "antecipacao" })
                }
                opcoes={[
                  {
                    valor: "variavel" as const,
                    titulo: "Valor que muda todo mês",
                    ajuda:
                      "A pessoa pede quanto quiser (ex.: R$ 500 em outubro, R$ 300 em novembro). O RH informa o valor de cada mês no benefício.",
                  },
                  {
                    valor: "percentual" as const,
                    titulo: "% do salário por mês",
                    ajuda:
                      "Um percentual fixo do salário, descontado num dia definido. Dá para corrigir o valor no mês.",
                    conteudo: (
                      <div className="beneficios__parte">
                        <div className="beneficios__parte-linha">
                          <span>Percentual</span>
                          <CampoNumero
                            rotulo="Percentual do salário"
                            decimal
                            max={100}
                            sufixo="% do salário"
                            valor={estado.percentualAntecipacao}
                            onMudar={(percentualAntecipacao) =>
                              mudar({ percentualAntecipacao })
                            }
                          />
                        </div>
                        <div className="beneficios__parte-linha">
                          <span>Dia do desconto</span>
                          <CampoNumero
                            rotulo="Dia do desconto"
                            max={31}
                            sufixo="de cada mês"
                            valor={estado.diaDesconto}
                            onMudar={(diaDesconto) => mudar({ diaDesconto })}
                          />
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
              {erroDe("antecipacao")}
            </LinhaDoCadastro>
          </SecaoDoCadastro>
        </>
      ) : null}

      {ehVt && estado.tipoValor ? (
        <SecaoDoCadastro titulo="Desconto do colaborador" descricao="">
          <LinhaDoCadastro
            rotulo="Percentual do salário *"
            ajuda="Quanto do salário base é descontado, nunca mais que o VT do mês. A lei permite até 6%; use menos se a convenção coletiva ou a política da empresa mandar."
            grupo={false}
          >
            <CampoNumero
              rotulo="Percentual do salário"
              decimal
              max={6}
              sufixo="% do salário base"
              valor={estado.vt.percentualSalario}
              onMudar={(percentualSalario) =>
                mudar({ vt: { ...estado.vt, percentualSalario } })
              }
            />
            <label className="beneficios__caixa-marcar">
              <input
                type="checkbox"
                checked={estado.vt.empresaCusteiaTudo}
                onChange={(e) =>
                  mudar({
                    vt: { ...estado.vt, empresaCusteiaTudo: e.target.checked },
                  })
                }
              />
              A empresa custeia 100% (não descontar do colaborador)
            </label>
          </LinhaDoCadastro>
          {previa && previa.exemplosVt.length ? (
            <ExemplosDoVt previa={previa} competencia={competencia} />
          ) : null}
        </SecaoDoCadastro>
      ) : null}

      {previa &&
      (estado.tipoValor === "fixo" || estado.tipoValor === "dia_util") &&
      !ehVt ? (
        <ResumoPorPessoa
          previa={previa}
          estado={estado}
          competencia={competencia}
          onAjustarPat={() =>
            mudar({
              quemPaga: {
                modo: "empresa_parte",
                calculo: "percentual",
                empresa: 80,
              },
            })
          }
        />
      ) : null}
    </div>
  );

  // ---------------------------------------------------------- etapa 3
  const contratos = [
    ...new Set((previa?.pessoas ?? []).map((p) => p.contrato)),
  ];
  const [contratosFiltro, setContratosFiltro] = useState<string[]>([]);
  const visiveis = (previa?.pessoas ?? []).filter((p) => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()))
      return false;
    if (contratosFiltro.length && !contratosFiltro.includes(p.contrato))
      return false;
    const marcado = !!estado.marcados[p.colaboradorId];
    if (pilula === "marcados") return marcado;
    if (pilula === "nao") return !marcado;
    if (pilula === "pendencia") return marcado && !!p.pendencia;
    return true;
  });
  const marcar = (idPessoa: string, sim: boolean) =>
    setEstado((e) => {
      const marcados = { ...e.marcados };
      if (sim)
        marcados[idPessoa] = marcados[idPessoa] ?? {
          planoId: e.planos[0]?.id ?? null,
          valorIndividual: null,
        };
      else delete marcados[idPessoa];
      return { ...e, marcados };
    });
  const todosVisiveisMarcados =
    visiveis.length > 0 &&
    visiveis.every((p) => estado.marcados[p.colaboradorId]);
  const algunsMarcados = visiveis.some((p) => estado.marcados[p.colaboradorId]);

  const etapa3 = editando ? (
    <div key="3" className="beneficios__etapa">
      <p className="beneficios__nota">
        Para mudar quem recebe, use "Adicionar pessoas" e o ⋯ de cada pessoa na
        tela do benefício.
      </p>
      {onVerPessoas ? (
        <Button type="button" variant="secondary" onClick={onVerPessoas}>
          Ver pessoas do benefício
        </Button>
      ) : null}
    </div>
  ) : (
    <div key="3" className="beneficios__etapa">
      <div className="beneficios__filtros">
        <input
          type="search"
          className="beneficios__busca"
          aria-label="Buscar colaborador"
          placeholder="Buscar colaborador"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div role="group" aria-label="Contrato" className="beneficios__chips">
          {contratos.map((c) => (
            <label key={c} className="beneficios__chip">
              <input
                type="checkbox"
                checked={contratosFiltro.includes(c)}
                onChange={(e) =>
                  setContratosFiltro((f) =>
                    e.target.checked ? [...f, c] : f.filter((x) => x !== c),
                  )
                }
              />
              {(ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[c] ?? c}
            </label>
          ))}
        </div>
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
            ["todos", "Todos", previa?.pessoas.length ?? 0],
            ["marcados", "Marcados", marcadosIds.length],
            ["pendencia", "Com pendência", totais.pendentes],
            [
              "nao",
              "Não marcados",
              (previa?.pessoas.length ?? 0) - pessoasMarcadas.length,
            ],
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
      {marcadosIds.length > 0 ? (
        <div className="beneficios__barra-marcados" role="status">
          <span>
            {marcadosIds.length === 1
              ? "1 pessoa marcada"
              : `${marcadosIds.length} pessoas marcadas`}
          </span>
          <button type="button" onClick={() => mudar({ marcados: {} })}>
            Desmarcar
          </button>
        </div>
      ) : null}
      <div className="beneficios__tabela-caixa">
        <table className="beneficios__tabela" aria-label="Quem recebe">
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  aria-label="Marcar todos os visíveis"
                  checked={todosVisiveisMarcados}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        algunsMarcados && !todosVisiveisMarcados;
                  }}
                  onChange={(e) =>
                    visiveis.forEach((p) =>
                      marcar(p.colaboradorId, e.target.checked),
                    )
                  }
                />
              </th>
              <th scope="col">Colaborador</th>
              {estado.tipoValor === "dia_util" ? (
                <>
                  <th scope="col">Escala</th>
                  <th scope="col">Dias</th>
                </>
              ) : null}
              {estado.tipoValor === "faixa_etaria" ? (
                <th scope="col">Faixa</th>
              ) : null}
              {estado.tipoValor === "individual" ? (
                <th scope="col">
                  {estado.individualModo === "plano" ? "Plano" : "Valor"}
                </th>
              ) : null}
              <th scope="col">Valor/mês</th>
              <th scope="col">Empresa paga</th>
              <th scope="col">Desconto</th>
              <th scope="col">Observação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((p) => {
              const m = estado.marcados[p.colaboradorId];
              const traco = <span className="beneficios__suave">—</span>;
              return (
                <tr key={p.colaboradorId} data-marcada={m ? true : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Marcar ${p.nome}`}
                      checked={!!m}
                      onChange={(e) =>
                        marcar(p.colaboradorId, e.target.checked)
                      }
                    />
                  </td>
                  <td>
                    <PessoaNaLinha
                      nome={p.nome}
                      detalhe={
                        p.cargo ??
                        (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[
                          p.contrato
                        ] ??
                        null
                      }
                    />
                  </td>
                  {estado.tipoValor === "dia_util" ? (
                    <>
                      <td>{nomeDaEscala(p.escala)}</td>
                      <td>{m ? p.dias : traco}</td>
                    </>
                  ) : null}
                  {estado.tipoValor === "faixa_etaria" ? (
                    <td>{p.faixa ?? "—"}</td>
                  ) : null}
                  {estado.tipoValor === "individual" ? (
                    <td>
                      {m ? (
                        estado.individualModo === "plano" ? (
                          <select
                            aria-label={`Plano de ${p.nome}`}
                            value={m.planoId ?? ""}
                            onChange={(e) =>
                              mudar({
                                marcados: {
                                  ...estado.marcados,
                                  [p.colaboradorId]: {
                                    ...m,
                                    planoId: e.target.value || null,
                                  },
                                },
                              })
                            }
                          >
                            <option value="">Escolha</option>
                            {estado.planos
                              .filter((pl) => pl.nome.trim())
                              .map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {pl.nome}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <CampoReais
                            rotulo={`Valor de ${p.nome}`}
                            valor={m.valorIndividual}
                            onMudar={(valorIndividual) =>
                              mudar({
                                marcados: {
                                  ...estado.marcados,
                                  [p.colaboradorId]: { ...m, valorIndividual },
                                },
                              })
                            }
                          />
                        )
                      ) : (
                        traco
                      )}
                    </td>
                  ) : null}
                  <td>{m ? formatarCentavos(p.valor) : traco}</td>
                  <td>{m ? formatarCentavos(p.empresa) : traco}</td>
                  <td className="beneficios__forte">
                    {m ? (
                      p.pendencia ? (
                        <StatusBadge variant="warning">Pendente</StatusBadge>
                      ) : (
                        formatarCentavos(p.desconto)
                      )
                    ) : (
                      traco
                    )}
                  </td>
                  <td>
                    {p.pendencia ? (
                      <span className="beneficios__alerta">
                        {TEXTO_DA_PENDENCIA[p.pendencia]}
                      </span>
                    ) : p.observacao ? (
                      TEXTO_DA_OBSERVACAO[p.observacao]
                    ) : p.contrato === "estagio" ? (
                      TEXTO_DA_OBSERVACAO.estagio_sem_desconto
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="beneficios__rodape-totais">
        <strong>{nPessoas(marcadosIds.length)}</strong>
        {totais.pendentes > 0 ? (
          <span className="beneficios__alerta">{` ${totais.pendentes} com pendência`}</span>
        ) : null}
        {` · Empresa ${formatarCentavos(totais.empresa)} · Descontos ${formatarCentavos(totais.desconto)} por mês`}
      </p>
    </div>
  );

  // ---------------------------------------------------------- etapa 4
  const regras = dto.regras;
  const linhasDoValor: [string, string][] = [];
  if (estado.tipoValor === "fixo")
    linhasDoValor.push([
      "Valor",
      `${formatarCentavos(Math.round((estado.valorMensal ?? 0) * 100))} por mês`,
    ]);
  if (estado.tipoValor === "dia_util") {
    linhasDoValor.push([
      "Valor",
      `${formatarCentavos(Math.round((estado.valorDia ?? 0) * 100))} por dia trabalhado`,
    ]);
    linhasDoValor.push([
      "Dias no mês",
      estado.diasModo === "uteis"
        ? `Dias úteis do mês · ${previa?.diasUteis ?? "—"} em ${formatarMesReferencia(competencia)}`
        : "Pela escala de cada pessoa",
    ]);
  }
  if (estado.tipoValor === "individual") {
    linhasDoValor.push([
      "Valor",
      estado.individualModo === "plano"
        ? (regras.planos ?? [])
            .map(
              (p) => `${p.nome} ${formatarCentavos(Math.round(p.valor * 100))}`,
            )
            .join(" · ")
        : "Digitado para cada pessoa",
    ]);
  }
  if (estado.tipoValor === "faixa_etaria") {
    const fs = estado.faixas.map((f) => f ?? 0);
    linhasDoValor.push([
      "Mensalidade",
      `10 faixas da ANS · de ${formatarCentavos(Math.round(Math.min(...fs) * 100))} a ${formatarCentavos(Math.round(Math.max(...fs) * 100))}`,
    ]);
    const cp = estado.colaboradorPaga;
    const fmt = (v: number | null) =>
      cp.calculo === "percentual"
        ? `${formatarPercentual(v ?? 0)}% da mensalidade`
        : `${formatarCentavos(Math.round((v ?? 0) * 100))} por mês`;
    linhasDoValor.push(["Titular paga", fmt(cp.titular)]);
    linhasDoValor.push(["Cada dependente paga", fmt(cp.dependente)]);
    linhasDoValor.push([
      "Coparticipação",
      estado.coparticipacao
        ? "Lançada mês a mês, na tela do benefício"
        : "Não tem",
    ]);
  }
  if (estado.categoria === "antecipacao") {
    linhasDoValor.push([
      "Mensalidade",
      estado.temMensalidade
        ? `${formatarCentavos(Math.round((estado.mensalidade ?? 0) * 100))} por pessoa · ${estado.mensalidadeQuemPaga === "empresa" ? "paga pela empresa" : "descontada do colaborador"}`
        : "Sem mensalidade",
    ]);
    linhasDoValor.push([
      "Valor antecipado",
      estado.modoAntecipacao === "percentual"
        ? `${formatarPercentual(estado.percentualAntecipacao ?? 0)}% do salário, descontado no dia ${estado.diaDesconto}`
        : "Informado pelo RH a cada mês",
    ]);
  }
  if (ehVt) {
    linhasDoValor.push([
      "Desconto do colaborador",
      estado.vt.empresaCusteiaTudo
        ? "A empresa custeia 100%"
        : `${formatarPercentual(estado.vt.percentualSalario ?? 6)}% do salário base, até o valor do VT`,
    ]);
  } else if (
    estado.tipoValor !== "faixa_etaria" &&
    estado.categoria !== "antecipacao" &&
    estado.folha !== "adicional"
  ) {
    const q = estado.quemPaga;
    linhasDoValor.push([
      "Empresa paga",
      q.modo === "empresa_tudo"
        ? "Tudo"
        : q.modo === "colaborador_tudo"
          ? "Nada: o colaborador paga tudo"
          : q.calculo === "percentual"
            ? `${formatarPercentual(q.empresa ?? 0)}%`
            : `${formatarCentavos(Math.round((q.empresa ?? 0) * 100))} ${unidadeEmpresa}`,
    ]);
  }

  const etapa4 = (
    <div key="4" className="beneficios__etapa">
      <dl className="beneficios__numeros">
        <div>
          <dt>Empresa paga</dt>
          <dd>
            <strong>{formatarCentavos(totais.empresa)}</strong>
            <span>por mês</span>
          </dd>
        </div>
        <div>
          <dt>Desconto em folha</dt>
          <dd>
            <strong>{formatarCentavos(totais.desconto)}</strong>
            <span>por mês</span>
          </dd>
        </div>
        <div>
          <dt>Pessoas</dt>
          <dd>
            <strong>{editando ? "—" : marcadosIds.length}</strong>
            {totais.pendentes ? (
              <span className="beneficios__alerta">{`${totais.pendentes} com pendência`}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Primeira folha</dt>
          <dd>
            <strong>
              {maiuscula(formatarCompetenciaPorExtenso(competencia, "barra"))}
            </strong>
            <span>ainda não criada</span>
          </dd>
        </div>
      </dl>
      <BlocoDaRevisao titulo="O benefício" onEditar={() => setAtual(0)}>
        {[
          ["Nome", estado.nome.trim()],
          [
            "Tipo",
            info
              ? `${info.rotulo}${info.regraNaRevisao ? ` · ${info.regraNaRevisao}` : ""}`
              : "—",
          ],
          [
            "Começa em",
            `${formatarDiaCivil(estado.inicio)} · ${estado.fim ? `até ${formatarDiaCivil(estado.fim)}` : "sem data de término"}`,
          ],
          ["No holerite", FOLHAS[estado.folha].naRevisao],
          ...(estado.observacao.trim()
            ? [["Observação", estado.observacao.trim()] as [string, string]]
            : []),
        ]}
      </BlocoDaRevisao>
      <BlocoDaRevisao
        titulo="Como o valor é calculado"
        onEditar={() => setAtual(1)}
        selo={
          previa?.pat
            ? previa.pat.dentro
              ? "Dentro do limite do PAT"
              : "Acima do limite do PAT"
            : null
        }
      >
        {linhasDoValor}
      </BlocoDaRevisao>
      {!editando ? (
        <BlocoDaRevisao titulo="Quem recebe" onEditar={() => setAtual(2)}>
          {[
            ["Pessoas", nPessoas(marcadosIds.length)],
            ...(totais.pendentes
              ? [
                  [
                    "Pendências",
                    `${totais.pendentes === 1 ? "1 pessoa fica" : `${totais.pendentes} pessoas ficam`} fora da folha até completar o cadastro`,
                  ] as [string, string],
                ]
              : []),
          ]}
        </BlocoDaRevisao>
      ) : null}
      <p className="beneficios__nota">
        {editando
          ? `Mudanças nos valores valem a partir de ${formatarMesReferencia(valeAPartirDe)}; os meses anteriores ficam com os valores de antes. Nome, categoria, vigência e folha mudam para todos os meses.`
          : `Os valores entram na folha de ${formatarMesReferencia(competencia)} quando ela existir. Folhas fechadas não mudam.`}
      </p>
    </div>
  );

  const etapas = ETAPAS.map((e, i) =>
    i === 2
      ? {
          ...e,
          titulo: editando ? "Pessoas" : e.titulo,
          descricao: estado.nome.trim()
            ? `Quem recebe o ${estado.nome.trim()}. Os valores já vêm calculados para cada pessoa.`
            : "Quem recebe. Os valores já vêm calculados para cada pessoa.",
        }
      : i === 1 && estado.nome.trim() && estado.tipoValor === "dia_util"
        ? {
            ...e,
            descricao: `${estado.nome.trim()}. O valor mensal muda conforme os dias trabalhados de cada pessoa.`,
          }
        : i === 1 && estado.nome.trim() && estado.tipoValor === "individual"
          ? {
              ...e,
              descricao: `${estado.nome.trim()}. Cada pessoa tem o seu valor.`,
            }
          : i === 1 && estado.nome.trim() && estado.tipoValor === "faixa_etaria"
            ? {
                ...e,
                descricao: `${estado.nome.trim()}. O valor de cada pessoa depende da idade dela.`,
              }
            : e,
  );

  return (
    <>
      <CadastroEmEtapas
        tituloId={ASSISTENTE_TITULO_ID}
        titulo={editando ? `Editar ${base.nome}` : "Novo benefício"}
        descricao={
          editando
            ? "Mudanças nos valores valem a partir do mês atual. Folhas fechadas não mudam."
            : "Configure em 4 etapas. O rascunho fica salvo neste navegador enquanto você preenche."
        }
        rotuloVoltar="Voltar para Benefícios"
        onVoltarDaPagina={() =>
          editando || !(estado.nome || estado.categoria)
            ? onSair()
            : setSair(true)
        }
        acaoDoCabecalho={
          editando ? undefined : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                gravarRascunho(estado);
                setAvisoRascunho("Rascunho salvo neste navegador.");
              }}
            >
              Salvar rascunho
            </Button>
          )
        }
        etapas={etapas}
        atual={atual}
        alcancada={alcancada}
        onIrParaEtapa={setAtual}
        onSubmit={aoEnviar}
        rotuloConcluir={editando ? "Salvar alterações" : "Salvar benefício"}
        ocupado={salvando}
        paineis={[etapa1, etapa2, etapa3, etapa4]}
        mensagem={
          falha ? (
            <p className="beneficios__erro" role="alert">
              {falha}
            </p>
          ) : avisoRascunho ? (
            <p className="beneficios__aviso" role="status">
              {avisoRascunho}
            </p>
          ) : undefined
        }
      />
      <Dialog
        aberto={sair}
        titulo="Sair sem concluir o benefício?"
        descricao={`Você está na etapa ${atual + 1} de 4. O rascunho fica salvo neste navegador e você continua de onde parou ao clicar em "Novo benefício".`}
        onFechar={() => setSair(false)}
        rodape={
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                gravarRascunho(null);
                onSair();
              }}
            >
              Descartar rascunho
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSair(false)}
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              onClick={() => {
                gravarRascunho(estado);
                onSair();
              }}
            >
              Sair e manter rascunho
            </Button>
          </FormActions>
        }
      >
        {null}
      </Dialog>
    </>
  );
}

function FaixaDeErros({ n }: { readonly n: number }) {
  return (
    <div className="beneficios__faixa-erro" role="alert">
      <strong>{faltam(n)}</strong>
      <span>Corrija os campos marcados em vermelho.</span>
    </div>
  );
}

function BlocoDaRevisao({
  titulo,
  onEditar,
  selo,
  children,
}: {
  readonly titulo: string;
  readonly onEditar: () => void;
  readonly selo?: string | null;
  readonly children: readonly [string, string][];
}) {
  return (
    <section className="beneficios__revisao" aria-label={titulo}>
      <header className="beneficios__revisao-cabeca">
        <h3>{titulo}</h3>
        <Button type="button" variant="secondary" onClick={onEditar}>
          Editar
        </Button>
      </header>
      <dl className="beneficios__revisao-lista">
        {children.map(([r, v]) => (
          <div key={r}>
            <dt>{r}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {selo ? (
        <StatusBadge
          variant={selo.startsWith("Dentro") ? "success" : "warning"}
        >
          {selo}
        </StatusBadge>
      ) : null}
    </section>
  );
}

function ResumoPorPessoa({
  previa,
  estado,
  competencia,
  onAjustarPat,
}: {
  readonly previa: PreviaApi;
  readonly estado: EstadoDoAssistente;
  readonly competencia: string;
  readonly onAjustarPat: () => void;
}) {
  const e = previa.exemplo;
  const pctEmpresa = e.valor
    ? Math.round((e.empresa / e.valor) * 10000) / 100
    : 0;
  const pat = previa.pat;
  return (
    <section className="beneficios__resumo" aria-label="Resumo por pessoa">
      <header className="beneficios__resumo-cabeca">
        <h3>Por pessoa, no mês</h3>
        <span className="beneficios__selo">
          {estado.tipoValor === "dia_util"
            ? `${estado.diasModo === "uteis" ? "Dias úteis" : "Exemplo em 5x2"} · ${formatarCompetenciaAbreviada(competencia)}`
            : `Valor fixo · ${formatarCompetenciaAbreviada(competencia)}`}
        </span>
      </header>
      <dl className="beneficios__resumo-lista">
        <div>
          <dt>
            Valor do benefício
            <span className="beneficios__suave">
              {estado.tipoValor === "dia_util"
                ? `${formatarCentavos(e.valorDia ?? 0)} × ${e.dias ?? 0} dias${estado.diasModo === "escala" ? " · cada pessoa conta pela própria escala" : " úteis"}`
                : "Valor fixo mensal"}
            </span>
          </dt>
          <dd>{formatarCentavos(e.valor)}</dd>
        </div>
        <div>
          <dt>
            Empresa paga
            <span className="beneficios__suave">{`${formatarPercentual(pctEmpresa)}% do valor`}</span>
          </dt>
          <dd>{`− ${formatarCentavos(e.empresa)}`}</dd>
        </div>
        <div className="beneficios__resumo-destaque">
          <dt>
            {estado.folha === "desconto"
              ? "Desconto no holerite"
              : estado.folha === "adicional"
                ? "Adicional no holerite"
                : "Parte do colaborador (só registro)"}
            <span className="beneficios__suave">
              {e.desconto || e.parteColaborador
                ? `${formatarPercentual(100 - pctEmpresa)}% do valor${estado.folha === "desconto" ? " · sai do salário do colaborador" : ""}`
                : estado.folha === "adicional"
                  ? "Entra junto com o salário"
                  : "Nada é descontado do colaborador"}
            </span>
          </dt>
          <dd>
            {formatarCentavos(
              estado.folha === "desconto"
                ? e.desconto
                : estado.folha === "adicional"
                  ? e.adicional
                  : e.parteColaborador,
            )}
          </dd>
        </div>
      </dl>
      {pat ? (
        <div
          className={`beneficios__pat${pat.dentro ? "" : " beneficios__pat--acima"}`}
        >
          <div className="beneficios__pat-cabeca">
            <strong>Limite do PAT</strong>
            <StatusBadge variant={pat.dentro ? "success" : "warning"}>
              {pat.dentro ? "Dentro do limite" : "Acima do limite"}
            </StatusBadge>
          </div>
          <p>
            O colaborador paga{" "}
            <strong>{`${formatarPercentual(pat.percentualColaborador)}%`}</strong>{" "}
            do valor. No PAT, o limite é 20%.
          </p>
          <div className="beneficios__pat-barra" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(pat.percentualColaborador, 40) * 2.5}%`,
              }}
            />
            <i />
          </div>
          <div className="beneficios__pat-escala" aria-hidden="true">
            <span>0%</span>
            <span>Limite 20%</span>
            <span>40%</span>
          </div>
          {!pat.dentro ? (
            <div className="beneficios__pat-acao">
              <span>{`Com a empresa pagando 80%, o desconto cai para ${formatarCentavos(Math.round(e.valor * 0.2))}.`}</span>
              <Button type="button" variant="secondary" onClick={onAjustarPat}>
                Ajustar para 80%
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ExemplosDoVt({
  previa,
  competencia,
}: {
  readonly previa: PreviaApi;
  readonly competencia: string;
}) {
  const vt = previa.exemplosVt[0]?.calculo.valor ?? 0;
  return (
    <div className="beneficios__exemplos">
      <p className="beneficios__suave">
        {`Como fica na folha de ${formatarMesReferencia(competencia)} com VT de ${formatarCentavos(vt)} (${previa.diasUteis} dias). Salário mínimo 2026: R$ 1.621,00.`}
      </p>
      <table
        className="beneficios__tabela"
        aria-label="Exemplos do vale-transporte"
      >
        <thead>
          <tr>
            <th scope="col">Salário base</th>
            <th scope="col">VT no mês</th>
            <th scope="col">Percentual do salário</th>
            <th scope="col">Desconto</th>
          </tr>
        </thead>
        <tbody>
          {previa.exemplosVt.map((x, i) => (
            <tr
              key={i}
              data-destaque={
                x.calculo.observacao === "limitado_ao_vt" || undefined
              }
            >
              <td className="beneficios__forte">
                {x.rotulo === "estagio"
                  ? "Estágio"
                  : x.rotulo === "sem_salario"
                    ? "Sem salário"
                    : formatarCentavos(Math.round((x.salario ?? 0) * 100))}
              </td>
              <td>{formatarCentavos(x.calculo.valor)}</td>
              <td>
                {x.rotulo === "salario"
                  ? formatarCentavos(Math.round((x.salario ?? 0) * 6))
                  : "—"}
              </td>
              <td className="beneficios__forte">
                {x.calculo.pendencia ? (
                  <>
                    <StatusBadge variant="warning">Pendente</StatusBadge>{" "}
                    <span className="beneficios__suave">
                      completar cadastro
                    </span>
                  </>
                ) : (
                  <>
                    {formatarCentavos(x.calculo.desconto)}
                    {x.calculo.observacao === "limitado_ao_vt" ? (
                      <span className="beneficios__suave"> limitado ao VT</span>
                    ) : null}
                    {x.calculo.observacao === "estagio_sem_desconto" ? (
                      <span className="beneficios__suave"> Lei 11.788</span>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="beneficios__nota">
        Base do cálculo: salário base, sem horas extras, adicionais ou
        comissões. Estagiários recebem sem desconto. Quem está sem salário fica
        com pendência e o desconto não entra na folha até o RH completar o
        cadastro.
      </p>
    </div>
  );
}

function TabelaDaOperadora({
  estado,
  mudar,
  previa,
  erroDe,
}: {
  readonly estado: EstadoDoAssistente;
  readonly mudar: (p: Partial<EstadoDoAssistente>) => void;
  readonly previa: PreviaApi | null;
  readonly erroDe: (campo: string) => JSX.Element | null;
}) {
  const cp = estado.colaboradorPaga;
  const porFaixa = (rotulo: string) =>
    (previa?.pessoas ?? []).filter((p) => p.faixa && rotulo.startsWith(p.faixa))
      .length;
  const contagens = FAIXAS_DA_ANS.map(porFaixa);
  const maior = Math.max(...contagens);
  const ans = previa?.ans ?? null;
  const fora = ans && (!ans.seisVezesOk || !ans.variacaoOk);
  const parte = (mens: number | null, v: number | null) => {
    if (!mens) return null;
    const c = Math.round(mens * 100);
    return cp.calculo === "percentual"
      ? Math.round((c * (v ?? 0)) / 100)
      : Math.min(Math.round((v ?? 0) * 100), c);
  };
  return (
    <SecaoDoCadastro
      titulo="Tabela da operadora"
      descricao="Copie do contrato a mensalidade de cada faixa de idade. Quanto o titular e cada dependente pagam sai do percentual abaixo."
    >
      {fora && ans ? (
        <div className="beneficios__alerta-caixa" role="alert">
          <strong>Ajuste a faixa de 59 anos ou mais</strong>
          <span>{`Pela regra da ANS, as faixas mais velhas não podem subir mais que as mais novas. Com estes valores, a última faixa pode custar até ${formatarCentavos(Math.round(ans.maximoUltima * 100))} (hoje: ${formatarCentavos(Math.round((estado.faixas[9] ?? 0) * 100))}).`}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              mudar({
                faixas: estado.faixas.map((f, i) =>
                  i === 9 ? ans.maximoUltima : f,
                ),
              })
            }
          >
            {`Usar ${formatarCentavos(Math.round(ans.maximoUltima * 100))}`}
          </Button>
        </div>
      ) : null}
      <div className="beneficios__parte-linha">
        <span>Quanto o colaborador paga</span>
        <Segmentado
          rotulo="Quanto o colaborador paga"
          valor={cp.calculo}
          onMudar={(calculo) =>
            mudar({
              colaboradorPaga: { calculo, titular: null, dependente: null },
            })
          }
          opcoes={[
            { valor: "percentual", rotulo: "% do valor" },
            { valor: "valor", rotulo: "R$ fixo" },
          ]}
        />
        {cp.calculo === "percentual" ? (
          <>
            <CampoNumero
              rotulo="Titular paga (%)"
              decimal
              max={100}
              sufixo="% titular"
              valor={cp.titular}
              onMudar={(titular) =>
                mudar({ colaboradorPaga: { ...cp, titular } })
              }
            />
            <CampoNumero
              rotulo="Dependente paga (%)"
              decimal
              max={100}
              sufixo="% dependente"
              valor={cp.dependente}
              onMudar={(dependente) =>
                mudar({ colaboradorPaga: { ...cp, dependente } })
              }
            />
          </>
        ) : (
          <>
            <CampoReais
              rotulo="Titular paga (R$)"
              sufixo="titular"
              valor={cp.titular}
              onMudar={(titular) =>
                mudar({ colaboradorPaga: { ...cp, titular } })
              }
            />
            <CampoReais
              rotulo="Dependente paga (R$)"
              sufixo="dependente"
              valor={cp.dependente}
              onMudar={(dependente) =>
                mudar({ colaboradorPaga: { ...cp, dependente } })
              }
            />
          </>
        )}
      </div>
      <table
        className="beneficios__tabela"
        aria-label="Mensalidade por faixa etária"
      >
        <thead>
          <tr>
            <th scope="col">Faixa etária</th>
            <th scope="col">Pessoas</th>
            <th scope="col">Mensalidade</th>
            <th scope="col">Titular paga</th>
            <th scope="col">Dependente</th>
            <th scope="col">Empresa paga</th>
          </tr>
        </thead>
        <tbody>
          {FAIXAS_DA_ANS.map((rotulo, i) => {
            const mens = estado.faixas[i] ?? null;
            const tit = parte(mens, cp.titular);
            const dep = parte(mens, cp.dependente);
            return (
              <tr key={rotulo}>
                <td className="beneficios__forte">{rotulo}</td>
                <td>
                  {contagens[i]}
                  {maior > 0 && contagens[i] === maior ? (
                    <span className="beneficios__selo"> maior</span>
                  ) : null}
                </td>
                <td>
                  <CampoReais
                    rotulo={`Mensalidade ${rotulo}`}
                    valor={mens}
                    invalido={i === 9 && !!fora}
                    onMudar={(v) =>
                      mudar({
                        faixas: estado.faixas.map((f, j) => (j === i ? v : f)),
                      })
                    }
                  />
                  {i === 9 && fora && ans ? (
                    <span className="beneficios__alerta">{`Máx. ${formatarCentavos(Math.round(ans.maximoUltima * 100))}`}</span>
                  ) : null}
                </td>
                <td>{tit === null ? "—" : formatarCentavos(tit)}</td>
                <td>{dep === null ? "—" : formatarCentavos(dep)}</td>
                <td className="beneficios__positivo">
                  {tit === null || mens === null
                    ? "—"
                    : formatarCentavos(Math.round(mens * 100) - tit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {erroDe("faixas")}
      <div
        className="beneficios__checklist"
        aria-label="Regras da ANS para a tabela"
      >
        <strong>Regras da ANS para a tabela</strong>
        <p data-ok={ans ? ans.seisVezesOk : undefined}>
          {ans ? (ans.seisVezesOk ? "✓ " : "! ") : "· "}A última faixa custa no
          máximo 6× a primeira
          <span className="beneficios__suave">
            {ans
              ? ` ${formatarPercentual(ans.vezes)}×${ans.seisVezesOk ? " · ok" : ""}`
              : " —"}
          </span>
        </p>
        <p data-ok={ans ? ans.variacaoOk : undefined}>
          {ans ? (ans.variacaoOk ? "✓ " : "! ") : "· "}Da 7ª à 10ª faixa, o
          aumento não passa o da 1ª à 7ª
          <span className="beneficios__suave">
            {ans
              ? ` ${formatarPercentual(ans.variacao7a10)}%${ans.variacaoOk ? " · ok" : ` (máx. ${formatarPercentual(ans.variacao1a7)}%)`}`
              : " —"}
          </span>
        </p>
        <p className="beneficios__suave">
          A pessoa muda de faixa no mês seguinte ao aniversário. Dependentes
          entram pela faixa de cada um.
        </p>
      </div>
      <LinhaDoCadastro
        rotulo="Tem coparticipação? *"
        ajuda="Valor extra por consulta ou exame usado. Muda todo mês."
        grupo={false}
      >
        <CartoesDeOpcao
          rotulo="Tem coparticipação"
          valor={
            estado.coparticipacao === null
              ? null
              : estado.coparticipacao
                ? "sim"
                : "nao"
          }
          onMudar={(v) => mudar({ coparticipacao: v === "sim" })}
          opcoes={[
            {
              valor: "sim" as const,
              titulo: "Sim",
              ajuda:
                "Todo mês você informa o valor usado por cada pessoa, e ele soma ao desconto do holerite.",
            },
            {
              valor: "nao" as const,
              titulo: "Não",
              ajuda: "Sem valor extra por consulta ou exame.",
            },
          ]}
        />
        {erroDe("coparticipacao")}
      </LinhaDoCadastro>
    </SecaoDoCadastro>
  );
}
