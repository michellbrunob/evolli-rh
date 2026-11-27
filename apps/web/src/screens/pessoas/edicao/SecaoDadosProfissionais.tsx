/**
 * T215 — seção "Dados profissionais" da página "Editar colaborador", com os
 * textos da referência:
 *
 * - **Cargo e estrutura:** a lotação vigente (cargo, departamento, área,
 *   centro de custo e unidade) aparece como está — mudar de lotação é uma
 *   movimentação, com data e histórico, e segue pelo Histórico funcional;
 *   nível e gestor direto são do contrato e se editam aqui.
 * - **Contrato:** tipo, admissão e desligamento são do vínculo (só leitura);
 *   jornada semanal, escala e matrícula se editam.
 * - **Remuneração:** o salário bruto é SÓ LEITURA (o período vigente da aba
 *   Salários); mudar é registrar uma alteração com data lá, com o atalho
 *   ao lado. O líquido é estimado na tela.
 * - **Informações adicionais:** conselho e registro, dependentes para IRRF e
 *   pensão.
 *
 * Os valores editáveis moram na página (um formulário só); esta seção só os
 * desenha e lê, sozinha, o que é só de leitura (lotação e gestores).
 */
import { type ReactNode, useEffect, useState } from "react";
import { listarColaboradores } from "../../../api/colaboradoresClient";
import type { ContratoDoColaboradorApi } from "../../../api/edicaoColaboradorClient";
import { listarAlocacoesVinculo } from "../../../api/vinculoContratualClient";
import { buscarCargo } from "../../../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarUnidades,
} from "../../../api/organizacaoClient";
import {
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../../components/cadastro/CadastroEmEtapas";
import { rotaDaFicha } from "../../../app/rotasDoShell";
import { formatarDiaCivil } from "../../../format/data";
import { ListaDeEscolha } from "../../../ui";
import {
  OPCOES_CONSELHO,
  OPCOES_ESCALA,
  OPCOES_NIVEL,
} from "../NovaAdmissaoScreen";
import {
  calcularSalarioLiquido,
  formatarReais,
  lerValorEmReais,
} from "../salarioLiquido";
import {
  type CampoProfissional,
  type ValoresProfissionais,
  MATRICULA_MAXIMO,
  ROTULO_DO_TIPO_DE_VINCULO,
} from "./dadosProfissionais";

interface Lotacao {
  readonly cargo: string;
  readonly departamento: string;
  readonly area: string;
  readonly centroCusto: string;
  readonly unidade: string;
}

const LOTACAO_VAZIA: Lotacao = {
  cargo: "",
  departamento: "",
  area: "",
  centroCusto: "",
  unidade: "",
};

interface OpcaoDeGestor {
  readonly id: string;
  readonly nome: string;
}

async function nomeNoCatalogo(
  id: string | null,
  listar: (consulta: {
    status: "ativo";
    tamanhoPagina: number;
  }) => Promise<{ itens?: readonly { id: string; nome: string }[] }>,
): Promise<string> {
  if (!id) return "";
  const pagina = await listar({ status: "ativo", tamanhoPagina: 100 });
  return pagina.itens?.find((i) => i.id === id)?.nome ?? "";
}

export function SecaoDadosProfissionais({
  colaboradorId,
  contrato,
  valores,
  onAlterar,
  propsDoCampo,
  erroDe,
}: {
  readonly colaboradorId: string;
  readonly contrato: ContratoDoColaboradorApi;
  readonly valores: ValoresProfissionais;
  readonly onAlterar: (campo: CampoProfissional, valor: string) => void;
  readonly propsDoCampo: (campo: CampoProfissional) => {
    readonly id: string;
  } & Record<string, unknown>;
  readonly erroDe: (campo: CampoProfissional) => ReactNode;
}) {
  const [lotacao, setLotacao] = useState<Lotacao>(LOTACAO_VAZIA);
  const [gestores, setGestores] = useState<OpcaoDeGestor[]>([]);
  const vinculoId = contrato.vinculo.id;

  // A lotação vigente do vínculo principal, com os nomes.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const alocacoes = await listarAlocacoesVinculo(vinculoId);
        const vigente = alocacoes.find((a) => a.vigenteAte === null);
        if (!vigente) return;
        const [cargo, departamento, area, centroCusto, unidade] =
          await Promise.all([
            vigente.cargoId
              ? buscarCargo(vigente.cargoId).then((c) => c.nome)
              : "",
            vigente.departamentoId
              ? buscarDepartamento(vigente.departamentoId).then((d) => d.nome)
              : "",
            nomeNoCatalogo(vigente.areaId, listarAreas as never),
            nomeNoCatalogo(vigente.centroCustoId, listarCentrosCusto as never),
            nomeNoCatalogo(
              vigente.unidadeOrganizacionalId,
              listarUnidades as never,
            ),
          ]);
        if (vivo)
          setLotacao({ cargo, departamento, area, centroCusto, unidade });
      } catch {
        // Sem a lotação, os campos ficam vazios; o resto da seção segue.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vinculoId]);

  // Gestor direto: as pessoas da empresa ativa, menos a própria.
  useEffect(() => {
    let vivo = true;
    void Promise.resolve(listarColaboradores({ tamanhoPagina: 100 }))
      .then((pagina) => {
        if (!vivo) return;
        setGestores(
          (pagina?.itens ?? [])
            .filter((c) => c.id !== colaboradorId)
            .map((c) => ({ id: c.id, nome: c.nome })),
        );
      })
      .catch(() => {
        if (vivo) setGestores([]);
      });
    return () => {
      vivo = false;
    };
  }, [colaboradorId]);

  const bruto = lerValorEmReais(valores.salarioBruto);
  const liquido =
    bruto === null
      ? null
      : calcularSalarioLiquido({
          bruto,
          dependentes: Number(valores.dependentesIrrf) || 0,
          pensaoPercentual:
            Number(valores.pensaoAlimenticiaPercentual.replace(",", ".")) || 0,
        });
  const semConselho =
    valores.conselhoProfissional === "" ||
    valores.conselhoProfissional === "nenhum";
  const gestorGravadoForaDaLista =
    valores.gestorDiretoId !== "" &&
    !gestores.some((g) => g.id === valores.gestorDiretoId);
  const vinculo = contrato.vinculo;

  return (
    <>
      <SecaoDoCadastro
        titulo="Cargo e estrutura"
        descricao="Onde a pessoa está na organização."
      >
        <LinhaDoCadastro rotulo="Cargo e nível">
          <div className="editar-colaborador__par">
            <div className="cadastro-etapas__linha-celula">
              <input
                type="text"
                readOnly
                aria-label="Cargo"
                placeholder="Sem cargo"
                value={lotacao.cargo}
              />
            </div>
            <div className="cadastro-etapas__linha-celula">
              <ListaDeEscolha
                aria-label="Nível"
                vazio="Nível"
                valor={valores.nivel}
                opcoes={OPCOES_NIVEL.map((o) => ({
                  valor: o.codigo,
                  rotulo: o.rotulo,
                }))}
                onMudar={(v) => onAlterar("nivel", v)}
              />
            </div>
          </div>
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="Departamento e área">
          <div className="editar-colaborador__par">
            <div className="cadastro-etapas__linha-celula">
              <input
                type="text"
                readOnly
                aria-label="Departamento"
                placeholder="Sem departamento"
                value={lotacao.departamento}
              />
            </div>
            <div className="cadastro-etapas__linha-celula">
              <input
                type="text"
                readOnly
                aria-label="Área"
                placeholder="Sem área"
                value={lotacao.area}
              />
            </div>
          </div>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Centro de custo"
          paraId={`${propsDoCampo("nivel").id}-centro`}
        >
          <input
            id={`${propsDoCampo("nivel").id}-centro`}
            type="text"
            readOnly
            placeholder="Sem centro de custo"
            value={lotacao.centroCusto}
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Unidade"
          ajuda="Filial, loja ou local de trabalho."
          paraId={`${propsDoCampo("nivel").id}-unidade`}
        >
          <input
            id={`${propsDoCampo("nivel").id}-unidade`}
            type="text"
            readOnly
            placeholder="Sem unidade"
            value={lotacao.unidade}
          />
        </LinhaDoCadastro>
        <p className="cadastro-etapas__linha-ajuda editar-colaborador__nota">
          Para mudar cargo ou lotação, registre uma movimentação no Histórico
          funcional.
        </p>
        <LinhaDoCadastro
          rotulo="Gestor direto"
          ajuda="Recebe as solicitações da pessoa."
          paraId={propsDoCampo("gestorDiretoId").id}
        >
          <ListaDeEscolha
            vazio="Selecione"
            valor={valores.gestorDiretoId}
            opcoes={[
              { valor: "", rotulo: "Sem gestor direto" },
              ...(gestorGravadoForaDaLista
                ? [{ valor: valores.gestorDiretoId, rotulo: "Gestor atual" }]
                : []),
              ...gestores.map((g) => ({ valor: g.id, rotulo: g.nome })),
            ]}
            onMudar={(v) => onAlterar("gestorDiretoId", v)}
            {...propsDoCampo("gestorDiretoId")}
          />
          {erroDe("gestorDiretoId")}
        </LinhaDoCadastro>
      </SecaoDoCadastro>

      <SecaoDoCadastro
        titulo="Contrato"
        descricao="Tipo de vínculo, admissão, jornada, escala e matrícula."
      >
        <LinhaDoCadastro
          rotulo="Tipo de contratação"
          paraId={`${propsDoCampo("nivel").id}-tipo`}
        >
          <input
            id={`${propsDoCampo("nivel").id}-tipo`}
            type="text"
            readOnly
            value={ROTULO_DO_TIPO_DE_VINCULO[vinculo.tipo] ?? vinculo.tipo}
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Data de admissão"
          paraId={`${propsDoCampo("nivel").id}-admissao`}
        >
          <input
            id={`${propsDoCampo("nivel").id}-admissao`}
            type="text"
            readOnly
            value={formatarDiaCivil(vinculo.dataAdmissao)}
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Data de desligamento"
          ajuda="Deixe vazio se a pessoa trabalha na empresa. Apagar a data de quem está desligado volta a situação para Ativo."
          paraId={`${propsDoCampo("nivel").id}-desligamento`}
        >
          <input
            id={`${propsDoCampo("nivel").id}-desligamento`}
            type="text"
            readOnly
            placeholder="dd/mm/aaaa"
            value={
              vinculo.dataDesligamento
                ? formatarDiaCivil(vinculo.dataDesligamento)
                : ""
            }
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Jornada de trabalho"
          paraId={propsDoCampo("jornadaSemanalHoras").id}
        >
          <div className="cadastro-etapas__com-sufixo">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="44"
              value={valores.jornadaSemanalHoras}
              onChange={(e) =>
                onAlterar(
                  "jornadaSemanalHoras",
                  e.target.value.replace(/\D/g, ""),
                )
              }
              {...propsDoCampo("jornadaSemanalHoras")}
            />
            <span aria-hidden="true">horas por semana</span>
          </div>
          {erroDe("jornadaSemanalHoras")}
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Escala de trabalho"
          ajuda="Sem escala, os benefícios usam os dias úteis do mês."
          paraId={propsDoCampo("escala").id}
        >
          <ListaDeEscolha
            vazio="Selecione a escala"
            valor={valores.escala}
            opcoes={OPCOES_ESCALA.map((o) => ({
              valor: o.codigo,
              rotulo: o.nome,
              ...(o.descricao ? { descricao: o.descricao } : {}),
            }))}
            onMudar={(v) => onAlterar("escala", v)}
            {...propsDoCampo("escala")}
          />
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Matrícula"
          paraId={propsDoCampo("matricula").id}
        >
          <input
            type="text"
            maxLength={MATRICULA_MAXIMO}
            autoComplete="off"
            placeholder="Ex.: 000123"
            value={valores.matricula}
            onChange={(e) =>
              onAlterar("matricula", e.target.value.toUpperCase())
            }
            {...propsDoCampo("matricula")}
          />
          {erroDe("matricula")}
        </LinhaDoCadastro>
      </SecaoDoCadastro>

      <SecaoDoCadastro
        titulo="Remuneração"
        descricao="Valores mensais usados na folha."
      >
        <LinhaDoCadastro
          rotulo="Salário bruto"
          ajuda="O salário vigente, da aba Salários."
          paraId={propsDoCampo("salarioBruto").id}
        >
          <div className="cadastro-etapas__com-prefixo">
            <span aria-hidden="true">R$</span>
            <input
              type="text"
              readOnly
              placeholder="—"
              value={valores.salarioBruto}
              {...propsDoCampo("salarioBruto")}
            />
          </div>
          {erroDe("salarioBruto")}
          <p className="cadastro-etapas__linha-ajuda editar-colaborador__nota">
            Para mudar o salário, registre uma alteração com data na{" "}
            <a href={rotaDaFicha({ colaboradorId, aba: "salarios" })}>
              aba Salários
            </a>
            . O valor anterior fica no histórico.
          </p>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Salário líquido"
          ajuda="Calculado a partir do bruto."
          paraId={`${propsDoCampo("salarioBruto").id}-liquido`}
        >
          <div className="cadastro-etapas__com-prefixo">
            <span aria-hidden="true">R$</span>
            <input
              id={`${propsDoCampo("salarioBruto").id}-liquido`}
              type="text"
              readOnly
              placeholder="—"
              value={liquido === null ? "" : formatarReais(liquido)}
            />
          </div>
        </LinhaDoCadastro>
      </SecaoDoCadastro>

      <SecaoDoCadastro
        titulo="Informações adicionais"
        descricao="Registro profissional e deduções."
      >
        <LinhaDoCadastro
          rotulo="Conselho e registro"
          ajuda="Obrigatório para algumas profissões."
        >
          <div className="editar-colaborador__par">
            <div className="cadastro-etapas__linha-celula">
              <ListaDeEscolha
                aria-label="Conselho"
                vazio="Selecione"
                valor={valores.conselhoProfissional}
                opcoes={OPCOES_CONSELHO.map((o) => ({
                  valor: o.codigo,
                  rotulo: o.rotulo,
                }))}
                onMudar={(v) => {
                  onAlterar("conselhoProfissional", v);
                  if (!v || v === "nenhum") {
                    onAlterar("registroProfissional", "");
                  }
                }}
              />
            </div>
            <div className="cadastro-etapas__linha-celula">
              <input
                type="text"
                maxLength={40}
                autoComplete="off"
                placeholder="Ex.: 123456/SP"
                aria-label="Número do registro"
                disabled={semConselho}
                value={valores.registroProfissional}
                onChange={(e) =>
                  onAlterar("registroProfissional", e.target.value)
                }
                {...propsDoCampo("registroProfissional")}
              />
              {erroDe("registroProfissional")}
            </div>
          </div>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Dependentes (IRRF)"
          paraId={propsDoCampo("dependentesIrrf").id}
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="0"
            value={valores.dependentesIrrf}
            onChange={(e) =>
              onAlterar("dependentesIrrf", e.target.value.replace(/\D/g, ""))
            }
            {...propsDoCampo("dependentesIrrf")}
          />
          {erroDe("dependentesIrrf")}
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Pensão alimentícia"
          paraId={propsDoCampo("pensaoAlimenticiaPercentual").id}
        >
          <div className="cadastro-etapas__com-sufixo">
            <input
              type="text"
              inputMode="decimal"
              maxLength={6}
              placeholder="0"
              value={valores.pensaoAlimenticiaPercentual}
              onChange={(e) =>
                onAlterar(
                  "pensaoAlimenticiaPercentual",
                  e.target.value.replace(/[^\d,]/g, ""),
                )
              }
              {...propsDoCampo("pensaoAlimenticiaPercentual")}
            />
            <span aria-hidden="true">%</span>
          </div>
          {erroDe("pensaoAlimenticiaPercentual")}
        </LinhaDoCadastro>
      </SecaoDoCadastro>
    </>
  );
}
