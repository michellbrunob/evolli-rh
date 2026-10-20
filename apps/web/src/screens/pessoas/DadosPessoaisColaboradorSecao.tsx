import { useEffect, useState } from "react";
import { ApiError } from "../../api/colaboradoresClient";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { formatarDiaCivil } from "../../format/data";
import {
  CAMPOS_ENDERECO,
  CAMPOS_TEXTO_PERFIL,
  ROTULO_DATA_NASCIMENTO,
} from "./dadosPessoais";

/**
 * Dados pessoais e endereço na ficha do colaborador (T177, Módulo 1) — só
 * LEITURA, com o que o servidor gravou. Cada abertura é uma consulta auditada
 * no servidor.
 *
 * Fica na ficha porque a ficha é consulta e edição delimitada (decisão do
 * `DP-FLX-21`). O cadastro destes dados é feito na página de Nova admissão.
 *
 * Perfil sem acesso (o `master_tecnico`, por exemplo, lê a ficha mas não estas
 * categorias) recebe a recusa do servidor e vê um aviso, nunca um valor.
 */
type Carga =
  | { status: "carregando" }
  | { status: "erro"; mensagem: string }
  | { status: "dados"; dados: DadosPessoaisDoColaboradorApi };

function mensagemDaRecusa(erro: unknown): string {
  const status = erro instanceof ApiError ? erro.status : null;
  if (status === 403 || status === 404) {
    return "Seu perfil não tem acesso aos dados pessoais e ao endereço deste colaborador.";
  }
  return "Não foi possível carregar os dados pessoais e o endereço agora.";
}

export function DadosPessoaisColaboradorSecao({
  colaboradorId,
}: {
  readonly colaboradorId: string;
}) {
  const [carga, setCarga] = useState<Carga>({ status: "carregando" });

  useEffect(() => {
    let vigente = true;
    setCarga({ status: "carregando" });
    consultarDadosPessoaisDoColaborador(colaboradorId)
      .then((dados) => {
        if (vigente && dados.colaboradorId === colaboradorId) {
          setCarga({ status: "dados", dados });
        }
      })
      .catch((erro: unknown) => {
        if (vigente)
          setCarga({ status: "erro", mensagem: mensagemDaRecusa(erro) });
      });
    return () => {
      vigente = false;
    };
  }, [colaboradorId]);

  return (
    <section
      className="colaboradores-screen__dados-pessoais"
      aria-labelledby="dados-pessoais-colaborador-titulo"
    >
      <h3
        id="dados-pessoais-colaborador-titulo"
        className="colaboradores-screen__section-title"
      >
        Dados pessoais e endereço
      </h3>
      {carga.status === "carregando" ? (
        <p className="colaboradores-screen__carregando" role="status">
          Carregando dados pessoais…
        </p>
      ) : carga.status === "erro" ? (
        <p className="colaboradores-screen__contatos-aviso">{carga.mensagem}</p>
      ) : carga.dados.situacao === "bloqueado" ? (
        <p className="colaboradores-screen__contatos-aviso">
          O vínculo deste colaborador foi encerrado: o uso dos dados pessoais
          está bloqueado.
        </p>
      ) : carga.dados.situacao === "sem_registro" ? (
        <p className="colaboradores-screen__contatos-aviso">
          Nenhum dado pessoal ou endereço registrado.
        </p>
      ) : (
        <dl className="colaboradores-screen__dados-pessoais-lista">
          <div className="colaboradores-screen__par">
            <dt>{ROTULO_DATA_NASCIMENTO}</dt>
            <dd>
              {carga.dados.perfilPessoal?.dataNascimento
                ? formatarDiaCivil(carga.dados.perfilPessoal.dataNascimento)
                : "Não informado"}
            </dd>
          </div>
          {CAMPOS_TEXTO_PERFIL.map((c) => (
            <div key={c.chave} className="colaboradores-screen__par">
              <dt>{c.rotulo}</dt>
              <dd>{carga.dados.perfilPessoal?.[c.chave] ?? "Não informado"}</dd>
            </div>
          ))}
          {CAMPOS_ENDERECO.map((c) => (
            <div key={c.chave} className="colaboradores-screen__par">
              <dt>{c.rotulo}</dt>
              <dd>{carga.dados.endereco?.[c.chave] ?? "Não informado"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
