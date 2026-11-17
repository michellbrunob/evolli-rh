/**
 * T209 — Configurações › Empresas: as empresas que a conta alcança
 * (`GET /v1/empresas/da-conta`), a principal primeiro, com CNPJ,
 * colaboradores ativos e cidade. "Adicionar empresa" leva à Nova empresa e
 * só aparece para quem cria (RH e master técnico); o servidor decide de novo.
 */
import { useCallback, useEffect, useState } from "react";
import { IconeEditar, IconeEmpresa, IconeMais } from "../../ui/icones";
import { Button, PageHeader } from "../../components";
import {
  listarEmpresasDaConta,
  type EmpresaDaContaApi,
} from "../../api/empresasClient";
import { formatarCnpj } from "../../format/cnpj";
import { NavegacaoConfiguracoes } from "./NavegacaoConfiguracoes";
import { EditarEmpresaPainel } from "./EditarEmpresaPainel";
import "./MeuPerfilScreen.css";
import "./EmpresasScreen.css";

export const EMPRESAS_TITULO_ID = "configuracoes-empresas-titulo";
const SECAO_TITULO_ID = "configuracoes-empresas-secao";
const LISTA_TITULO_ID = "configuracoes-empresas-lista";

type Estado =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "falha" }
  | { readonly tipo: "pronto"; readonly itens: EmpresaDaContaApi[] };

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

export interface EmpresasScreenProps {
  readonly podeAdicionar: boolean;
  /** T209 — o lápis de cada linha (RH e master técnico). */
  readonly podeEditar: boolean;
  readonly onAdicionar: () => void;
  /** Mensagem de retorno (ex.: a empresa recém-criada). */
  readonly aviso?: string | undefined;
}

export function EmpresasScreen({
  podeAdicionar,
  podeEditar,
  onAdicionar,
  aviso,
}: EmpresasScreenProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [editando, setEditando] = useState<EmpresaDaContaApi | null>(null);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const avisoExibido = avisoLocal ?? aviso;

  useEffect(() => {
    let cancelado = false;
    setEstado({ tipo: "carregando" });
    listarEmpresasDaConta()
      .then((itens) => {
        if (!cancelado) setEstado({ tipo: "pronto", itens });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: "falha" });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  return (
    <div className="configuracoes">
      {/* T209 — a trilha fica só na barra superior (sem repetição). */}
      <PageHeader
        headingLevel={1}
        titleId={EMPRESAS_TITULO_ID}
        title="Configurações"
        description="A sua conta de acesso e as empresas do Evolli RH."
      />

      <div className="configuracoes__corpo">
        <NavegacaoConfiguracoes atual="empresas" mostrarEmpresas />

        <section
          className="configuracoes__painel"
          aria-labelledby={SECAO_TITULO_ID}
        >
          <div className="empresas__cabecalho">
            <div className="configuracoes__cabecalho">
              <h2 className="configuracoes__titulo" id={SECAO_TITULO_ID}>
                Empresas
              </h2>
              <p className="configuracoes__texto">
                Cada empresa (CNPJ) é um ambiente do painel, com colaboradores e
                cadastros separados.
              </p>
            </div>
            {podeAdicionar ? (
              <Button type="button" variant="primary" onClick={onAdicionar}>
                <IconeMais tamanho={16} />
                Adicionar empresa
              </Button>
            ) : null}
          </div>

          {avisoExibido ? (
            <p className="empresas__aviso" role="status">
              {avisoExibido}
            </p>
          ) : null}

          <h3 className="empresas__subtitulo" id={LISTA_TITULO_ID}>
            Empresas da conta
          </h3>
          <p className="configuracoes__texto">
            A empresa principal é a da sua conta e não pode ser removida.
          </p>

          {estado.tipo === "carregando" ? (
            <p className="configuracoes__texto" role="status">
              Carregando empresas…
            </p>
          ) : estado.tipo === "falha" ? (
            <div className="empresas__falha">
              <p role="alert">Não foi possível carregar as empresas.</p>
              <Button type="button" variant="secondary" onClick={recarregar}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="empresas__tabela-moldura">
              <table
                className="empresas__tabela"
                aria-labelledby={LISTA_TITULO_ID}
              >
                <thead>
                  <tr>
                    <th scope="col">Empresa</th>
                    <th scope="col">Colaboradores</th>
                    <th scope="col">Cidade</th>
                    {podeEditar ? (
                      <th scope="col">
                        <span className="cadastro-etapas__so-leitor">
                          Ações
                        </span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {estado.itens.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="empresas__empresa">
                          <span
                            className="empresas__monograma"
                            aria-hidden="true"
                          >
                            {iniciais(e.nome) || <IconeEmpresa tamanho={16} />}
                          </span>
                          <span className="empresas__textos">
                            <span className="empresas__nome">
                              {e.nome}
                              {e.principal ? (
                                <span className="empresas__selo">
                                  Principal
                                </span>
                              ) : null}
                            </span>
                            <span className="empresas__cnpj">
                              {e.cnpj ? formatarCnpj(e.cnpj) : "Sem CNPJ"}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {e.colaboradoresAtivos === 1
                          ? "1 ativo"
                          : `${e.colaboradoresAtivos} ativos`}
                      </td>
                      <td>
                        {e.cidade
                          ? e.uf
                            ? `${e.cidade}/${e.uf}`
                            : e.cidade
                          : "—"}
                      </td>
                      {podeEditar ? (
                        <td className="empresas__acoes">
                          <button
                            type="button"
                            className="empresas__editar"
                            aria-label={`Editar ${e.nome}`}
                            onClick={() => {
                              setAvisoLocal(null);
                              setEditando(e);
                            }}
                          >
                            <IconeEditar tamanho={16} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {editando ? (
        <EditarEmpresaPainel
          key={editando.id}
          empresa={editando}
          onFechar={() => setEditando(null)}
          onSalva={(salva) => {
            setEditando(null);
            setAvisoLocal(`${salva.nome} atualizada.`);
            recarregar();
          }}
        />
      ) : null}
    </div>
  );
}
