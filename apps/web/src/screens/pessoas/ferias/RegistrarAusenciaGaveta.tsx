/**
 * T215 — gaveta "Registrar ausência", com as cinco perguntas da referência:
 * quem, o tipo, quando, se já está aprovada e a observação. O resumo (dias,
 * dias úteis, volta, saldo, período aquisitivo e venda de dias) vem do
 * servidor (`simular`): a regra mora num lugar só.
 *
 * Afastamento troca a terceira pergunta pelo motivo, deixa a volta em aberto
 * e não pergunta pela aprovação (entra registrado).
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
import { anoDoDiaCivil, formatarDiaCivil } from "../../../format/data";
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
function mensagemDaRecusa(erro: unknown, nome: string): string {
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
    default:
      return "Não foi possível registrar a ausência. Confira os dados e tente de novo.";
  }
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
  regraDeFerias: regraDaFicha,
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
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [recusaDoAnexo, setRecusaDoAnexo] = useState<string | null>(null);
  const campoBuscaRef = useRef<HTMLInputElement | null>(null);
  const campoArquivoRef = useRef<HTMLInputElement | null>(null);

  // Abrir de novo começa do zero.
  useEffect(() => {
    if (!aberta) return;
    setPessoa(pessoaInicial ?? null);
    setEscolhendo(false);
    setTermo("");
    setTipo(null);
    setMotivo(null);
    setInicio("");
    setFim("");
    setComVolta(false);
    setVender(false);
    setDiasVendidos("");
    setAprovada(true);
    setObservacao("");
    setSimulacao(null);
    setFalha(null);
    setArquivo(null);
    setRecusaDoAnexo(null);
  }, [aberta, pessoaInicial]);

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
  }, [pessoa, tipo, inicio, fimEfetivo, vendidos, servico]);

  const completo =
    pessoa !== null &&
    tipo !== null &&
    !(ferias && semFerias) &&
    inicio !== "" &&
    (afastamento
      ? motivo !== null && (!comVolta || (fim !== "" && fim >= inicio))
      : fim !== "" && fim >= inicio);

  async function registrar() {
    if (!completo || !pessoa || !tipo || enviando) return;
    setEnviando(true);
    setFalha(null);
    try {
      const nova = await servico.registrar({
        colaboradorId: pessoa.id,
        tipo,
        ...(afastamento && motivo ? { motivoAfastamento: motivo } : {}),
        inicio,
        ...(fimEfetivo ? { fim: fimEfetivo } : {}),
        ...(vendidos > 0 ? { diasVendidos: vendidos } : {}),
        ...(ferias && simulacao?.periodo
          ? { periodoAquisitivoInicio: simulacao.periodo.inicio }
          : {}),
        aprovada: afastamento ? true : aprovada,
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      });
      // O anexo vai depois do registro; se falhar, a ausência fica.
      let aviso: string | undefined;
      if (arquivo && servico.enviarAnexo) {
        try {
          await servico.enviarAnexo(nova.id, arquivo);
        } catch (erro) {
          aviso = `Ausência registrada, mas o anexo não foi enviado: ${motivoDoAnexo(
            erro,
          )}. Anexe outro arquivo pelo histórico.`;
        }
      }
      onRegistrada(nova, aviso);
    } catch (erro) {
      setFalha(mensagemDaRecusa(erro, primeiroNome(pessoa.nome)));
    } finally {
      setEnviando(false);
    }
  }

  const alterado = pessoa !== null || tipo !== null || inicio !== "";
  const nome = pessoa ? primeiroNome(pessoa.nome) : "";
  const ano = simulacao?.periodo ? anoDoDiaCivil(simulacao.periodo.fim) : null;

  return (
    <Sheet
      aberto={aberta}
      titulo="Registrar ausência"
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
            disabled={!completo || enviando}
            onClick={() => void registrar()}
          >
            {enviando ? "Registrando…" : "Registrar ausência"}
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
              <button
                type="button"
                className="ausencias-gaveta__link"
                onClick={() => setEscolhendo(true)}
              >
                Trocar
              </button>
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
                {`${simulacao.dias === 1 ? "1 dia" : `${simulacao.dias} dias`} de ${TIPO_NA_FRASE[tipo]} (${simulacao.diasUteis === 1 ? "1 dia útil" : `${simulacao.diasUteis} dias úteis`})${
                  vendidos > 0 ? ` + ${vendidos} vendidos` : ""
                }`}
              </p>
              <p className="ausencias-gaveta__ajuda">
                {`Volta ao trabalho em ${formatarDiaCivil(simulacao.volta ?? "")}${
                  ferias && simulacao.saldoDepois !== null
                    ? ` · ${simulacao.saldoDepois === 1 ? "resta" : "restam"} ${plural(simulacao.saldoDepois, "dia", "dias")} de saldo`
                    : ""
                }`}
              </p>
              {ferias && ano ? (
                <p className="ausencias-gaveta__ajuda">
                  {`Desconta do período ${ano} (automático)`}
                </p>
              ) : null}
            </div>
          ) : null}

          {ferias && semRegra ? (
            <p className="ausencias-gaveta__ajuda" role="note">
              Contrato sem regra automática de férias: o saldo não é calculado.
              Confira os dias antes de registrar.
            </p>
          ) : null}

          {ferias && !semRegra && !semFerias ? (
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
                    {`Abono pecuniário: ${nome || "a pessoa"} pode trocar até ${
                      simulacao?.maxVendaveis ?? 10
                    } dias por dinheiro (CLT art. 143, 1/3 das férias).`}
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
                      max={simulacao?.maxVendaveis ?? 10}
                      className="ausencias-gaveta__campo"
                      value={diasVendidos}
                      onChange={(e) => setDiasVendidos(e.target.value)}
                    />
                  </label>
                  <p className="ausencias-gaveta__ajuda">
                    {`Pela CLT, dá para vender até ${
                      simulacao?.maxVendaveis ?? 10
                    } dias deste período (1/3 do direito).`}
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
