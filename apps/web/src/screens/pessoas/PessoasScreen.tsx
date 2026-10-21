/**
 * Pessoas (T072) — wrapper de navegação local entre "Colaboradores" (padrão,
 * T072), "Horário de trabalho" (T046), "Histórico funcional" (T088),
 * "Dados contratuais" (T089), "Documentos" (T090), "Solicitações" (T091),
 * "Benefícios" (T092), "Dependentes" (T093) e "Afastamentos" (T094).
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino "Pessoas"
 * é selecionado no shell, este componente remonta e volta ao padrão
 * "Colaboradores" (mesmo princípio do "Ponto" — T063 — do "Documentos" —
 * T070 — e do "Portal do Colaborador" — T067). Como só a aba ativa é
 * renderizada por vez, existe sempre exatamente um `h1` na página — cada
 * tela (`ColaboradoresScreen`, `PessoasHorarioScreen`,
 * `HistoricoFuncionalScreen`, `DadosContratuaisScreen`,
 * `PessoasDocumentosScreen`, `SolicitacoesScreen`, `BeneficiosScreen`,
 * `DependentesScreen`, `AfastamentosScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useRef, useState } from "react";
import {
  type EstadoDestino,
  destinoPorId,
  tituloDoGrupoDe,
} from "../../app/mapaNavegacao";
import { TrilhaNavegacao } from "../../components";
import {
  AFASTAMENTOS_TITULO_ID,
  AfastamentosScreen,
} from "./AfastamentosScreen";
import { BeneficiosScreen, BENEFICIOS_TITULO_ID } from "./BeneficiosScreen";
import {
  COLABORADORES_TITULO_ID,
  ColaboradoresScreen,
} from "./ColaboradoresScreen";
import {
  DADOS_CONTRATUAIS_TITULO_ID,
  DadosContratuaisScreen,
} from "./DadosContratuaisScreen";
import { DEPENDENTES_TITULO_ID, DependentesScreen } from "./DependentesScreen";
import {
  HISTORICO_FUNCIONAL_TITULO_ID,
  HistoricoFuncionalScreen,
} from "./HistoricoFuncionalScreen";
import {
  PESSOAS_DOCUMENTOS_TITULO_ID,
  PessoasDocumentosScreen,
} from "./PessoasDocumentosScreen";
import {
  PESSOAS_HORARIO_TITULO_ID,
  PessoasHorarioScreen,
} from "./PessoasHorarioScreen";
import type { ColaboradoresScreenProps } from "./ColaboradoresScreen";
import "./PessoasScreen.css";
import {
  SOLICITACOES_TITULO_ID,
  SolicitacoesScreen,
} from "./SolicitacoesScreen";

export { PESSOAS_HORARIO_TITULO_ID };

type AbaPessoas =
  | "colaboradores"
  | "horario"
  | "historico_funcional"
  | "dados_contratuais"
  | "documentos"
  | "solicitacoes"
  | "beneficios"
  | "dependentes"
  | "afastamentos";

interface AbaDefinicao {
  readonly id: AbaPessoas;
  readonly rotulo: string;
  /** T159 — funcional fala com a API; demonstrativo lê fixtures. */
  readonly estado: EstadoDestino;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "colaboradores",
    rotulo: "Colaboradores",
    tituloId: COLABORADORES_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "horario",
    rotulo: "Horário de trabalho",
    tituloId: PESSOAS_HORARIO_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "historico_funcional",
    rotulo: "Histórico funcional",
    tituloId: HISTORICO_FUNCIONAL_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "dados_contratuais",
    rotulo: "Dados contratuais",
    tituloId: DADOS_CONTRATUAIS_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "documentos",
    rotulo: "Documentos",
    tituloId: PESSOAS_DOCUMENTOS_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "solicitacoes",
    rotulo: "Solicitações",
    tituloId: SOLICITACOES_TITULO_ID,
    estado: "funcional",
  },
  {
    id: "beneficios",
    rotulo: "Benefícios",
    tituloId: BENEFICIOS_TITULO_ID,
    estado: "demonstrativo",
  },
  {
    id: "dependentes",
    rotulo: "Dependentes",
    tituloId: DEPENDENTES_TITULO_ID,
    estado: "demonstrativo",
  },
  {
    id: "afastamentos",
    rotulo: "Afastamentos",
    tituloId: AFASTAMENTOS_TITULO_ID,
    estado: "demonstrativo",
  },
];

export interface PessoasScreenProps {
  /**
   * T164 — a empresa de trabalho ATIVA, resolvida pelo servidor.
   *
   * Desce pelo shell em vez de ser lida aqui: o `AutenticacaoApp` já tem o
   * ator, e pedir `/v1/users/me` de novo seria uma requisição a mais para um
   * dado que já está em memória. É contexto, nunca controle — quem troca de
   * empresa é o Hub, e só para os papéis que o servidor autoriza.
   */
  readonly empresaAtiva?: {
    readonly nome: string;
    readonly codigo: string;
  } | null;
  /**
   * T159 — quais abas este contêiner mostra.
   *
   * `funcional` lista só as abas que falam com o servidor; `demonstrativo`,
   * só as de exemplo. A separação é de arquitetura de informação: nenhuma
   * tela mudou, e nenhuma deixou de ser alcançável — as demonstrativas vivem
   * no grupo Demonstração da navegação, nomeado como tal.
   *
   * O padrão é `funcional`: quem renderizar este contêiner sem dizer o modo
   * recebe a navegação primária, nunca a maquete.
   */
  modo?: EstadoDestino;
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
  /** T176 — repassados à aba Colaboradores (ver `ColaboradoresScreenProps`). */
  aberturaInicial?: ColaboradoresScreenProps["aberturaInicial"];
  onAberturaAtendida?: () => void;
  /** T177 — leva "Novo colaborador" à página de Nova admissão. */
  onNovaAdmissao?: ColaboradoresScreenProps["onNovaAdmissao"];
}

export function PessoasScreen({
  onTituloIdChange,
  modo = "funcional",
  empresaAtiva = null,
  aberturaInicial = null,
  onAberturaAtendida,
  onNovaAdmissao,
}: PessoasScreenProps) {
  // Só as abas do modo. `ABAS` continua sendo a fonte única; o filtro é
  // de apresentação, e a primeira aba do conjunto vira o padrão — assim
  // o contêiner nunca abre numa aba que ele mesmo não lista.
  const abas = ABAS.filter((aba) => aba.estado === modo);
  const [abaAtiva, setAbaAtiva] = useState<AbaPessoas>(abas[0]!.id);

  const definicaoAtiva = abas.find((aba) => aba.id === abaAtiva) ?? abas[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  /**
   * T178 — voltar a Colaboradores pela trilha. O botão acionado vira texto (a
   * página atual não é clicável), e o foco cairia no `<body>`: vai para a aba
   * Colaboradores, que é onde a pessoa chegou.
   */
  const focarAbaColaboradoresRef = useRef(false);
  useEffect(() => {
    if (!focarAbaColaboradoresRef.current) return;
    focarAbaColaboradoresRef.current = false;
    document.getElementById("pessoas-tab-colaboradores")?.focus();
  }, [abaAtiva]);

  // T178 — trilha só no modo funcional, que é o destino "Colaboradores" da
  // barra. Os nomes saem do mapa de navegação: barra e trilha não divergem.
  // A aba ativa, quando não é Colaboradores, entra como terceiro nível.
  const trilha =
    modo === "funcional"
      ? [
          { rotulo: tituloDoGrupoDe("pessoas") ?? "Gestão de Pessoas" },
          {
            rotulo: destinoPorId("pessoas")?.label ?? "Colaboradores",
            onSelecionar: () => {
              focarAbaColaboradoresRef.current = true;
              setAbaAtiva("colaboradores");
            },
          },
          ...(definicaoAtiva.id === "colaboradores"
            ? []
            : [{ rotulo: definicaoAtiva.rotulo }]),
        ]
      : null;

  return (
    <div className="pessoas-screen">
      {trilha ? <TrilhaNavegacao itens={trilha} /> : null}
      <div
        role="tablist"
        aria-label="Seções de Pessoas"
        className="pessoas-screen__tabs"
      >
        {abas.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`pessoas-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`pessoas-panel-${aba.id}`}
              className={
                selecionada
                  ? "pessoas-screen__tab pessoas-screen__tab--ativa"
                  : "pessoas-screen__tab"
              }
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`pessoas-panel-${definicaoAtiva.id}`}
        aria-labelledby={`pessoas-tab-${definicaoAtiva.id}`}
        className="pessoas-screen__panel"
      >
        {abaAtiva === "colaboradores" ? (
          <ColaboradoresScreen
            empresaAtiva={empresaAtiva}
            aberturaInicial={aberturaInicial}
            {...(onAberturaAtendida ? { onAberturaAtendida } : {})}
            {...(onNovaAdmissao ? { onNovaAdmissao } : {})}
          />
        ) : abaAtiva === "horario" ? (
          <PessoasHorarioScreen />
        ) : abaAtiva === "historico_funcional" ? (
          <HistoricoFuncionalScreen />
        ) : abaAtiva === "dados_contratuais" ? (
          <DadosContratuaisScreen />
        ) : abaAtiva === "documentos" ? (
          <PessoasDocumentosScreen />
        ) : abaAtiva === "solicitacoes" ? (
          <SolicitacoesScreen />
        ) : abaAtiva === "beneficios" ? (
          <BeneficiosScreen />
        ) : abaAtiva === "dependentes" ? (
          <DependentesScreen />
        ) : (
          <AfastamentosScreen />
        )}
      </div>
    </div>
  );
}
