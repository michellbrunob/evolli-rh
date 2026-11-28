/**
 * T216 — só na anônima: "Separar respostas por" (opcional). Quem responde
 * escolhe o grupo antes das perguntas (ou prefere não informar). Lista
 * vertical: cada campo com "N opções: a, b, c" e o interruptor à direita;
 * ligado, as opções que quem responde verá aparecem dentro da faixa, com
 * "+ Adicionar" na mesma linha (a criação na hora que o Evolli já usa nas
 * referências da estrutura). Até 2 campos — o terceiro fica bloqueado, para
 * ninguém ser reconhecido pela combinação. Travado (já há respostas), nada
 * muda e o interruptor esmaece, mesmo ligado.
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

/** "3 opções: a, b, c" — até três nomes; mais que isso, com reticências. */
export function resumoDasOpcoes(
  opcoes: readonly { readonly nome: string }[],
): string {
  if (opcoes.length === 0) return "Nenhuma opção cadastrada";
  const nomes = opcoes
    .slice(0, 3)
    .map((o) => o.nome)
    .join(", ");
  return `${plural(opcoes.length, "opção", "opções")}: ${nomes}${opcoes.length > 3 ? "…" : ""}`;
}

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
      titulo="Separar respostas por"
      contador="Opcional"
      descricao={`Quem responde escolhe antes das perguntas, ou prefere não informar, e você vê os resultados por grupo sem saber quem respondeu. Até ${LIMITE_DE_CAMPOS} campos, para ninguém ser reconhecido pela combinação.`}
    >
      {travado && motivoDoTravamento ? (
        <p className="pesquisas__nota-cinza" role="note">
          {motivoDoTravamento}
        </p>
      ) : null}
      <ul className="pesquisas__separar" aria-label="Separar respostas por">
        {CAMPOS_DE_GRUPO.map(({ campo, rotulo, nome }) => {
          const marcado = separarPor.includes(campo);
          const bloqueado = !marcado && separarPor.length >= LIMITE_DE_CAMPOS;
          const opcoes = grupos?.[campo] ?? [];
          return (
            <li
              key={campo}
              {...(bloqueado ? { "data-bloqueado": "" } : {})}
              {...(travado ? { "data-travado": "" } : {})}
              {...(marcado ? { "data-ligado": "" } : {})}
            >
              <div className="pesquisas__separar-cabeca">
                <span className="pesquisas__separar-textos">
                  <strong>{rotulo}</strong>
                  <span className="pesquisas__suave">
                    {bloqueado
                      ? `Até ${LIMITE_DE_CAMPOS} campos, para ninguém ser reconhecido pela combinação.`
                      : grupos === null
                        ? "Carregando opções…"
                        : resumoDasOpcoes(opcoes)}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marcado}
                  aria-label={rotulo}
                  className="pesquisas__interruptor"
                  disabled={travado || bloqueado}
                  onClick={() =>
                    onMudar(
                      marcado
                        ? separarPor.filter((c) => c !== campo)
                        : [...separarPor, campo],
                    )
                  }
                >
                  <span
                    className="pesquisas__interruptor-trilho"
                    aria-hidden="true"
                  />
                </button>
              </div>
              {marcado ? (
                <div className="pesquisas__separar-opcoes">
                  <p className="pesquisas__suave">
                    Opções que aparecem para quem responde
                  </p>
                  <div className="pesquisas__separar-linha">
                    <ul
                      className="pesquisas__separar-chips"
                      aria-label={`Opções de ${nome}`}
                    >
                      {opcoes.map((o) => (
                        <li key={o.id} className="pesquisas__separar-chip">
                          {o.nome}
                        </li>
                      ))}
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
                      <button
                        type="button"
                        className="pesquisas__acao-texto pesquisas__acao-texto--primaria pesquisas__com-icone"
                        onClick={() => setNovo({ campo, nome: "" })}
                      >
                        <IconeMais tamanho={14} />
                        {`Adicionar ${nome}`}
                      </button>
                    )}
                  </div>
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
