/**
 * T216 — só na anônima: "Separar respostas por (opcional)". Quem responde
 * escolhe o grupo antes das perguntas (ou prefere não informar). Até 2
 * campos — o terceiro fica bloqueado, para ninguém ser reconhecido pela
 * combinação. Ligado um campo, aparecem as opções que quem responde verá e
 * dá para cadastrar uma nova ali mesmo (a criação na hora que o Evolli já
 * usa nas referências da estrutura).
 */
import { useEffect, useState } from "react";
import type { CampoGrupo } from "../../api/pesquisasClient";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { IconeMais } from "../../ui/icones";
import { ModalCriacaoInline } from "../pessoas/ModalCriacaoInline";
import { CartaoDeSecao } from "./componentes";
import type {
  GruposDaEmpresa,
  OpcaoDeGrupo,
  ServicoDePesquisas,
} from "./servicoDePesquisas";

export const CAMPOS_DE_GRUPO: readonly {
  campo: CampoGrupo;
  rotulo: string;
  nome: string;
}[] = [
  { campo: "departamento", rotulo: "Departamento", nome: "departamento" },
  { campo: "centroCusto", rotulo: "Centro de custo", nome: "centro de custo" },
  { campo: "unidade", rotulo: "Unidade", nome: "unidade" },
];

export const LIMITE_DE_CAMPOS = 2;

export function SepararRespostasPor({
  servico,
  separarPor,
  travado,
  motivoDoTravamento,
  onMudar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly separarPor: readonly CampoGrupo[];
  readonly travado: boolean;
  /** A frase que explica por que não muda mais (ex.: já há respostas). */
  readonly motivoDoTravamento?: string;
  readonly onMudar: (separarPor: CampoGrupo[]) => void;
}) {
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  const [novo, setNovo] = useState<{ campo: CampoGrupo; nome: string } | null>(
    null,
  );
  const [pedido, setPedido] = useState<{
    tipo: CampoGrupo;
    nome: string;
  } | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.listarGrupos())
      .then((g) => {
        if (vivo && g) setGrupos(g);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [servico]);

  function incluir(campo: CampoGrupo, opcao: OpcaoDeGrupo) {
    setGrupos((g) =>
      g
        ? {
            ...g,
            [campo]: [...g[campo].filter((o) => o.id !== opcao.id), opcao],
          }
        : g,
    );
  }

  async function pedirCriacao(campo: CampoGrupo, nome: string) {
    const id = empresaId ?? (await servico.empresaAtiva())?.id ?? null;
    if (!id) return;
    setEmpresaId(id);
    setPedido({ tipo: campo, nome });
    setNovo(null);
  }

  return (
    <CartaoDeSecao
      titulo="Separar respostas por (opcional)"
      descricao={
        travado && motivoDoTravamento
          ? motivoDoTravamento
          : "Quem responde escolhe antes das perguntas, ou prefere não informar. Os grupos pequenos continuam protegidos pelo mínimo."
      }
    >
      <ul className="pesquisas__separar" aria-label="Separar respostas por">
        {CAMPOS_DE_GRUPO.map(({ campo, rotulo, nome }) => {
          const marcado = separarPor.includes(campo);
          const bloqueado = !marcado && separarPor.length >= LIMITE_DE_CAMPOS;
          const opcoes = grupos?.[campo] ?? [];
          return (
            <li key={campo} {...(bloqueado ? { "data-bloqueado": "" } : {})}>
              <label className="pesquisas__escolha">
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={travado || bloqueado}
                  onChange={(e) =>
                    onMudar(
                      e.target.checked
                        ? [...separarPor, campo]
                        : separarPor.filter((c) => c !== campo),
                    )
                  }
                />
                <span className="pesquisas__escolha-textos">
                  <strong>{rotulo}</strong>
                  <span className="pesquisas__suave">
                    {bloqueado
                      ? `Até ${LIMITE_DE_CAMPOS} campos, para ninguém ser reconhecido pela combinação.`
                      : grupos === null
                        ? "Carregando opções…"
                        : opcoes.length === 0
                          ? "Nenhuma opção cadastrada"
                          : plural(opcoes.length, "opção", "opções")}
                  </span>
                </span>
              </label>
              {marcado ? (
                <div className="pesquisas__separar-opcoes">
                  <p className="pesquisas__suave">Quem responde vai ver:</p>
                  <ul
                    className="pesquisas__chips"
                    aria-label={`Opções de ${nome}`}
                  >
                    {opcoes.map((o) => (
                      <li key={o.id} className="pesquisas__chip">
                        {o.nome}
                      </li>
                    ))}
                    <li className="pesquisas__chip pesquisas__chip--suave">
                      Prefiro não informar
                    </li>
                  </ul>
                  {travado ? null : novo?.campo === campo ? (
                    <div className="pesquisas__caixa-inline-rodape">
                      <input
                        className="pesquisas__campo"
                        aria-label={`Nome do novo ${nome}`}
                        value={novo.nome}
                        onChange={(e) =>
                          setNovo({ campo, nome: e.target.value })
                        }
                      />
                      <Button variant="subtle" onClick={() => setNovo(null)}>
                        Cancelar
                      </Button>
                      <Button
                        disabled={!novo.nome.trim()}
                        onClick={() =>
                          void pedirCriacao(campo, novo.nome.trim())
                        }
                      >
                        Adicionar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="subtle"
                      onClick={() => setNovo({ campo, nome: "" })}
                    >
                      <IconeMais tamanho={14} />
                      {`Adicionar ${nome}`}
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {empresaId ? (
        <ModalCriacaoInline
          pedido={pedido}
          empresaId={empresaId}
          onFechar={() => setPedido(null)}
          onCriada={(tipo, criada) => {
            incluir(tipo as CampoGrupo, { id: criada.id, nome: criada.nome });
            setPedido(null);
          }}
          onEscolherExistente={(tipo, existente) => {
            incluir(tipo as CampoGrupo, {
              id: existente.id,
              nome: existente.nome,
            });
            setPedido(null);
          }}
          onIncerto={() => {
            setPedido(null);
            void Promise.resolve(servico.listarGrupos()).then(
              (g) => g && setGrupos(g),
            );
          }}
        />
      ) : null}
    </CartaoDeSecao>
  );
}
