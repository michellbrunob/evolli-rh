/**
 * T202 — aba "Registros de ponto" da ficha do colaborador. **Só consulta.**
 *
 * Mostra as marcações de ponto da pessoa aberta, na empresa ativa da sessão,
 * na competência (mês) da rota: um bloco por vínculo dela nessa empresa (o
 * principal primeiro, inclusive encerrados — P-3), com as marcações agrupadas
 * por dia civil em `America/Sao_Paulo` (o fuso do servidor), na ordem do
 * horário **efetivo** (o original com os ajustes aplicados).
 *
 * Contratos que já existiam, sem endpoint novo:
 * - `GET /v1/users/me` — a empresa ativa da SESSÃO;
 * - `GET /v1/vinculos/:vinculoId/pontos?competencia=` — uma consulta por
 *   vínculo, lendo TODAS as páginas (100 por página) pelo `total`: o mês
 *   nunca aparece cortado.
 * Os vínculos já vêm da ficha (`GET /v1/colaboradores/:id/vinculos`).
 *
 * Nada é calculado (ADR 0008 §7): sem total, saldo, horas trabalhadas, banco
 * de horas ou comparação com a jornada. Nada é escrito: registrar e ajustar
 * seguem em Jornada › Visão do período (F-7 da T201). Sem formulário, a aba
 * não cria edição pendente.
 *
 * Empresa ativa (P-2): sem ela — o `master_tecnico` global —, a leitura de
 * ponto do servidor é de todas as empresas; a aba não consulta nada e
 * orienta a escolher a empresa. Com ela, só os vínculos e as marcações da
 * empresa da sessão entram, além do filtro do servidor.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import { Button, StatusBadge } from "../../components";
import type { StatusVariant } from "../../components";
import { obterUsuarioAtual } from "../../api/usersClient";
import type {
  SituacaoVinculo,
  TipoVinculo,
  VinculoApi,
} from "../../api/colaboradoresClient";
import {
  type EventoPontoApi,
  type TipoEventoPonto,
  listarPontosDoVinculo,
} from "../../api/pontoClient";
import { competenciaValida, competenciaVizinha } from "../../app/rotasDoShell";
import { formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import "./RegistrosPontoColaboradorSecao.css";

/** Itens por página pedidos ao servidor: o máximo que ele aceita. */
export const TAMANHO_PAGINA_PONTO = 100;

const ROTULO_TIPO_EVENTO: Record<TipoEventoPonto, string> = {
  entrada: "Entrada",
  saida: "Saída",
  inicio_pausa: "Início de pausa",
  fim_pausa: "Fim de pausa",
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

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** `2026-11` → "novembro de 2026". */
export function rotuloDaCompetencia(competencia: string): string {
  const mes = MESES[Number(competencia.slice(5, 7)) - 1] ?? competencia;
  return `${mes} de ${Number(competencia.slice(0, 4))}`;
}

/** Uma marcação pronta para exibir: dia e hora no fuso de negócio. */
interface MarcacaoExibida {
  readonly evento: EventoPontoApi;
  readonly dia: string;
  readonly hora: string;
  readonly instante: number;
}

interface DiaDeMarcacoes {
  readonly dia: string;
  readonly marcacoes: readonly MarcacaoExibida[];
}

/**
 * Agrupa por dia civil em `America/Sao_Paulo` (via `formatarInstante`, que
 * formata nesse fuso) e ordena pelo horário EFETIVO, do mais antigo ao mais
 * recente. Só apresentação: nada é somado nem pareado.
 */
export function agruparPorDia(
  eventos: readonly EventoPontoApi[],
): DiaDeMarcacoes[] {
  const exibidas: MarcacaoExibida[] = [];
  for (const evento of eventos) {
    const texto = formatarInstante(evento.efetivo.momento);
    const [dia, hora] = texto.split(" às ");
    exibidas.push({
      evento,
      dia: dia ?? texto,
      hora: hora ?? texto,
      instante: Date.parse(evento.efetivo.momento),
    });
  }
  exibidas.sort(
    (a, b) => a.instante - b.instante || a.evento.id.localeCompare(b.evento.id),
  );
  const dias: { dia: string; marcacoes: MarcacaoExibida[] }[] = [];
  for (const m of exibidas) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.dia === m.dia) ultimo.marcacoes.push(m);
    else dias.push({ dia: m.dia, marcacoes: [m] });
  }
  return dias;
}

/** Falha com nova tentativa: o aviso e o botão ficam no lugar ao reler. */
interface Falha {
  readonly tipo: "erro";
  readonly relendo: boolean;
  readonly falhas: number;
}

function proximaFalha(anterior: { readonly tipo: string }): Falha {
  const falhas = anterior.tipo === "erro" ? (anterior as Falha).falhas : 0;
  return { tipo: "erro", relendo: false, falhas: falhas + 1 };
}

function emNovaLeitura<T extends { readonly tipo: string }>(anterior: T): T {
  return anterior.tipo === "erro" ? { ...anterior, relendo: true } : anterior;
}

type EstadoDaSessao =
  | { readonly tipo: "carregando" }
  | Falha
  | { readonly tipo: "sem-empresa" }
  | { readonly tipo: "pronta"; readonly empresaId: string };

type EstadoDasMarcacoes =
  | { readonly tipo: "carregando"; readonly competencia: string }
  | (Falha & { readonly competencia: string })
  | {
      readonly tipo: "dados";
      readonly competencia: string;
      readonly porVinculo: ReadonlyMap<string, readonly EventoPontoApi[]>;
    };

export interface RegistrosPontoColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly nomeColaborador: string;
  /** Os vínculos da pessoa, como a ficha os leu (escopo da sessão). */
  readonly vinculos: readonly VinculoApi[];
  /** O vínculo principal (mesma regra do cabeçalho), ou `null`. */
  readonly vinculoPrincipalId: string | null;
  /** A competência da rota, `AAAA-MM`. */
  readonly competencia: string;
  /** Pede outra competência: o shell troca a rota. */
  readonly onTrocarCompetencia: (competencia: string) => void;
}

export function RegistrosPontoColaboradorSecao({
  colaboradorId,
  nomeColaborador,
  vinculos,
  vinculoPrincipalId,
  competencia,
  onTrocarCompetencia,
}: RegistrosPontoColaboradorSecaoProps) {
  const prefixo = useId();
  const ids = useMemo(
    () => ({
      titulo: `${prefixo}-titulo`,
      mes: `${prefixo}-mes`,
      novaTentativa: `${prefixo}-nova-tentativa`,
      vinculo: (vinculoId: string) => `${prefixo}-vinculo-${vinculoId}`,
    }),
    [prefixo],
  );

  const [sessao, setSessao] = useState<EstadoDaSessao>({ tipo: "carregando" });
  const [marcacoes, setMarcacoes] = useState<EstadoDasMarcacoes>({
    tipo: "carregando",
    competencia,
  });
  /** O mês digitado no campo (pode estar incompleto até ser válido). */
  const [mesDigitado, setMesDigitado] = useState(competencia);
  useEffect(() => setMesDigitado(competencia), [competencia]);

  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /** Só vale a leitura mais recente (troca de mês, de pessoa, nova tentativa). */
  const geracaoRef = useRef(0);

  // ---- Sessão: empresa ativa -------------------------------------------------
  const carregarSessao = useCallback(
    async (novaLeitura = false) => {
      if (novaLeitura) setSessao(emNovaLeitura);
      else setSessao({ tipo: "carregando" });
      try {
        const ator = await obterUsuarioAtual();
        if (!vivaRef.current) return;
        const empresaId =
          typeof ator.companyId === "string" && ator.companyId.length > 0
            ? ator.companyId
            : null;
        if (novaLeitura) focoRef.current = ids.titulo;
        setSessao(
          empresaId === null
            ? { tipo: "sem-empresa" }
            : { tipo: "pronta", empresaId },
        );
      } catch {
        if (vivaRef.current) setSessao(proximaFalha);
      }
    },
    [ids],
  );

  useEffect(() => {
    void carregarSessao();
  }, [carregarSessao]);

  const empresaId = sessao.tipo === "pronta" ? sessao.empresaId : null;

  /** Os vínculos desta pessoa NESTA empresa, o principal primeiro (P-3). */
  const vinculosDaEmpresa = useMemo(() => {
    if (empresaId === null) return [];
    const daEmpresa = vinculos.filter(
      (v) => v.colaboradorId === colaboradorId && v.empresaId === empresaId,
    );
    const principal = daEmpresa.find((v) => v.id === vinculoPrincipalId);
    return principal
      ? [principal, ...daEmpresa.filter((v) => v.id !== principal.id)]
      : daEmpresa;
  }, [vinculos, colaboradorId, empresaId, vinculoPrincipalId]);

  // ---- Marcações: todas as páginas de cada vínculo ---------------------------
  const carregarMarcacoes = useCallback(
    async (novaLeitura = false) => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current;
      if (novaLeitura) setMarcacoes(emNovaLeitura);
      else setMarcacoes({ tipo: "carregando", competencia });
      try {
        const lidas = await Promise.all(
          vinculosDaEmpresa.map(async (vinculo) => {
            const consulta = (pagina: number) =>
              listarPontosDoVinculo(vinculo.id, {
                competencia,
                pagina,
                tamanhoPagina: TAMANHO_PAGINA_PONTO,
              });
            const primeira = await consulta(1);
            const paginas = Math.max(
              1,
              Math.ceil(primeira.total / TAMANHO_PAGINA_PONTO),
            );
            const demais = await Promise.all(
              Array.from({ length: paginas - 1 }, (_, i) => consulta(i + 2)),
            );
            // Defesa além do servidor: só deste vínculo, desta empresa e
            // deste mês; sem repetir (uma marcação nova entre duas páginas
            // empurraria uma linha para a página seguinte).
            const vistos = new Set<string>();
            const itens = [primeira, ...demais]
              .flatMap((p) => p.itens)
              .filter((e) => {
                if (
                  e.vinculoId !== vinculo.id ||
                  e.empresaId !== empresaId ||
                  e.competencia !== competencia ||
                  vistos.has(e.id)
                ) {
                  return false;
                }
                vistos.add(e.id);
                return true;
              });
            return [vinculo.id, itens] as const;
          }),
        );
        if (!vivaRef.current || geracao !== geracaoRef.current) return;
        if (novaLeitura) focoRef.current = ids.titulo;
        setMarcacoes({
          tipo: "dados",
          competencia,
          porVinculo: new Map(lidas),
        });
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current) return;
        setMarcacoes((anterior) => ({
          ...proximaFalha(anterior),
          competencia,
        }));
      }
    },
    [empresaId, vinculosDaEmpresa, competencia, ids],
  );

  useEffect(() => {
    if (empresaId === null) return;
    void carregarMarcacoes();
  }, [empresaId, carregarMarcacoes]);

  // ---- Foco depois do desenho -----------------------------------------------
  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  // ---- Troca de mês ------------------------------------------------------------
  function irPara(nova: string) {
    if (!competenciaValida(nova) || nova === competencia) return;
    onTrocarCompetencia(nova);
  }

  function aoDigitarMes(evento: ChangeEvent<HTMLInputElement>) {
    const valor = evento.target.value;
    setMesDigitado(valor);
    // Só um mês válido vira rota; vazio ou incompleto fica no campo.
    if (competenciaValida(valor)) irPara(valor);
  }

  const rotuloDoMes = rotuloDaCompetencia(competencia);

  // ---- Desenho ----------------------------------------------------------------
  const cabecalho = (
    <>
      <h2
        id={ids.titulo}
        tabIndex={-1}
        className="ficha-colaborador__subtitulo"
      >
        Registros de ponto
      </h2>
      <p className="registros-ponto__aviso">
        <StatusBadge variant="info">Somente consulta</StatusBadge> Mostra as
        marcações registradas, com os ajustes aplicados, sem total, saldo, horas
        trabalhadas ou comparação com a jornada. Registrar e ajustar marcações
        continua em Jornada › Visão do período.
      </p>
    </>
  );

  // Um só nó de status, logo depois do cabeçalho, do começo ao fim (lição do
  // B3 da T201): sessão e marcações carregando dizem o MESMO texto, e cada
  // evento (carga, resultado, vazio) é anunciado uma vez.
  const carregando =
    sessao.tipo === "carregando" ||
    (sessao.tipo === "pronta" &&
      (marcacoes.tipo === "carregando" ||
        (marcacoes.tipo === "erro" && marcacoes.relendo)));
  const textoDoStatus = carregando
    ? `Carregando registros de ponto de ${rotuloDoMes}…`
    : sessao.tipo === "pronta" &&
        marcacoes.tipo === "dados" &&
        vinculosDaEmpresa.length > 0
      ? [...marcacoes.porVinculo.values()].every((l) => l.length === 0)
        ? `Nenhuma marcação em ${rotuloDoMes}.`
        : `Registros de ponto de ${rotuloDoMes} carregados.`
      : "";

  return (
    <section
      className="ficha-colaborador__cartao registros-ponto"
      aria-labelledby={ids.titulo}
    >
      {cabecalho}
      <p role="status" className="ficha-colaborador__so-leitor">
        {textoDoStatus}
      </p>
      {sessao.tipo === "carregando" ? (
        <p className="ficha-colaborador__texto" aria-hidden="true">
          Carregando…
        </p>
      ) : sessao.tipo === "sem-empresa" ? (
        <div className="registros-ponto__orientacao">
          <p className="ficha-colaborador__texto">
            Escolha uma empresa ativa para consultar os registros de ponto de{" "}
            {nomeColaborador}.
          </p>
          <p className="ficha-colaborador__cartao-contexto">
            Sem empresa ativa, as marcações de empresas diferentes ficariam
            misturadas. Use o seletor de empresa do menu.
          </p>
        </div>
      ) : sessao.tipo === "erro" ? (
        <FalhaComNovaTentativa
          id={ids.novaTentativa}
          falha={sessao}
          texto="Não foi possível conferir o seu acesso aos registros de ponto."
          onTentar={() => void carregarSessao(true)}
        />
      ) : (
        <>
          <div
            className="registros-ponto__mes"
            role="group"
            aria-label="Competência"
          >
            <Button
              variant="secondary"
              onClick={() => irPara(competenciaVizinha(competencia, -1))}
            >
              Mês anterior
            </Button>
            <div className="registros-ponto__campo">
              <label htmlFor={ids.mes}>Mês</label>
              <input
                id={ids.mes}
                type="month"
                value={mesDigitado}
                onChange={aoDigitarMes}
                onBlur={() => setMesDigitado(competencia)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => irPara(competenciaVizinha(competencia, 1))}
            >
              Próximo mês
            </Button>
          </div>

          <p className="registros-ponto__competencia">
            Competência: <strong>{rotuloDoMes}</strong>
          </p>

          {vinculosDaEmpresa.length === 0 ? (
            <p className="ficha-colaborador__texto">
              {`${nomeColaborador} não tem vínculo nesta empresa: não há registros de ponto a consultar.`}
            </p>
          ) : marcacoes.tipo === "erro" ? (
            <FalhaComNovaTentativa
              id={ids.novaTentativa}
              falha={marcacoes}
              texto={`Não foi possível carregar os registros de ponto de ${rotuloDoMes}.`}
              onTentar={() => void carregarMarcacoes(true)}
            />
          ) : marcacoes.tipo === "carregando" ? (
            <p className="ficha-colaborador__texto" aria-hidden="true">
              Carregando…
            </p>
          ) : (
            vinculosDaEmpresa.map((vinculo) => (
              <BlocoDoVinculo
                key={vinculo.id}
                id={ids.vinculo(vinculo.id)}
                vinculo={vinculo}
                principal={vinculo.id === vinculoPrincipalId}
                eventos={marcacoes.porVinculo.get(vinculo.id) ?? []}
                rotuloDoMes={rotuloDoMes}
              />
            ))
          )}
        </>
      )}
    </section>
  );
}

function BlocoDoVinculo({
  id,
  vinculo,
  principal,
  eventos,
  rotuloDoMes,
}: {
  readonly id: string;
  readonly vinculo: VinculoApi;
  readonly principal: boolean;
  readonly eventos: readonly EventoPontoApi[];
  readonly rotuloDoMes: string;
}) {
  const dias = agruparPorDia(eventos);
  return (
    <section className="registros-ponto__vinculo" aria-labelledby={id}>
      <h3 id={id} className="ficha-colaborador__cartao-titulo">
        {ROTULO_TIPO_VINCULO[vinculo.tipo] ?? vinculo.tipo} ·{" "}
        {exibirMatricula(vinculo.matricula)}
        {principal ? " · vínculo principal" : ""}
      </h3>
      <p className="registros-ponto__situacao">
        <StatusBadge variant={VARIANTE_SITUACAO_VINCULO[vinculo.situacao]}>
          {ROTULO_SITUACAO_VINCULO[vinculo.situacao] ?? vinculo.situacao}
        </StatusBadge>
      </p>
      {dias.length === 0 ? (
        <p className="ficha-colaborador__texto">
          {`Nenhuma marcação neste vínculo em ${rotuloDoMes}.`}
        </p>
      ) : (
        dias.map((dia) => (
          <div key={dia.dia} className="registros-ponto__dia">
            <h4 className="registros-ponto__dia-titulo">{dia.dia}</h4>
            <ul className="registros-ponto__lista">
              {dia.marcacoes.map((m) => (
                <Marcacao key={m.evento.id} marcacao={m} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function Marcacao({ marcacao }: { readonly marcacao: MarcacaoExibida }) {
  const { evento, hora } = marcacao;
  const efetivo = evento.efetivo;
  const ajustada = !efetivo.anulado && efetivo.totalAjustes > 0;
  const mudou =
    efetivo.momento !== evento.momento || efetivo.tipo !== evento.tipo;
  return (
    <li
      className={
        efetivo.anulado
          ? "registros-ponto__marcacao registros-ponto__marcacao--anulada"
          : "registros-ponto__marcacao"
      }
    >
      <span className="registros-ponto__hora">{hora}</span>
      <span className="registros-ponto__tipo">
        {ROTULO_TIPO_EVENTO[efetivo.tipo] ?? efetivo.tipo}
      </span>
      {efetivo.anulado ? (
        <StatusBadge variant="neutral">Anulada</StatusBadge>
      ) : ajustada ? (
        <StatusBadge variant="warning">Ajustada</StatusBadge>
      ) : null}
      {(ajustada || efetivo.anulado) && mudou ? (
        <span className="registros-ponto__original">
          {`Registro original: ${formatarInstante(evento.momento).split(" às ")[1] ?? formatarInstante(evento.momento)} · ${ROTULO_TIPO_EVENTO[evento.tipo] ?? evento.tipo}`}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Aviso de falha com o botão de nova tentativa. Durante a nova leitura o
 * botão fica no lugar, focado, com `aria-disabled`; cada falha monta um
 * alerta novo (a `key`), anunciado uma vez.
 */
function FalhaComNovaTentativa({
  id,
  falha,
  texto,
  onTentar,
}: {
  readonly id: string;
  readonly falha: Falha;
  readonly texto: string;
  readonly onTentar: () => void;
}) {
  return (
    <div className="ficha-colaborador__aviso">
      <p key={falha.falhas} role="alert" className="ficha-colaborador__texto">
        {texto}
      </p>
      <Button
        id={id}
        variant="secondary"
        aria-disabled={falha.relendo}
        onClick={() => {
          if (!falha.relendo) onTentar();
        }}
      >
        Tentar de novo
      </Button>
    </div>
  );
}
