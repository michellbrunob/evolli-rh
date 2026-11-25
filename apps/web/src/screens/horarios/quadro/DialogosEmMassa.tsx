/**
 * T215 — os diálogos das ações em massa do quadro da escala, no texto da
 * referência: Trocar turno, Dar folga, Repetir esta semana até… e Limpar o
 * rascunho do período. Tudo vai para o RASCUNHO; nada é publicado.
 */
import { useEffect, useId, useState } from "react";
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import { Button, Dialog } from "../../../ui";
import { plural } from "../../../format/plural";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { descricaoDoTurnoNoDia } from "./MenuDaCelula";
import {
  type MudancaDaPessoa,
  type PlanoDoLote,
  trocarTurno,
} from "./acoesEmMassa";

const LETRAS = [
  { n: 1, letra: "S", nome: "Segunda" },
  { n: 2, letra: "T", nome: "Terça" },
  { n: 3, letra: "Q", nome: "Quarta" },
  { n: 4, letra: "Q", nome: "Quinta" },
  { n: 5, letra: "S", nome: "Sexta" },
  { n: 6, letra: "S", nome: "Sábado" },
  { n: 7, letra: "D", nome: "Domingo" },
];

/** Até seis semanas por vez (o que o quadro carrega). */
export const DIAS_NA_TROCA = 42;

function quantosDias(de: string, ate: string): number {
  return (
    Math.round(
      (Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) -
        Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) /
        86_400_000,
    ) + 1
  );
}

function Rodape({
  enviando,
  onFechar,
  rotulo,
  onConfirmar,
  perigo = false,
}: {
  enviando: boolean;
  onFechar: () => void;
  rotulo: string;
  onConfirmar: () => void;
  perigo?: boolean;
}) {
  return (
    <>
      <Button variant="secondary" onClick={onFechar} disabled={enviando}>
        Cancelar
      </Button>
      <Button
        variant={perigo ? "danger" : "primary"}
        onClick={onConfirmar}
        disabled={enviando}
      >
        {rotulo}
      </Button>
    </>
  );
}

const FALHA = "Não foi possível gravar no rascunho. Tente de novo.";

/** "Trocar turno de N pessoa(s)". */
export function DialogoTrocarTurno({
  pessoas,
  turnos,
  inicio,
  fim,
  obterPessoas,
  onAplicar,
  onFechar,
}: {
  readonly pessoas: readonly PessoaDoQuadroApi[];
  readonly turnos: readonly TabelaHorarioApi[];
  readonly inicio: string;
  readonly fim: string;
  /** As pessoas com os dias do intervalo (outro período, se preciso). */
  readonly obterPessoas: (
    de: string,
    ate: string,
  ) => Promise<readonly PessoaDoQuadroApi[]>;
  readonly onAplicar: (
    plano: PlanoDoLote,
    pessoasDoIntervalo: readonly PessoaDoQuadroApi[],
    turno: TabelaHorarioApi,
  ) => Promise<void>;
  readonly onFechar: () => void;
}) {
  const id = useId();
  const [turnoId, setTurnoId] = useState(turnos[0]?.id ?? "");
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const [dias, setDias] = useState<ReadonlySet<number>>(
    () => new Set([1, 2, 3, 4, 5]),
  );
  const [tambemNasFolgas, setTambemNasFolgas] = useState(false);
  const [doIntervalo, setDoIntervalo] = useState<
    readonly PessoaDoQuadroApi[] | null
  >(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const turno = turnos.find((t) => t.id === turnoId) ?? null;
  const n = de && ate ? quantosDias(de, ate) : 0;
  const periodoValido = !!de && !!ate && n >= 1 && n <= DIAS_NA_TROCA;

  useEffect(() => {
    if (!periodoValido) return;
    let vivo = true;
    setDoIntervalo(null);
    obterPessoas(de, ate).then(
      (ps) => {
        if (vivo) setDoIntervalo(ps);
      },
      () => {
        if (vivo) setErro("Não foi possível carregar os dias do período.");
      },
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, periodoValido]);

  const resultado =
    turno && doIntervalo && periodoValido
      ? trocarTurno(doIntervalo, {
          turno,
          de,
          ate,
          diasDaSemana: dias,
          tambemNasFolgas,
        })
      : null;

  const linha = (m: MudancaDaPessoa) =>
    m.dias > 0
      ? `${plural(m.dias, "dia", "dias")} com ${turno?.nome ?? ""}`
      : m.iguais > 0
        ? `sem mudança (já é ${turno?.nome ?? ""})`
        : "sem dia para trocar";

  const aplicar = async () => {
    if (!periodoValido) {
      setErro(`Escolha um período de 1 a ${DIAS_NA_TROCA} dias.`);
      return;
    }
    if (!turno || !resultado || !doIntervalo) return;
    if (resultado.plano.gravar.length === 0) {
      setErro("Nada muda com essas escolhas.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onAplicar(resultado.plano, doIntervalo, turno);
    } catch {
      setErro(FALHA);
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      titulo={`Trocar turno de ${plural(pessoas.length, "pessoa", "pessoas")}`}
      descricao={pessoas.map((p) => p.nome).join(", ")}
      onFechar={onFechar}
      bloqueado={enviando}
      className="dialogo-massa"
      rodape={
        <Rodape
          enviando={enviando}
          onFechar={onFechar}
          rotulo="Aplicar ao rascunho"
          onConfirmar={aplicar}
        />
      }
    >
      <div className="dialogo-massa__corpo">
        <label className="painel-dia__campo painel-dia__campo--largo">
          <span>Novo turno</span>
          <select value={turnoId} onChange={(e) => setTurnoId(e.target.value)}>
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>
                {`${t.nome} · ${descricaoDoTurnoNoDia(t, de || inicio)}`}
              </option>
            ))}
          </select>
        </label>
        <div className="painel-dia__linha">
          <label className="painel-dia__campo">
            <span>De</span>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </label>
          <label className="painel-dia__campo">
            <span>Até</span>
            <input
              type="date"
              value={ate}
              min={de}
              max={de ? somarDias(de, DIAS_NA_TROCA - 1) : undefined}
              onChange={(e) => setAte(e.target.value)}
            />
          </label>
        </div>
        <fieldset className="dialogo-massa__grupo">
          <legend>Em quais dias</legend>
          <div className="dialogo-massa__dias">
            {LETRAS.map((d) => (
              <button
                key={d.n}
                type="button"
                aria-pressed={dias.has(d.n)}
                aria-label={d.nome}
                className="dialogo-massa__dia"
                onClick={() =>
                  setDias((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(d.n)) novo.delete(d.n);
                    else novo.add(d.n);
                    return novo;
                  })
                }
              >
                {d.letra}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="dialogo-massa__grupo">
          <legend>Folgas e DSR</legend>
          <label className="dialogo-massa__opcao">
            <input
              type="radio"
              name={`${id}-folgas`}
              checked={!tambemNasFolgas}
              onChange={() => setTambemNasFolgas(false)}
            />
            <span>
              <strong>Só onde já há turno</strong>
              <small>Folgas e DSR continuam onde estão.</small>
            </span>
          </label>
          <label className="dialogo-massa__opcao">
            <input
              type="radio"
              name={`${id}-folgas`}
              checked={tambemNasFolgas}
              onChange={() => setTambemNasFolgas(true)}
            />
            <span>
              <strong>Também nas folgas</strong>
              <small>Cuidado: pode deixar a pessoa sem descanso semanal.</small>
            </span>
          </label>
        </fieldset>
        <section
          aria-labelledby={`${id}-muda`}
          className="dialogo-massa__grupo"
        >
          <h3 id={`${id}-muda`} className="painel-dia__subtitulo">
            O que muda
          </h3>
          {!periodoValido ? (
            <p className="dialogo-massa__ajuda">
              {`Escolha um período de 1 a ${DIAS_NA_TROCA} dias.`}
            </p>
          ) : resultado ? (
            <ul className="dialogo-massa__lista">
              {resultado.mudancas.map((m) => (
                <li key={m.colaboradorId}>
                  <span>{m.nome}</span>
                  <span>{linha(m)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dialogo-massa__ajuda" role="status">
              Calculando…
            </p>
          )}
          <p className="dialogo-massa__ajuda">
            Quem não pode receber o turno fica de fora e aparece aqui. Nada é
            publicado agora.
          </p>
        </section>
        {erro ? (
          <p role="alert" className="painel-dia__erro">
            {erro}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** "Dar folga para N pessoa(s)". */
export function DialogoDarFolga({
  pessoas,
  diaInicial,
  onAplicar,
  onFechar,
}: {
  readonly pessoas: readonly PessoaDoQuadroApi[];
  readonly diaInicial: string;
  readonly onAplicar: (dia: string, tipo: "folga" | "dsr") => Promise<void>;
  readonly onFechar: () => void;
}) {
  const [dia, setDia] = useState(diaInicial);
  const [tipo, setTipo] = useState<"folga" | "dsr">("folga");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aplicar = async () => {
    if (!dia) {
      setErro("Escolha o dia.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onAplicar(dia, tipo);
    } catch {
      setErro(FALHA);
      setEnviando(false);
    }
  };
  return (
    <Dialog
      aberto
      titulo={`Dar folga para ${plural(pessoas.length, "pessoa", "pessoas")}`}
      descricao={`${pessoas.map((p) => p.nome).join(", ")}.`}
      onFechar={onFechar}
      bloqueado={enviando}
      className="dialogo-massa"
      rodape={
        <Rodape
          enviando={enviando}
          onFechar={onFechar}
          rotulo="Dar folga no rascunho"
          onConfirmar={aplicar}
        />
      }
    >
      <div className="dialogo-massa__corpo">
        <div className="painel-dia__linha">
          <label className="painel-dia__campo">
            <span>Dia</span>
            <input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </label>
          <label className="painel-dia__campo">
            <span>Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "folga" | "dsr")}
            >
              <option value="folga">Folga</option>
              <option value="dsr">DSR · Descanso semanal remunerado</option>
            </select>
          </label>
        </div>
        <p className="dialogo-massa__ajuda">
          Quem está fora do vínculo nesse dia não muda.
        </p>
        {erro ? (
          <p role="alert" className="painel-dia__erro">
            {erro}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Até um ano para a frente. */
export const SEMANAS_NA_REPETICAO = 52;

/** "Repetir esta semana". */
export function DialogoRepetir({
  fimDaSemana,
  onAplicar,
  onFechar,
}: {
  readonly fimDaSemana: string;
  readonly onAplicar: (ate: string) => Promise<void>;
  readonly onFechar: () => void;
}) {
  const [ate, setAte] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const minimo = somarDias(fimDaSemana, 1);
  const maximo = somarDias(fimDaSemana, SEMANAS_NA_REPETICAO * 7);
  const aplicar = async () => {
    if (!ate || ate < minimo || ate > maximo) {
      setErro("Escolha uma data depois desta semana, até um ano.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onAplicar(ate);
    } catch {
      setErro(FALHA);
      setEnviando(false);
    }
  };
  return (
    <Dialog
      aberto
      titulo="Repetir esta semana"
      descricao="Copia a semana para as semanas seguintes, até a data escolhida, para as pessoas do filtro. Vai para o rascunho."
      onFechar={onFechar}
      bloqueado={enviando}
      className="dialogo-massa"
      rodape={
        <Rodape
          enviando={enviando}
          onFechar={onFechar}
          rotulo="Repetir no rascunho"
          onConfirmar={aplicar}
        />
      }
    >
      <div className="dialogo-massa__corpo">
        <label className="painel-dia__campo">
          <span>Repetir até</span>
          <input
            type="date"
            value={ate}
            min={minimo}
            max={maximo}
            onChange={(e) => setAte(e.target.value)}
          />
        </label>
        {erro ? (
          <p role="alert" className="painel-dia__erro">
            {erro}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** "Limpar o rascunho do período". */
export function DialogoLimparRascunho({
  periodo,
  deQuem = "as pessoas do filtro",
  quantas,
  onConfirmar,
  onFechar,
}: {
  /** "23 a 29 de novembro de 2026". */
  readonly periodo: string;
  readonly quantas: number;
  /** De quem: "as pessoas do filtro" (padrão) ou "as pessoas selecionadas". */
  readonly deQuem?: string;
  readonly onConfirmar: () => Promise<void>;
  readonly onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch {
      setErro("Não foi possível limpar o rascunho. Tente de novo.");
      setEnviando(false);
    }
  };
  return (
    <Dialog
      aberto
      titulo="Limpar o rascunho do período"
      descricao={`Desfaz as mudanças não publicadas de ${periodo} para ${deQuem}. O que já foi publicado continua igual.`}
      onFechar={onFechar}
      bloqueado={enviando}
      className="dialogo-massa"
      rodape={
        <Rodape
          enviando={enviando}
          onFechar={onFechar}
          rotulo="Limpar rascunho"
          onConfirmar={confirmar}
          perigo
        />
      }
    >
      <p className="dialogo-massa__ajuda">
        {quantas === 1
          ? "1 mudança será desfeita."
          : `${quantas} mudanças serão desfeitas.`}
      </p>
      {erro ? (
        <p role="alert" className="painel-dia__erro">
          {erro}
        </p>
      ) : null}
    </Dialog>
  );
}
