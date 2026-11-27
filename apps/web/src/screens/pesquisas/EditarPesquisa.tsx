/**
 * T216 — "Editar pesquisa" (publicada, até ser finalizada): página própria,
 * sem mexer nas perguntas. Cartões: Dados da pesquisa (nome, descrição e o
 * selo da identificação), Encerramento, "Separar por" (travado quando já há
 * respostas) e Participantes (Total, Responderam e Pendentes; abas Atuais e
 * Adicionar, com busca e filtro). Rodapé fixo com o estado das alterações,
 * Cancelar e Salvar alterações.
 */
import { useEffect, useMemo, useState } from "react";
import type { ColaboradorListadoApi } from "../../api/colaboradoresClient";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { IconButton } from "../../ui";
import { IconeRemover, IconeVoltar } from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { useAvisar } from "./avisos";
import { CartaoDeEncerramento } from "./CartaoDeEncerramento";
import {
  Avatar,
  CampoDeBusca,
  CartaoDeSecao,
  ICONE_DA_IDENTIFICACAO,
  IconeDoModelo,
  iniciaisDe,
  Pilulas,
} from "./componentes";
import {
  entradaDoEstado,
  estadoDoDetalhe,
  validarEnvio,
  validarSobre,
  type EstadoDaPesquisa,
  type PessoaEscolhida,
} from "./estadoDaPesquisa";
import { departamentoDe } from "./EtapaColaboradores";
import { semAcento } from "./GaleriaDeModelos";
import { SepararRespostasPor } from "./SepararRespostasPor";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { LIMITES, ROTULO_DA_IDENTIFICACAO } from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

export function EditarPesquisa({
  servico,
  pesquisaId,
  hoje,
  onVoltar,
  onSalvo,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  readonly hoje: string;
  readonly onVoltar: () => void;
  readonly onSalvo: (d: PesquisaDetalhe) => void;
}) {
  const [detalhe, setDetalhe] = useState<PesquisaDetalhe | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(pesquisaId))
      .then((d) => {
        if (vivo) setDetalhe(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId]);
  if (falhou)
    return (
      <div className="pesquisas">
        <p className="pesquisas__erro" role="alert">
          Não foi possível abrir a pesquisa.
        </p>
        <Button variant="secondary" onClick={onVoltar}>
          Voltar
        </Button>
      </div>
    );
  if (!detalhe) return <Esqueleto rotulo="Carregando a pesquisa…" linhas={5} />;
  return (
    <FormularioDeEdicao
      servico={servico}
      detalhe={detalhe}
      hoje={hoje}
      onVoltar={onVoltar}
      onSalvo={onSalvo}
    />
  );
}

function FormularioDeEdicao({
  servico,
  detalhe,
  hoje,
  onVoltar,
  onSalvo,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly hoje: string;
  readonly onVoltar: () => void;
  readonly onSalvo: (d: PesquisaDetalhe) => void;
}) {
  const avisar = useAvisar();
  const [estado, setEstado] = useState<EstadoDaPesquisa>(() =>
    estadoDoDetalhe(detalhe),
  );
  const referencia = useMemo(
    () => JSON.stringify(entradaDoEstado(estadoDoDetalhe(detalhe))),
    [detalhe],
  );
  const [salvando, setSalvando] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const pendente = JSON.stringify(entradaDoEstado(estado)) !== referencia;
  const erros = mostrarErros
    ? { ...validarSobre(estado), ...validarEnvio(estado, hoje) }
    : null;
  const anonima = estado.identificacao === "anonima";
  const IconeId = ICONE_DA_IDENTIFICACAO[estado.identificacao];

  useEdicaoEmAndamento(`Editar ${detalhe.nome}`, {
    pendente,
    salvando,
  });

  const mudar = (m: Partial<EstadoDaPesquisa>) =>
    setEstado((e) => ({ ...e, ...m }));

  async function salvar() {
    const encontrados = {
      ...validarSobre(estado),
      ...validarEnvio(estado, hoje),
    };
    if (Object.keys(encontrados).length > 0) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setFalha(null);
    try {
      const d = await servico.alterarPesquisa(
        detalhe.id,
        entradaDoEstado(estado),
      );
      avisar("Alterações salvas.");
      onSalvo(d ?? detalhe);
    } catch (erro) {
      const status = (erro as { status?: unknown } | null)?.status;
      setFalha(
        status === 409 || status === 422
          ? "O servidor recusou as alterações (a pesquisa pode ter mudado de situação). Volte aos resultados e abra de novo."
          : "Não foi possível salvar as alterações. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="pesquisas pesquisas--com-rodape">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar para os resultados"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <IconeDoModelo id={detalhe.modelo} tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            Editar pesquisa
          </h1>
          <p className="pesquisas__subtitulo">
            As perguntas não mudam depois de publicar. Nome, descrição, prazo e
            participantes ainda podem mudar.
          </p>
        </div>
      </header>

      <CartaoDeSecao
        titulo="Dados da pesquisa"
        acao={
          <span className="pesquisas__selo pesquisas__com-icone">
            <IconeId tamanho={12} />
            {ROTULO_DA_IDENTIFICACAO[estado.identificacao]}
          </span>
        }
      >
        <div className="pesquisas__campos">
          <label htmlFor="editar-nome" className="pesquisas__rotulo">
            Nome da pesquisa
          </label>
          <input
            id="editar-nome"
            className="pesquisas__campo"
            value={estado.nome}
            maxLength={LIMITES.nome + 10}
            aria-invalid={erros?.nome ? true : undefined}
            onChange={(e) => mudar({ nome: e.target.value })}
          />
          {erros?.nome ? <p className="pesquisas__erro">{erros.nome}</p> : null}
          <label htmlFor="editar-descricao" className="pesquisas__rotulo">
            Descrição <span className="pesquisas__suave">opcional</span>
          </label>
          <textarea
            id="editar-descricao"
            className="pesquisas__campo"
            value={estado.boasVindas}
            onChange={(e) => mudar({ boasVindas: e.target.value })}
          />
        </div>
      </CartaoDeSecao>

      <CartaoDeEncerramento
        compacto
        data={estado.encerraEm}
        hora={estado.encerraHora}
        hoje={hoje}
        erro={erros?.encerraEm}
        onMudar={mudar}
      />

      {anonima ? (
        <SepararRespostasPor
          servico={servico}
          separarPor={estado.separarPor}
          travado={detalhe.temRespostas}
          motivoDoTravamento="A pesquisa já tem respostas: a separação por grupo não muda mais."
          onMudar={(separarPor) => mudar({ separarPor })}
        />
      ) : (
        <PainelDeParticipantes
          servico={servico}
          detalhe={detalhe}
          estado={estado}
          onMudar={mudar}
        />
      )}

      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}

      <footer className="pesquisas__rodape">
        <span className="pesquisas__suave" role="status">
          {pendente ? "Alterações não salvas." : "Sem alterações pendentes"}
        </span>
        <div className="pesquisas__rodape-direita">
          <Button variant="subtle" disabled={salvando} onClick={onVoltar}>
            Cancelar
          </Button>
          <Button
            disabled={!pendente || salvando}
            onClick={() => void salvar()}
          >
            Salvar alterações
          </Button>
        </div>
      </footer>
    </div>
  );
}

function PainelDeParticipantes({
  servico,
  detalhe,
  estado,
  onMudar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly estado: EstadoDaPesquisa;
  readonly onMudar: (m: Partial<EstadoDaPesquisa>) => void;
}) {
  const [aba, setAba] = useState<"atuais" | "adicionar">("atuais");
  const [busca, setBusca] = useState("");
  const [time, setTime] = useState<readonly ColaboradorListadoApi[] | null>(
    null,
  );
  const lista = detalhe.participantesLista ?? [];
  const respondeu = new Set(
    lista.filter((p) => p.respondeu).map((p) => p.colaboradorId),
  );
  // Atuais: a lista da pesquisa (todo o time resolvido ou os escolhidos).
  const atuais: Record<string, PessoaEscolhida> = estado.todos
    ? Object.fromEntries(
        lista.map((p) => [
          p.colaboradorId,
          { nome: p.nome, departamento: p.departamento },
        ]),
      )
    : { ...estado.escolhidos };
  // Sem mudança na lista, vale o total do servidor (todo o time inteiro).
  const total =
    estado.todos && lista.length === 0
      ? (detalhe.participantesTotal ?? detalhe.participantes ?? 0)
      : Object.keys(atuais).length;
  const responderam = detalhe.responderam ?? respondeu.size;
  const pendentes = detalhe.pendentes ?? Math.max(0, total - responderam);

  useEffect(() => {
    if (aba !== "adicionar" || time) return;
    let vivo = true;
    Promise.resolve(servico.listarTodosAtivos())
      .then((t) => {
        if (vivo) setTime(t ?? []);
      })
      .catch(() => {
        if (vivo) setTime([]);
      });
    return () => {
      vivo = false;
    };
  }, [aba, time, servico]);

  const termo = semAcento(busca.trim());
  const casa = (nome: string, dep: string | null) =>
    !termo || semAcento(`${nome} ${dep ?? ""}`).includes(termo);

  function remover(id: string) {
    const novo = { ...atuais };
    delete novo[id];
    onMudar({ todos: false, escolhidos: novo });
  }

  function adicionar(c: ColaboradorListadoApi) {
    onMudar({
      todos: false,
      escolhidos: {
        ...atuais,
        [c.id]: { nome: c.nome, departamento: departamentoDe(c) },
      },
    });
  }

  return (
    <CartaoDeSecao titulo="Participantes">
      <dl className="pesquisas__faixa" aria-label="Totais de participantes">
        <div>
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Responderam</dt>
          <dd>{responderam}</dd>
        </div>
        <div>
          <dt>Pendentes</dt>
          <dd>{pendentes}</dd>
        </div>
      </dl>
      <div className="pesquisas__filtros">
        <Pilulas
          rotulo="Participantes"
          valor={aba}
          onMudar={setAba}
          opcoes={[
            { valor: "atuais", rotulo: "Atuais", contagem: total },
            { valor: "adicionar", rotulo: "Adicionar" },
          ]}
        />
        <CampoDeBusca rotulo="Buscar pessoa" valor={busca} onMudar={setBusca} />
      </div>
      {aba === "atuais" ? (
        <ul
          className="pesquisas__lista-pessoas"
          aria-label="Participantes atuais"
        >
          {Object.entries(atuais)
            .filter(([, p]) => casa(p.nome, p.departamento))
            .map(([id, p]) => (
              <li key={id}>
                <Avatar texto={iniciaisDe(p.nome)} />
                <span className="pesquisas__pessoa-textos">
                  <span>{p.nome}</span>
                  <span className="pesquisas__suave">
                    {[
                      p.departamento,
                      respondeu.has(id) ? "já respondeu" : "pendente",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {respondeu.has(id) ? null : (
                  <IconButton
                    label={`Tirar ${p.nome}`}
                    icon={<IconeRemover tamanho={14} />}
                    variant="subtle"
                    onClick={() => remover(id)}
                  />
                )}
              </li>
            ))}
        </ul>
      ) : time === null ? (
        <p className="pesquisas__suave">Carregando pessoas…</p>
      ) : (
        <ul
          className="pesquisas__lista-pessoas"
          aria-label="Pessoas para adicionar"
        >
          {time
            .filter((c) => !(c.id in atuais) && casa(c.nome, departamentoDe(c)))
            .map((c) => (
              <li key={c.id}>
                <Avatar texto={iniciaisDe(c.nome)} />
                <span className="pesquisas__pessoa-textos">
                  <span>{c.nome}</span>
                  <span className="pesquisas__suave">
                    {departamentoDe(c) ?? "Sem departamento"}
                  </span>
                </span>
                <Button variant="secondary" onClick={() => adicionar(c)}>
                  Adicionar
                </Button>
              </li>
            ))}
        </ul>
      )}
      <p className="pesquisas__suave">
        {`Quem já respondeu não sai da pesquisa. ${plural(pendentes, "pessoa ainda não respondeu", "pessoas ainda não responderam")}.`}
      </p>
    </CartaoDeSecao>
  );
}
