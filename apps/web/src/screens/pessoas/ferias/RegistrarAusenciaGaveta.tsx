/**
 * T215 — gaveta "Registrar ausência", com as cinco perguntas da referência:
 * quem, o tipo, quando, se já está aprovada e a observação. O resumo (dias,
 * dias úteis, volta, saldo, período aquisitivo e venda de dias) vem do
 * servidor (`simular`): a regra mora num lugar só.
 *
 * Afastamento troca a terceira pergunta pelo motivo, deixa a volta em aberto
 * e não pergunta pela aprovação (entra registrado).
 *
 * Editar (`editando`), como a referência: a mesma janela, "Editar
 * ausência", com as respostas da ausência, a pessoa fixa e "Salvar
 * alterações" (só com alguma mudança). A simulação não conta a própria.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button, FormActions } from "../../../components";
import { Sheet } from "../../../ui";
import {
  IconeEnviarArquivo,
  IconeFechar,
  IconeRegistrarAusencia,
  IconeSucesso,
} from "../../../ui/icones";
import { ICONE_DO_TIPO } from "./aparenciaDoTipo";
import {
  anoDoDiaCivil,
  diaMesComZero,
  formatarDiaCivil,
  formatarIntervaloDeDias,
} from "../../../format/data";
import type {
  AvisoCltApi,
  ViolacaoDaPoliticaApi,
} from "../../../api/ausenciasClient";

/** T215 — o texto de cada ponto fora da política (como a referência). */
function textoDaViolacao(v: ViolacaoDaPoliticaApi, inicio: string): string {
  const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
  switch (v.regra) {
    case "antecedencia_minima":
      return `Pedido com ${dias(v.dias)} de antecedência; a política pede ${v.minimo}.`;
    case "antecedencia_maxima":
      return `Pedido com ${v.meses} ${v.meses === 1 ? "mês" : "meses"} de antecedência; a política aceita até ${v.maximo}.`;
    case "duracao_minima":
      return `${v.dias === 1 ? "1 dia corrido" : `${v.dias} dias corridos`}; a política pede pelo menos ${v.minimo} por período.`;
    case "duracao_maxima":
      return `${v.dias} dias corridos; a política aceita até ${v.maximo} por período.`;
    case "periodos_por_ano":
      return `Seria o ${v.ordem}º período; a política aceita até ${v.maximo}.`;
    case "periodo_maior":
      return `Nenhum período chegaria a ${v.minimo} dias; a política pede um com pelo menos ${v.minimo}.`;
    case "intervalo":
      return `${dias(v.dias)} desde as outras férias; a política pede ${v.minimo} entre um período e outro.`;
    case "inicio_antes_de_descanso":
      return `Início em ${diaMesComZero(inicio)}, nos 2 dias antes de ${v.antesDe === "domingo" ? "domingo" : "feriado"}; a política pede outro dia.`;
    case "inicio_no_descanso":
      return `Início num fim de semana ou feriado (${diaMesComZero(v.dia)}); a política pede outro dia.`;
    case "volta_na_sexta":
      return `Volta numa sexta-feira (${diaMesComZero(v.dia)}); a política pede outro dia.`;
    case "volta_na_vespera":
      return `Volta na véspera de feriado (${diaMesComZero(v.dia)}); a política pede outro dia.`;
    case "bloqueio":
      return `Encosta no bloqueio ${v.nome} (${diaMesComZero(v.inicio)} a ${diaMesComZero(v.fim)}).`;
    case "alem_do_saldo":
      return "Passa do saldo do período; a política não aceita.";
    case "equipe":
      return `${v.fora === 1 ? "1 pessoa" : `${v.fora} pessoas`} do mesmo departamento já ${v.fora === 1 ? "está" : "estão"} fora nessas datas; a política aceita até ${v.maximo}.`;
  }
}

/** T215 — o nome do período como a referência: "2025" ou "2025/2026". */
function nomeDoPeriodo(p: { readonly inicio: string; readonly fim: string }) {
  const de = anoDoDiaCivil(p.inicio);
  const ate = anoDoDiaCivil(p.fim);
  return de === ate ? ate : `${de}/${ate}`;
}

/** T215 — o texto de cada aviso das "Regras da CLT" (como a referência). */
function textoDoAvisoClt(a: AvisoCltApi, inicio: string): string {
  switch (a.regra) {
    case "inicio_antes_de_descanso":
      return a.antesDe === "domingo"
        ? `Início em ${diaMesComZero(inicio)}, nos 2 dias antes de domingo (CLT art. 134, § 3º).`
        : `Início em ${diaMesComZero(inicio)}, nos 2 dias antes do feriado de ${diaMesComZero(a.dia)} (CLT art. 134, § 3º).`;
    case "minimo_5":
      return `${a.dias === 1 ? "1 dia corrido" : `${a.dias} dias corridos`}; a lei pede pelo menos 5 por período (CLT art. 134, § 1º).`;
    case "ate_3_periodos":
      return `Seria o ${a.ordem}º período de férias deste período aquisitivo; a lei permite até 3 (CLT art. 134, § 1º).`;
    case "um_com_14":
      return "Nenhum período chegaria a 14 dias; a lei pede um com pelo menos 14 (CLT art. 134, § 1º).";
    case "pagamento_em_dobro":
      return `${plural(a.dias, "dia", "dias")} depois do prazo de gozo (${formatarDiaCivil(a.prazoGozo)}): pagamento em dobro (CLT art. 137).`;
  }
}
import {
  type AusenciaApi,
  type MotivoAfastamento,
  type PessoaParaAusencia,
  type ServicoDeAusencias,
  type SimulacaoDeAusencia,
  type TipoAusencia,
  MOTIVOS_DE_AFASTAMENTO,
  ROTULO_DO_TIPO,
  TIPOS_DE_AUSENCIA,
  TIPO_NA_FRASE,
} from "./tiposAusencia";
import "./FeriasEAusencias.css";
import { plural } from "../../../format/plural";

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return `${p[0]?.[0] ?? ""}${p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : ""}`.toUpperCase();
}

/** Recusa do servidor, na voz da tela (sem repetir valor). */
function mensagemDaRecusa(
  erro: unknown,
  nome: string,
  editando = false,
): string {
  const detalhe = erro as {
    status?: number;
    erros?: readonly { campo: string; motivo: string }[];
  };
  const motivo = detalhe.erros?.[0]?.motivo;
  switch (motivo) {
    case "sobreposicao":
      return `Já existe uma ausência de ${nome} nessas datas.`;
    case "saldo_insuficiente":
      return "Esses dias passam do saldo de férias do período.";
    case "venda_acima_do_limite":
      return "A venda passa do limite de dias deste período.";
    case "fim_antes_do_inicio":
      return "O último dia não pode ser antes do primeiro.";
    case "antes_da_admissao":
      return `A ausência não pode começar antes da admissão de ${nome}.`;
    case "fora_do_vinculo":
      return `Essas datas ficam fora do vínculo de ${nome} com a empresa.`;
    case "ferias_sem_periodo":
      return "A coletiva tiraria o período de férias já lançadas. Ajuste essas férias antes.";
    case "abaixo_das_ferias":
      return "O período ficaria com menos dias do que as férias já lançadas nele.";
    case "nao_se_aplica":
      return detalhe.erros?.[0]?.campo === "feriasColetivas"
        ? `${nome} não tem férias coletivas nessas datas (só com menos de 12 meses de casa).`
        : editando
          ? "Não foi possível salvar a ausência. Confira os dados e tente de novo."
          : "Não foi possível registrar a ausência. Confira os dados e tente de novo.";
    default:
      return editando
        ? "Não foi possível salvar a ausência. Confira os dados e tente de novo."
        : "Não foi possível registrar a ausência. Confira os dados e tente de novo.";
  }
}

/** As respostas de uma ausência gravada (para editar). */
function respostasDe(a: AusenciaApi) {
  return {
    tipo: a.tipo,
    motivo: a.motivoAfastamento,
    inicio: a.inicio,
    fim: a.fim ?? "",
    comVolta: a.fim !== null,
    vender: a.diasVendidos > 0,
    diasVendidos: a.diasVendidos > 0 ? String(a.diasVendidos) : "",
    aprovada: a.status === "aprovada" || a.status === "cancelamento_pedido",
    observacao: a.observacao ?? "",
    coletiva: a.feriasColetivas === true,
    motivoFora: a.motivoForaDaPolitica ?? "",
  };
}

/** T215 — o anexo (atestado ou documento): os formatos da referência. */
export const FORMATOS_DO_ANEXO =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.heic,.heif";
const EXTENSOES_DO_ANEXO = new Set(
  FORMATOS_DO_ANEXO.split(",").map((e) => e.slice(1)),
);
export const LIMITE_DO_ANEXO_BYTES = 10 * 1024 * 1024;

/** Conferência na hora da escolha (o servidor confere de novo, a fundo). */
export function recusaDoArquivo(arquivo: File): string | null {
  const ponto = arquivo.name.lastIndexOf(".");
  const extensao = ponto < 0 ? "" : arquivo.name.slice(ponto + 1).toLowerCase();
  if (!EXTENSOES_DO_ANEXO.has(extensao)) {
    return "Use PDF, JPG, PNG, WEBP, HEIC, DOC ou DOCX.";
  }
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > LIMITE_DO_ANEXO_BYTES) return "O arquivo passa de 10 MB.";
  return null;
}

/** A recusa do anexo pelo servidor, na voz da tela. */
export function motivoDoAnexo(erro: unknown): string {
  const codigo = (erro as { codigo?: string }).codigo;
  switch (codigo) {
    case "anexo_reprovado_antivirus":
      return "o antivírus recusou o arquivo";
    case "anexo_com_macro":
      return "documentos com macro não são aceitos";
    case "anexo_formato_invalido":
    case "anexo_arquivo_malformado":
      return "o arquivo não é um PDF, imagem ou documento válido";
    case "anexo_arquivo_grande_demais":
      return "o arquivo passa de 10 MB";
    case "anexo_verificacao_indisponivel":
    case "anexo_armazenamento_indisponivel":
      return "o serviço de arquivos está indisponível agora";
    default:
      return "não foi possível enviar o arquivo";
  }
}

/** "1,2 MB" / "350 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function RegistrarAusenciaGaveta({
  aberta,
  servico,
  onFechar,
  onRegistrada,
  pessoaInicial,
  tipoInicial,
  regraDeFerias: regraDaFicha,
  editando = null,
  onAlterada,
}: {
  readonly aberta: boolean;
  readonly servico: ServicoDeAusencias;
  readonly onFechar: () => void;
  /** O segundo argumento é o aviso quando o anexo não pôde ir. */
  readonly onRegistrada: (ausencia: AusenciaApi, aviso?: string) => void;
  /** Da ficha: a pessoa já vem escolhida. */
  readonly pessoaInicial?: PessoaParaAusencia;
  /** Da ficha: a regra de férias do vínculo já é conhecida. */
  readonly regraDeFerias?: "calculada" | "sem_ferias" | "sem_regra";
  /** O tipo já escolhido ao abrir ("Agendar férias" do saldo). */
  readonly tipoInicial?: TipoAusencia;
  /** Editar esta ausência (a pessoa não muda). */
  readonly editando?: AusenciaApi | null;
  readonly onAlterada?: (ausencia: AusenciaApi, aviso?: string) => void;
}) {
  const base = useId();
  const [pessoa, setPessoa] = useState<PessoaParaAusencia | null>(
    pessoaInicial ?? null,
  );
  const [escolhendo, setEscolhendo] = useState(false);
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<readonly PessoaParaAusencia[]>([]);
  const [tipo, setTipo] = useState<TipoAusencia | null>(null);
  const [motivo, setMotivo] = useState<MotivoAfastamento | null>(null);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [comVolta, setComVolta] = useState(false);
  const [vender, setVender] = useState(false);
  const [diasVendidos, setDiasVendidos] = useState("");
  const [aprovada, setAprovada] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [simulacao, setSimulacao] = useState<SimulacaoDeAusencia | null>(null);
  // "trocar": o período de que as férias descontam (nulo = automático).
  const [periodoEscolhido, setPeriodoEscolhido] = useState<string | null>(null);
  const [trocandoPeriodo, setTrocandoPeriodo] = useState(false);
  // "São férias coletivas?" (menos de 12 meses de casa, art. 140).
  const [coletiva, setColetiva] = useState(false);
  // Fora da política: o porquê (obrigatório para registrar mesmo assim).
  const [motivoFora, setMotivoFora] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [recusaDoAnexo, setRecusaDoAnexo] = useState<string | null>(null);
  const campoBuscaRef = useRef<HTMLInputElement | null>(null);
  const campoArquivoRef = useRef<HTMLInputElement | null>(null);

  // Abrir de novo começa do zero (ou, editando, das respostas gravadas).
  useEffect(() => {
    if (!aberta) return;
    const r = editando ? respostasDe(editando) : null;
    setPessoa(
      editando
        ? {
            id: editando.colaborador.id,
            nome: editando.colaborador.nome,
            cargo: editando.colaborador.cargo,
          }
        : (pessoaInicial ?? null),
    );
    setEscolhendo(false);
    setTermo("");
    setTipo(r?.tipo ?? tipoInicial ?? null);
    setMotivo(r?.motivo ?? null);
    setInicio(r?.inicio ?? "");
    setPeriodoEscolhido(null);
    setTrocandoPeriodo(false);
    setColetiva(r?.coletiva ?? false);
    setMotivoFora(r?.motivoFora ?? "");
    setFim(r?.fim ?? "");
    setComVolta(r?.comVolta ?? false);
    setVender(r?.vender ?? false);
    setDiasVendidos(r?.diasVendidos ?? "");
    setAprovada(r?.aprovada ?? true);
    setObservacao(r?.observacao ?? "");
    setSimulacao(null);
    setFalha(null);
    setArquivo(null);
    setRecusaDoAnexo(null);
  }, [aberta, pessoaInicial, editando, tipoInicial]);

  // A lista de pessoas, pela busca.
  useEffect(() => {
    if (!escolhendo) return;
    const controle = new AbortController();
    const espera = window.setTimeout(() => {
      servico
        .buscarPessoas(termo.trim(), { signal: controle.signal })
        .then(setOpcoes)
        .catch(() => setOpcoes([]));
    }, 200);
    return () => {
      window.clearTimeout(espera);
      controle.abort();
    };
  }, [escolhendo, termo, servico]);

  useEffect(() => {
    if (escolhendo) campoBuscaRef.current?.focus();
  }, [escolhendo]);

  const afastamento = tipo === "afastamento";
  const ferias = tipo === "ferias";
  // A regra de férias: da ficha, ou a que o servidor disse na simulação.
  const regra = regraDaFicha ?? simulacao?.regraDeFerias ?? null;
  const semFerias = regra === "sem_ferias";
  const semRegra = regra === "sem_regra";
  const fimEfetivo = afastamento && !comVolta ? "" : fim;
  const vendidos = ferias && vender ? Number(diasVendidos) || 0 : 0;

  // O resumo: o servidor calcula dias, dias úteis, volta e saldo.
  useEffect(() => {
    setSimulacao(null);
    if (!pessoa || !tipo || !inicio || !fimEfetivo || fimEfetivo < inicio) {
      return;
    }
    const controle = new AbortController();
    const espera = window.setTimeout(() => {
      servico
        .simular(
          {
            colaboradorId: pessoa.id,
            tipo,
            inicio,
            fim: fimEfetivo,
            ...(vendidos > 0 ? { diasVendidos: vendidos } : {}),
            ...(editando ? { ignorar: editando.id } : {}),
            ...(periodoEscolhido
              ? { periodoAquisitivoInicio: periodoEscolhido }
              : {}),
            ...(coletiva ? { feriasColetivas: true } : {}),
          },
          { signal: controle.signal },
        )
        .then(setSimulacao)
        .catch(() => setSimulacao(null));
    }, 250);
    return () => {
      window.clearTimeout(espera);
      controle.abort();
    };
  }, [
    pessoa,
    tipo,
    inicio,
    fimEfetivo,
    vendidos,
    servico,
    editando,
    periodoEscolhido,
    coletiva,
  ]);

  // A CLT não deixa passar do saldo (o servidor recusa): a gaveta avisa antes
  // e trava o registro. Aí a política não entra — não há "mesmo assim".
  const estouraSaldo =
    ferias &&
    simulacao?.saldoDepois !== null &&
    simulacao?.saldoDepois !== undefined &&
    simulacao.saldoDepois < 0;
  // Como a referência: fora da política, registra mesmo assim com o motivo.
  const foraDaPolitica =
    ferias && !estouraSaldo && (simulacao?.politica?.violacoes.length ?? 0) > 0;
  const completo =
    pessoa !== null &&
    tipo !== null &&
    !(ferias && semFerias) &&
    inicio !== "" &&
    (afastamento
      ? motivo !== null && (!comVolta || (fim !== "" && fim >= inicio))
      : fim !== "" && fim >= inicio) &&
    !estouraSaldo &&
    (!foraDaPolitica || motivoFora.trim() !== "");

  // Editando: só salva com alguma resposta diferente da gravada.
  const original = editando ? respostasDe(editando) : null;
  const mudou =
    original === null ||
    original.tipo !== tipo ||
    original.motivo !== motivo ||
    original.inicio !== inicio ||
    original.fim !== fimEfetivo ||
    original.diasVendidos !== (vendidos > 0 ? String(vendidos) : "") ||
    original.aprovada !== aprovada ||
    original.observacao !== observacao.trim() ||
    original.coletiva !== coletiva ||
    original.motivoFora !== motivoFora.trim() ||
    arquivo !== null;

  async function registrar() {
    if (!completo || !mudou || !pessoa || !tipo || enviando) return;
    setEnviando(true);
    setFalha(null);
    const periodoDasFerias =
      simulacao?.periodo?.inicio ?? editando?.periodoAquisitivo?.inicio;
    const respostas = {
      tipo,
      ...(afastamento && motivo ? { motivoAfastamento: motivo } : {}),
      inicio,
      ...(fimEfetivo ? { fim: fimEfetivo } : {}),
      ...(vendidos > 0 ? { diasVendidos: vendidos } : {}),
      ...(ferias && periodoDasFerias
        ? { periodoAquisitivoInicio: periodoDasFerias }
        : {}),
      aprovada: afastamento ? true : aprovada,
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      ...(ferias && coletivaValida ? { feriasColetivas: true } : {}),
      ...(foraDaPolitica ? { motivoForaDaPolitica: motivoFora.trim() } : {}),
    };
    try {
      const nova =
        editando && servico.alterar
          ? await servico.alterar(editando.id, respostas)
          : await servico.registrar({ colaboradorId: pessoa.id, ...respostas });
      // O anexo vai depois do registro; se falhar, a ausência fica.
      let aviso: string | undefined;
      if (arquivo && servico.enviarAnexo) {
        try {
          await servico.enviarAnexo(nova.id, arquivo);
        } catch (erro) {
          aviso = `${editando ? "Ausência alterada" : "Ausência registrada"}, mas o anexo não foi enviado: ${motivoDoAnexo(
            erro,
          )}. Anexe outro arquivo pelo histórico.`;
        }
      }
      if (editando) onAlterada?.(nova, aviso);
      else onRegistrada(nova, aviso);
    } catch (erro) {
      setFalha(
        mensagemDaRecusa(erro, primeiroNome(pessoa.nome), editando !== null),
      );
    } finally {
      setEnviando(false);
    }
  }

  const alterado = editando
    ? mudou
    : pessoa !== null || tipo !== null || inicio !== "";
  const nome = pessoa ? primeiroNome(pessoa.nome) : "";
  const ano = simulacao?.periodo ? nomeDoPeriodo(simulacao.periodo) : null;
  // A coletiva só vale enquanto o servidor diz que cabe.
  const coletivaValida = coletiva && simulacao?.podeSerColetiva === true;
  // Venda: o que ainda dá para vender no período (o servidor desconta o
  // que as outras férias do mesmo período já venderam).
  const podeVender = simulacao?.maxVendaveis ?? 10;
  const jaVendidos = simulacao?.vendidosNoPeriodo ?? 0;

  return (
    <Sheet
      aberto={aberta}
      titulo={editando ? "Editar ausência" : "Registrar ausência"}
      subtitulo="Responda as perguntas abaixo."
      icone={<IconeRegistrarAusencia tamanho={20} />}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      className="ausencias-gaveta"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!completo || !mudou || enviando}
            onClick={() => void registrar()}
          >
            {editando
              ? enviando
                ? "Salvando…"
                : "Salvar alterações"
              : enviando
                ? "Registrando…"
                : foraDaPolitica
                  ? "Registrar mesmo assim"
                  : "Registrar ausência"}
          </Button>
        </FormActions>
      }
    >
      <ol className="ausencias-gaveta__perguntas">
        {/* 1 — quem */}
        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo">Quem vai se ausentar?</h3>
          {pessoa && !escolhendo ? (
            <div className="ausencias-gaveta__pessoa">
              <span className="ausencias-gaveta__avatar" aria-hidden="true">
                {iniciais(pessoa.nome)}
              </span>
              <span className="ausencias-gaveta__pessoa-texto">
                <span className="ausencias-gaveta__pessoa-nome">
                  {pessoa.nome}
                </span>
                {pessoa.cargo ? (
                  <span className="ausencias-gaveta__ajuda">
                    {pessoa.cargo}
                  </span>
                ) : null}
              </span>
              {editando ? null : (
                <button
                  type="button"
                  className="ausencias-gaveta__link"
                  onClick={() => setEscolhendo(true)}
                >
                  Trocar
                </button>
              )}
            </div>
          ) : escolhendo ? (
            <div className="ausencias-gaveta__escolha">
              <input
                ref={campoBuscaRef}
                type="search"
                className="ausencias-gaveta__campo"
                placeholder="Buscar por nome ou cargo"
                aria-label="Buscar por nome ou cargo"
                aria-controls={`${base}-pessoas`}
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
              <ul
                id={`${base}-pessoas`}
                role="listbox"
                aria-label="Colaboradores"
                className="ausencias-gaveta__lista"
              >
                {opcoes.map((o) => (
                  <li
                    key={o.id}
                    role="option"
                    aria-selected={pessoa?.id === o.id}
                    tabIndex={0}
                    className="ausencias-gaveta__opcao-pessoa"
                    onClick={() => {
                      setPessoa(o);
                      setEscolhendo(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPessoa(o);
                        setEscolhendo(false);
                      }
                    }}
                  >
                    <span
                      className="ausencias-gaveta__avatar"
                      aria-hidden="true"
                    >
                      {iniciais(o.nome)}
                    </span>
                    <span className="ausencias-gaveta__pessoa-texto">
                      <span className="ausencias-gaveta__pessoa-nome">
                        {o.nome}
                      </span>
                      <span className="ausencias-gaveta__ajuda">
                        {o.cargo ?? "Sem cargo"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button
              type="button"
              className="ausencias-gaveta__escolher"
              onClick={() => setEscolhendo(true)}
            >
              Escolher colaborador
            </button>
          )}
        </li>

        {/* 2 — tipo */}
        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo" id={`${base}-tipo`}>
            Qual o tipo de ausência?
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={`${base}-tipo`}
            className="ausencias-gaveta__tipos"
          >
            {TIPOS_DE_AUSENCIA.map((t) => {
              const Icone = ICONE_DO_TIPO[t];
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  aria-disabled={t === "ferias" && semFerias ? true : undefined}
                  className="ausencias-gaveta__tipo"
                  onClick={() => {
                    if (t === "ferias" && semFerias) return;
                    setTipo(t);
                    if (t !== "ferias") setVender(false);
                  }}
                >
                  <span
                    className="ausencias-gaveta__tipo-icone"
                    aria-hidden="true"
                  >
                    <Icone tamanho={18} />
                  </span>
                  <span className="ausencias-gaveta__tipo-rotulo">
                    {ROTULO_DO_TIPO[t]}
                  </span>
                  {tipo === t ? (
                    <span
                      className="ausencias-gaveta__visto"
                      aria-hidden="true"
                    >
                      <IconeSucesso tamanho={20} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {semFerias ? (
            <p className="ausencias-gaveta__ajuda" role="note">
              Este contrato não tem férias (PJ e Freelancer).
            </p>
          ) : null}
        </li>

        {/* 3 — motivo (afastamento) */}
        {afastamento ? (
          <li className="ausencias-gaveta__pergunta">
            <h3 className="ausencias-gaveta__titulo" id={`${base}-motivo`}>
              Qual o motivo do afastamento?
            </h3>
            <div
              role="radiogroup"
              aria-labelledby={`${base}-motivo`}
              className="ausencias-gaveta__escolhas"
            >
              {MOTIVOS_DE_AFASTAMENTO.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  role="radio"
                  aria-checked={motivo === m.valor}
                  className="ausencias-gaveta__escolha-opcao"
                  onClick={() => setMotivo(m.valor)}
                >
                  <span className="ausencias-gaveta__escolha-titulo">
                    {m.rotulo}
                  </span>
                  <span className="ausencias-gaveta__ajuda">{m.ajuda}</span>
                </button>
              ))}
            </div>
          </li>
        ) : null}

        {/* 3/4 — quando */}
        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo">Quando?</h3>
          <div className="ausencias-gaveta__datas">
            <label className="ausencias-gaveta__data">
              <span>Primeiro dia</span>
              <input
                type="date"
                className="ausencias-gaveta__campo"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            {!afastamento ? (
              <label className="ausencias-gaveta__data">
                <span>Último dia</span>
                <input
                  type="date"
                  className="ausencias-gaveta__campo"
                  min={inicio || undefined}
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
            ) : null}
          </div>
          {afastamento ? (
            <div
              role="radiogroup"
              aria-label="Volta ao trabalho"
              className="ausencias-gaveta__escolhas ausencias-gaveta__escolhas--dupla"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!comVolta}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => setComVolta(false)}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  Sem data de volta
                </span>
                <span className="ausencias-gaveta__ajuda">
                  Fica em aberto até você registrar a volta
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={comVolta}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => setComVolta(true)}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  Já tem data de volta
                </span>
                <span className="ausencias-gaveta__ajuda">
                  Informe o dia em que volta ao trabalho
                </span>
              </button>
            </div>
          ) : null}
          {afastamento && comVolta ? (
            <label className="ausencias-gaveta__data">
              <span>Último dia</span>
              <input
                type="date"
                className="ausencias-gaveta__campo"
                min={inicio || undefined}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
          ) : null}

          {simulacao &&
          tipo &&
          simulacao.dias !== null &&
          simulacao.volta !== null ? (
            <div className="ausencias-gaveta__resumo" role="status">
              <p className="ausencias-gaveta__resumo-titulo">
                {`${plural(simulacao.dias, "dia", "dias")} de ${TIPO_NA_FRASE[tipo]} (${plural(simulacao.diasUteis ?? 0, "dia útil", "dias úteis")})${
                  vendidos > 0
                    ? ` + ${plural(vendidos, "vendido", "vendidos")}`
                    : ""
                }`}
              </p>
              <p className="ausencias-gaveta__ajuda">
                {`Volta ao trabalho em ${formatarDiaCivil(simulacao.volta ?? "")}${
                  ferias && simulacao.saldoDepois !== null
                    ? simulacao.saldoDepois < 0
                      ? ` · passa ${plural(-simulacao.saldoDepois, "dia", "dias")} do saldo`
                      : ` · ${simulacao.saldoDepois === 1 ? "resta" : "restam"} ${plural(simulacao.saldoDepois, "dia", "dias")} de saldo`
                    : ""
                }`}
              </p>
              {ferias && ano ? (
                <p className="ausencias-gaveta__ajuda">
                  <span>
                    {`Desconta do período ${ano} (${periodoEscolhido ? "escolhido" : "automático"})`}
                  </span>
                  {(simulacao.periodosDisponiveis?.length ?? 0) > 1 ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="ausencias-gaveta__link"
                        aria-expanded={trocandoPeriodo}
                        onClick={() => setTrocandoPeriodo((v) => !v)}
                      >
                        trocar
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
              {ferias && trocandoPeriodo && simulacao.periodosDisponiveis ? (
                <div
                  role="radiogroup"
                  aria-label="De que período descontar"
                  className="ausencias-gaveta__escolhas"
                >
                  {simulacao.periodosDisponiveis.map((p) => (
                    <button
                      key={p.inicio}
                      type="button"
                      role="radio"
                      aria-checked={simulacao.periodo?.inicio === p.inicio}
                      className="ausencias-gaveta__escolha-opcao"
                      onClick={() => {
                        setPeriodoEscolhido(p.inicio);
                        setTrocandoPeriodo(false);
                      }}
                    >
                      {`Período ${nomeDoPeriodo(p)} · ${formatarIntervaloDeDias(p.inicio, p.fim)} · ${plural(p.disponiveis, "dia", "dias")}`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {ferias && simulacao?.avisosClt && simulacao.avisosClt.length > 0 ? (
            <div
              className="ausencias-gaveta__clt"
              role="note"
              aria-labelledby={`${base}-clt`}
            >
              <p className="ausencias-gaveta__clt-titulo" id={`${base}-clt`}>
                Regras da CLT
              </p>
              <ul>
                {simulacao.avisosClt.map((a) => (
                  <li key={`${a.regra}-${"dia" in a ? a.dia : ""}`}>
                    {textoDoAvisoClt(a, inicio)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {estouraSaldo ? (
            <p className="ausencias-gaveta__falha" role="alert">
              Esses dias passam do saldo de férias do período. Escolha menos
              dias.
            </p>
          ) : null}

          {foraDaPolitica && simulacao?.politica ? (
            <div
              className="ausencias-gaveta__clt"
              role="note"
              aria-labelledby={`${base}-fora`}
            >
              <p className="ausencias-gaveta__clt-titulo" id={`${base}-fora`}>
                {`Fora da política ${simulacao.politica.nome}`}
              </p>
              <ul>
                {simulacao.politica.violacoes.map((v, i) => (
                  <li key={`${v.regra}-${i}`}>{textoDaViolacao(v, inicio)}</li>
                ))}
              </ul>
              <p className="ausencias-gaveta__ajuda">
                Dá para registrar mesmo assim, com o motivo abaixo.
              </p>
            </div>
          ) : null}

          {ferias && semRegra ? (
            <p className="ausencias-gaveta__ajuda" role="note">
              Contrato sem regra automática de férias: o saldo não é calculado.
              Confira os dias antes de registrar.
            </p>
          ) : null}

          {ferias && !semRegra && !semFerias ? (
            <>
              {simulacao?.podeSerColetiva ? (
                <div className="ausencias-gaveta__venda">
                  <div className="ausencias-gaveta__venda-cabeca">
                    <span className="ausencias-gaveta__venda-texto">
                      <span
                        className="ausencias-gaveta__escolha-titulo"
                        id={`${base}-coletiva`}
                      >
                        São férias coletivas?
                      </span>
                      <span className="ausencias-gaveta__ajuda">
                        {coletiva && simulacao.coletiva
                          ? `Pela CLT (art. 140), ${nome || "a pessoa"} tira ${plural(simulacao.coletiva.dias, "dia", "dias")} proporcionais e começa um novo período aquisitivo em ${formatarDiaCivil(simulacao.coletiva.novoPeriodo)}.`
                          : `${nome || "A pessoa"} tem menos de 12 meses de casa. Na coletiva, a CLT (art. 140) dá férias proporcionais e recomeça o período aquisitivo.`}
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={coletiva}
                      aria-labelledby={`${base}-coletiva`}
                      className="ausencias-gaveta__interruptor"
                      onClick={() => setColetiva((v) => !v)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
              {simulacao?.maxVendaveis === 0 &&
              (simulacao.vendidosNoPeriodo ?? 0) > 0 ? (
                <p className="ausencias-gaveta__ajuda" role="note">
                  {`A venda deste período já chegou ao limite: ${plural(
                    simulacao.vendidosNoPeriodo ?? 0,
                    "dia vendido",
                    "dias vendidos",
                  )}.`}
                </p>
              ) : null}
              {(simulacao?.maxVendaveis ?? 10) > 0 ? (
                <div className="ausencias-gaveta__venda">
                  <div className="ausencias-gaveta__venda-cabeca">
                    <span className="ausencias-gaveta__venda-texto">
                      <span
                        className="ausencias-gaveta__escolha-titulo"
                        id={`${base}-vender`}
                      >
                        Vender dias destas férias?
                      </span>
                      <span className="ausencias-gaveta__ajuda">
                        {`Abono pecuniário: ${nome || "a pessoa"} pode trocar até ${plural(
                          podeVender,
                          "dia",
                          "dias",
                        )} por dinheiro (CLT art. 143, 1/3 das férias).${
                          jaVendidos > 0
                            ? ` Já ${jaVendidos === 1 ? "foi vendido" : "foram vendidos"} ${plural(jaVendidos, "dia", "dias")} neste período.`
                            : ""
                        }`}
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vender}
                      aria-labelledby={`${base}-vender`}
                      className="ausencias-gaveta__interruptor"
                      onClick={() => setVender((v) => !v)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                  {vender ? (
                    <div className="ausencias-gaveta__venda-corpo">
                      <label className="ausencias-gaveta__data">
                        <span>Dias vendidos</span>
                        <input
                          type="number"
                          min={1}
                          max={podeVender}
                          className="ausencias-gaveta__campo"
                          value={diasVendidos}
                          onChange={(e) => setDiasVendidos(e.target.value)}
                        />
                      </label>
                      <p className="ausencias-gaveta__ajuda">
                        {`Pela CLT, dá para vender até ${plural(
                          podeVender,
                          "dia",
                          "dias",
                        )} deste período (1/3 do direito${
                          jaVendidos > 0
                            ? `, menos ${plural(jaVendidos, "dia", "dias")} já ${jaVendidos === 1 ? "vendido" : "vendidos"}`
                            : ""
                        }).`}
                      </p>
                      {simulacao?.prazoAbono ? (
                        <p className="ausencias-gaveta__ajuda">
                          {`Se ${nome} pedir até ${formatarDiaCivil(
                            simulacao.prazoAbono,
                          )}, a empresa não pode negar (CLT art. 143, § 1º). Férias e abono são pagos até 2 dias antes do início (art. 145).`}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </li>

        {/* 4 — aprovação (não para afastamento) */}
        {!afastamento ? (
          <li className="ausencias-gaveta__pergunta">
            <h3 className="ausencias-gaveta__titulo" id={`${base}-aprovada`}>
              Essa ausência já está aprovada?
            </h3>
            <div
              role="radiogroup"
              aria-labelledby={`${base}-aprovada`}
              className="ausencias-gaveta__escolhas ausencias-gaveta__escolhas--dupla"
            >
              <button
                type="button"
                role="radio"
                aria-checked={aprovada}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => setAprovada(true)}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  Sim, já aprovada
                </span>
                <span className="ausencias-gaveta__ajuda">
                  Entra direto no calendário
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!aprovada}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => setAprovada(false)}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  Ainda não
                </span>
                <span className="ausencias-gaveta__ajuda">
                  Fica aguardando aprovação
                </span>
              </button>
            </div>
          </li>
        ) : null}

        {/* Fora da política: o porquê, antes da observação */}
        {foraDaPolitica ? (
          <li className="ausencias-gaveta__pergunta">
            <h3 className="ausencias-gaveta__titulo">
              Por que registrar fora da política?{" "}
              <span className="ausencias-gaveta__opcional">Obrigatório</span>
            </h3>
            <textarea
              className="ausencias-gaveta__campo ausencias-gaveta__observacao"
              aria-label="Por que registrar fora da política?"
              maxLength={500}
              value={motivoFora}
              onChange={(e) => setMotivoFora(e.target.value)}
            />
          </li>
        ) : null}

        {/* 5 — observação */}
        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo">
            Quer deixar uma observação?{" "}
            <span className="ausencias-gaveta__opcional">Opcional</span>
          </h3>
          <textarea
            className="ausencias-gaveta__campo ausencias-gaveta__observacao"
            aria-label="Observação"
            placeholder="Ex.: viagem em família"
            maxLength={1000}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          {servico.enviarAnexo ? (
            <div className="ausencias-gaveta__anexo">
              <input
                ref={campoArquivoRef}
                type="file"
                hidden
                accept={FORMATOS_DO_ANEXO}
                aria-label="Arquivo do atestado ou documento"
                onChange={(e) => {
                  const escolhido = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!escolhido) return;
                  const recusa = recusaDoArquivo(escolhido);
                  setRecusaDoAnexo(recusa);
                  setArquivo(recusa ? null : escolhido);
                }}
              />
              {arquivo ? (
                <span className="ausencias-gaveta__arquivo">
                  <span className="ausencias-gaveta__arquivo-nome">
                    {arquivo.name}
                  </span>
                  <span className="ausencias-gaveta__ajuda">
                    {tamanhoLegivel(arquivo.size)}
                  </span>
                  <button
                    type="button"
                    className="ausencias-gaveta__arquivo-tirar"
                    aria-label={`Tirar o arquivo ${arquivo.name}`}
                    onClick={() => setArquivo(null)}
                  >
                    <IconeFechar tamanho={14} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="ausencias-gaveta__anexar"
                  onClick={() => campoArquivoRef.current?.click()}
                >
                  <IconeEnviarArquivo tamanho={16} />
                  Anexar atestado ou documento
                </button>
              )}
              {recusaDoAnexo ? (
                <p className="ausencias-gaveta__falha" role="alert">
                  {recusaDoAnexo}
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      </ol>
      {falha ? (
        <p className="ausencias-gaveta__falha" role="alert">
          {falha}
        </p>
      ) : null}
    </Sheet>
  );
}
