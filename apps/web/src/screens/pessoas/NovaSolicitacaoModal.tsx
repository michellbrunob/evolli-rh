/**
 * T204 — "Nova solicitação" na aba Solicitações da ficha do colaborador.
 *
 * Janela do Evolli (`Modal`: foco preso, Escape seguro, descarte com
 * confirmação e registro na guarda de saída da T200) em dois passos:
 *
 * 1. **Formulário:** tipo, vínculo, motivo e dia de referência opcional.
 *    - vínculos: todos os da pessoa na empresa ativa, o principal
 *      pré-selecionado, com a situação no rótulo (A-3);
 *    - motivo: o natural do tipo, com "Outro (controlado)" como única
 *      alternativa (A-4);
 *    - dia: opcional para todos os tipos (A-6).
 * 2. **Revisão:** o resumo e uma só ação, "Confirmar e enviar" (A-2).
 *
 * Esta janela não grava nada: quem registra e envia é a seção, que recebe os
 * dados por `onConfirmar` e devolve o resultado por `enviando` e `erro`.
 * Sem texto livre, anexo, CID ou dado pessoal novo.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  FormActions,
  FormField,
  Modal,
  usePedirFechamentoModal,
} from "../../components";
import {
  MOTIVO_ALTERNATIVO_NA_FICHA,
  MOTIVO_NATURAL_POR_TIPO,
  ROTULO_MOTIVO,
  ROTULO_TIPO,
  TIPOS_SOLICITACAO_PESSOA,
  type MotivoSolicitacaoPessoa,
  type TipoSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import type { VinculoApi } from "../../api/colaboradoresClient";
import { formatarDiaCivil } from "../../format/data";

/** O que a seção grava: vínculo, tipo, motivo e o dia, se houver. */
export interface DadosDaNovaSolicitacao {
  readonly vinculoId: string;
  readonly tipo: TipoSolicitacaoPessoa;
  readonly motivo: MotivoSolicitacaoPessoa;
  readonly periodoReferencia: string | null;
}

/** Limites do campo de dia: um ano parcial (0002, 0020…) não passa. */
export const DIA_MINIMO = "1900-01-01";
export const DIA_MAXIMO = "2100-12-31";
const DIA = /^\d{4}-\d{2}-\d{2}$/;

function diaValido(dia: string): boolean {
  if (!DIA.test(dia) || dia < DIA_MINIMO || dia > DIA_MAXIMO) return false;
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return (
    data.getUTCFullYear() === a &&
    data.getUTCMonth() === m - 1 &&
    data.getUTCDate() === d
  );
}

export interface NovaSolicitacaoModalProps {
  readonly aberto: boolean;
  /** Os vínculos da pessoa na empresa ativa, o principal primeiro. */
  readonly vinculos: readonly VinculoApi[];
  readonly vinculoPrincipalId: string | null;
  /** "CLT · MAT-0001 · Ativo · vínculo principal" — o mesmo rótulo da aba. */
  readonly rotuloDoVinculo: (vinculo: VinculoApi) => string;
  /** Registro e envio em curso: nada fecha nem repete. */
  readonly enviando: boolean;
  /** Recusa ou resposta incerta do registro; o formulário fica como estava. */
  readonly erro: { readonly texto: string; readonly n: number } | null;
  readonly onConfirmar: (dados: DadosDaNovaSolicitacao) => void;
  readonly onFechar: () => void;
}

interface Campos {
  readonly tipo: TipoSolicitacaoPessoa | "";
  readonly vinculoId: string;
  readonly motivo: MotivoSolicitacaoPessoa | "";
  readonly dia: string;
}

export function NovaSolicitacaoModal({
  aberto,
  vinculos,
  vinculoPrincipalId,
  rotuloDoVinculo,
  enviando,
  erro,
  onConfirmar,
  onFechar,
}: NovaSolicitacaoModalProps) {
  const prefixo = useId();
  const ids = {
    tipo: `${prefixo}-tipo`,
    vinculo: `${prefixo}-vinculo`,
    motivo: `${prefixo}-motivo`,
    dia: `${prefixo}-dia`,
    // Um id por passo: o foco nunca cai no título do passo que está saindo.
    passoFormulario: `${prefixo}-passo-formulario`,
    passoRevisao: `${prefixo}-passo-revisao`,
    erro: `${prefixo}-erro`,
  };
  const inicial = (): Campos => ({
    tipo: "",
    vinculoId:
      vinculos.find((v) => v.id === vinculoPrincipalId)?.id ??
      vinculos[0]?.id ??
      "",
    motivo: "",
    dia: "",
  });
  const [campos, setCampos] = useState<Campos>(inicial);
  const [passo, setPasso] = useState<"formulario" | "revisao">("formulario");
  const [erroTipo, setErroTipo] = useState<string | null>(null);
  const [erroDia, setErroDia] = useState<string | null>(null);
  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);

  // Cada abertura começa do zero.
  useEffect(() => {
    if (!aberto) return;
    setCampos(inicial());
    setPasso("formulario");
    setErroTipo(null);
    setErroDia(null);
    // `inicial` lê as props do momento da abertura, e só dela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Recusa ou incerteza do registro: volta ao formulário, com os valores. O
  // foco vai ao título do passo (o botão em foco some com a revisão), e o
  // aviso é anunciado uma vez pelo `alert`.
  useEffect(() => {
    if (!erro) return;
    setPasso("formulario");
    focoRef.current = ids.passoFormulario;
    // Só um erro novo (o `n`) muda o passo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erro?.n]);

  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  const principalId =
    vinculos.find((v) => v.id === vinculoPrincipalId)?.id ??
    vinculos[0]?.id ??
    "";
  const alterado =
    campos.tipo !== "" || campos.vinculoId !== principalId || campos.dia !== "";
  const vinculo = vinculos.find((v) => v.id === campos.vinculoId) ?? null;

  function escolherTipo(valor: string) {
    const tipo = valor as TipoSolicitacaoPessoa | "";
    setCampos((c) => ({
      ...c,
      tipo,
      // Cada tipo começa no seu motivo natural (A-4).
      motivo: tipo === "" ? "" : MOTIVO_NATURAL_POR_TIPO[tipo],
    }));
    if (tipo !== "") setErroTipo(null);
  }

  function revisar() {
    let primeiroErro: string | null = null;
    if (campos.tipo === "") {
      setErroTipo("Escolha o tipo da solicitação.");
      primeiroErro = ids.tipo;
    }
    if (campos.dia !== "" && !diaValido(campos.dia)) {
      setErroDia("Informe uma data válida ou deixe o campo em branco.");
      primeiroErro ??= ids.dia;
    } else {
      setErroDia(null);
    }
    if (primeiroErro !== null || vinculo === null) {
      focoRef.current = primeiroErro ?? ids.vinculo;
      return;
    }
    setPasso("revisao");
    focoRef.current = ids.passoRevisao;
  }

  function voltar() {
    if (enviando) return;
    setPasso("formulario");
    focoRef.current = ids.passoFormulario;
  }

  function confirmar() {
    if (enviando || campos.tipo === "" || campos.motivo === "" || !vinculo) {
      return;
    }
    onConfirmar({
      vinculoId: vinculo.id,
      tipo: campos.tipo,
      motivo: campos.motivo,
      periodoReferencia: campos.dia === "" ? null : campos.dia,
    });
  }

  const avisoDeErro = erro ? (
    <p
      key={erro.n}
      id={ids.erro}
      role="alert"
      className="solicitacoes-colaborador__erro"
    >
      {erro.texto}
    </p>
  ) : null;

  return (
    <Modal
      aberto={aberto}
      titulo="Nova solicitação"
      descricao="A solicitação é registrada e enviada ao RH em nome da pessoa. Sem anexo, texto livre ou informação clínica."
      onFechar={onFechar}
      alterado={alterado}
      bloqueado={enviando}
      rodape={
        passo === "formulario" ? (
          <FormActions>
            <BotaoCancelar />
            <Button type="button" variant="primary" onClick={revisar}>
              Revisar
            </Button>
          </FormActions>
        ) : (
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              aria-disabled={enviando}
              onClick={voltar}
            >
              Voltar
            </Button>
            {/* `aria-disabled`, não `disabled`: o botão em foco não perde o
                foco durante o envio; a trava contra clique repetido é da
                seção (`enviando` e a referência de envio). */}
            <Button
              type="button"
              variant="primary"
              aria-disabled={enviando}
              onClick={confirmar}
            >
              {enviando ? "Enviando…" : "Confirmar e enviar"}
            </Button>
          </FormActions>
        )
      }
    >
      {passo === "formulario" ? (
        <form
          className="solicitacoes-colaborador__formulario"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            revisar();
          }}
        >
          <h3
            id={ids.passoFormulario}
            tabIndex={-1}
            className="solicitacoes-colaborador__passo"
          >
            Dados da solicitação
          </h3>
          {avisoDeErro}
          <FormField
            id={ids.tipo}
            label="Tipo"
            required
            {...(erroTipo ? { error: erroTipo } : {})}
          >
            {(control) => (
              <select
                value={campos.tipo}
                onChange={(e) => escolherTipo(e.target.value)}
                {...control}
              >
                <option value="">Selecione…</option>
                {TIPOS_SOLICITACAO_PESSOA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id={ids.vinculo} label="Vínculo" required>
            {(control) => (
              <select
                value={campos.vinculoId}
                onChange={(e) =>
                  setCampos((c) => ({ ...c, vinculoId: e.target.value }))
                }
                {...control}
              >
                {vinculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {rotuloDoVinculo(v)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField
            id={ids.motivo}
            label="Motivo"
            required
            help={
              campos.tipo === ""
                ? "Escolha o tipo primeiro: o motivo começa no motivo do tipo."
                : "O motivo do tipo ou “Outro (controlado)”. Não há texto livre."
            }
          >
            {(control) =>
              campos.tipo === "" ? (
                <select value="" disabled {...control}>
                  <option value="">Escolha o tipo primeiro</option>
                </select>
              ) : (
                <select
                  value={campos.motivo}
                  onChange={(e) =>
                    setCampos((c) => ({
                      ...c,
                      motivo: e.target.value as MotivoSolicitacaoPessoa,
                    }))
                  }
                  {...control}
                >
                  {[
                    MOTIVO_NATURAL_POR_TIPO[campos.tipo],
                    MOTIVO_ALTERNATIVO_NA_FICHA,
                  ].map((m) => (
                    <option key={m} value={m}>
                      {ROTULO_MOTIVO[m]}
                    </option>
                  ))}
                </select>
              )
            }
          </FormField>
          <FormField
            id={ids.dia}
            label="Dia de referência"
            help="Opcional para todos os tipos."
            {...(erroDia ? { error: erroDia } : {})}
          >
            {(control) => (
              <input
                type="date"
                min={DIA_MINIMO}
                max={DIA_MAXIMO}
                value={campos.dia}
                onChange={(e) => {
                  setCampos((c) => ({ ...c, dia: e.target.value }));
                  setErroDia(null);
                }}
                {...control}
              />
            )}
          </FormField>
          {/* Enter num campo também leva à revisão. */}
          <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
        </form>
      ) : (
        <div className="solicitacoes-colaborador__formulario">
          <h3
            id={ids.passoRevisao}
            tabIndex={-1}
            className="solicitacoes-colaborador__passo"
          >
            Confira antes de enviar
          </h3>
          <dl className="solicitacoes-colaborador__campos">
            <div>
              <dt>Tipo</dt>
              <dd>{campos.tipo === "" ? "" : ROTULO_TIPO[campos.tipo]}</dd>
            </div>
            <div>
              <dt>Vínculo</dt>
              <dd>{vinculo ? rotuloDoVinculo(vinculo) : ""}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>
                {campos.motivo === "" ? "" : ROTULO_MOTIVO[campos.motivo]}
              </dd>
            </div>
            {campos.dia !== "" ? (
              <div>
                <dt>Dia de referência</dt>
                <dd>{formatarDiaCivil(campos.dia)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="ficha-colaborador__texto">
            Ao confirmar, a solicitação é registrada e enviada ao RH. Depois de
            enviada, ela segue em Pessoas › Solicitações.
          </p>
          {enviando ? (
            <p className="ficha-colaborador__texto" role="status">
              Enviando… Aguarde a confirmação do servidor.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** "Cancelar" pelo mesmo caminho do Escape e do "Fechar" da janela. */
function BotaoCancelar() {
  const pedirFechamento = usePedirFechamentoModal();
  return (
    <Button type="button" variant="secondary" onClick={pedirFechamento}>
      Cancelar
    </Button>
  );
}
