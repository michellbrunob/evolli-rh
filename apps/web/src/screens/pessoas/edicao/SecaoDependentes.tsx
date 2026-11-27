/**
 * T215 — Editar colaborador › Dependentes (como a referência): filhos,
 * cônjuge e outras pessoas vinculadas para o plano de saúde e os
 * benefícios. Nome, parentesco, nascimento (com a idade), CPF, telefone e
 * e-mail. Cada dependente é gravado na hora (o rodapé da página continua
 * cuidando das outras seções); remover tira a pessoa de todo plano a partir
 * do mês atual.
 */
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import type {
  DependenteApi,
  DependenteDto,
} from "../../../api/beneficiosClient";
import {
  alterarDependente,
  criarDependente,
  listarDependentes,
  removerDependente,
} from "../../../api/beneficiosClient";
import { ApiError } from "../../../api/colaboradoresClient";
import { Button, FormActions } from "../../../components";
import { LinhaDoCadastro } from "../../../components/cadastro/CadastroEmEtapas";
import { diaCivilDeHoje, formatarDiaCivil } from "../../../format/data";
import { exibirTelefone } from "../../../format/mascaras";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ListaDeEscolha,
} from "../../../ui";
import { IconeMais, IconeMaisAcoes } from "../../../ui/icones";
import {
  PARENTESCOS,
  rotuloDoParentesco,
} from "../../beneficios/textosDosBeneficios";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import { iniciaisDe } from "../iniciais";

export interface ServicoDeDependentes {
  readonly listar: (
    colaboradorId: string,
  ) => Promise<{ dependentes: DependenteApi[] }>;
  readonly criar: (
    colaboradorId: string,
    dto: DependenteDto,
  ) => Promise<DependenteApi>;
  readonly alterar: (
    colaboradorId: string,
    id: string,
    dto: DependenteDto,
  ) => Promise<DependenteApi>;
  readonly remover: (colaboradorId: string, id: string) => Promise<unknown>;
}

const DO_SERVIDOR: ServicoDeDependentes = {
  listar: listarDependentes,
  criar: criarDependente,
  alterar: alterarDependente,
  remover: removerDependente,
};

const VAZIO: DependenteDto = {
  nome: "",
  parentesco: "",
  dataNascimento: null,
  cpf: null,
  telefone: null,
  email: null,
};

/** Idade completa em anos no dia de hoje. */
export function idadeHoje(nascimento: string, hoje = diaCivilDeHoje()): number {
  const [a, m, d] = nascimento.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [ha, hm, hd] = hoje.split("-").map(Number) as [number, number, number];
  let idade = ha - a;
  if (hm < m || (hm === m && hd < d)) idade -= 1;
  return idade;
}

const anos = (n: number) => (n === 1 ? "1 ano" : `${n} anos`);

const MENSAGEM_DO_CAMPO: Readonly<Record<string, string>> = {
  nome: "Informe o nome completo.",
  parentesco: "Escolha o grau de parentesco.",
  dataNascimento: "Data de nascimento inválida.",
  cpf: "CPF inválido.",
  telefone: "Telefone inválido: use DDD e número.",
  email: "E-mail inválido.",
};

export function SecaoDependentes({
  colaboradorId,
  podeOperar,
  servico = DO_SERVIDOR,
}: {
  readonly colaboradorId: string;
  readonly podeOperar: boolean;
  readonly servico?: ServicoDeDependentes;
}) {
  const id = useId();
  const [lista, setLista] = useState<DependenteApi[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<DependenteDto>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<DependenteApi | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [falhaAoRemover, setFalhaAoRemover] = useState<string | null>(null);
  const [formInicial, setFormInicial] = useState<DependenteDto>(VAZIO);
  // Formulário aberto e mexido: sair da página pergunta antes (guarda global).
  useEdicaoEmAndamento("Dependente", {
    pendente:
      editando !== null && JSON.stringify(form) !== JSON.stringify(formInicial),
    salvando,
  });

  const carregar = useCallback(async () => {
    try {
      setLista((await servico.listar(colaboradorId)).dependentes);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [servico, colaboradorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrir = (d: DependenteApi | null) => {
    setErros({});
    setAviso(null);
    setEditando(d ? d.id : "novo");
    const inicial: DependenteDto = d
      ? {
          nome: d.nome,
          parentesco: d.parentesco,
          dataNascimento: d.dataNascimento,
          cpf: d.cpf,
          telefone: d.telefone ? exibirTelefone(d.telefone) : null,
          email: d.email,
        }
      : VAZIO;
    setForm(inicial);
    setFormInicial(inicial);
  };

  async function salvar() {
    const faltando: Record<string, string> = {};
    if (!form.nome.trim()) faltando.nome = MENSAGEM_DO_CAMPO.nome!;
    if (!form.parentesco) faltando.parentesco = MENSAGEM_DO_CAMPO.parentesco!;
    if (Object.keys(faltando).length) {
      setErros(faltando);
      return;
    }
    setSalvando(true);
    try {
      if (editando === "novo") await servico.criar(colaboradorId, form);
      else if (editando) await servico.alterar(colaboradorId, editando, form);
      setAviso(
        editando === "novo" ? "Dependente adicionado." : "Dependente salvo.",
      );
      setEditando(null);
      await carregar();
    } catch (e) {
      const campos =
        e instanceof ApiError && e.status === 422 ? (e.erros ?? []) : [];
      if (campos.length) {
        setErros(
          Object.fromEntries(
            campos.map((c) => [
              c.campo,
              MENSAGEM_DO_CAMPO[c.campo] ?? "Valor inválido.",
            ]),
          ),
        );
      } else {
        setErros({
          geral: "Não foi possível salvar o dependente. Tente de novo.",
        });
      }
    } finally {
      setSalvando(false);
    }
  }

  // Enter num campo do dependente não envia o formulário da página.
  const segurarEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      void salvar();
    }
  };

  const erro = (campo: string) =>
    erros[campo] ? (
      <p className="editar-colaborador__erro-campo" id={`${id}-${campo}-erro`}>
        {erros[campo]}
      </p>
    ) : null;

  const idade =
    form.dataNascimento && /^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento)
      ? idadeHoje(form.dataNascimento)
      : null;

  const formulario = (
    <div className="dependentes__form" onKeyDown={segurarEnter}>
      <div className="dependentes__form-cabeca">
        <div>
          <h4>
            {editando === "novo" ? "Novo dependente" : "Editar dependente"}
          </h4>
          <p className="dependentes__suave">
            Preencha os dados e salve para adicionar à lista.
          </p>
        </div>
      </div>
      <LinhaDoCadastro rotulo="Nome completo" paraId={`${id}-nome`}>
        <input
          id={`${id}-nome`}
          className="dependentes__campo"
          placeholder="Nome do dependente"
          maxLength={160}
          value={form.nome}
          aria-invalid={!!erros.nome || undefined}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        {erro("nome")}
      </LinhaDoCadastro>
      <LinhaDoCadastro rotulo="Grau de parentesco" grupo={false}>
        <ListaDeEscolha
          id={`${id}-parentesco`}
          aria-label="Grau de parentesco"
          vazio="Selecione"
          valor={form.parentesco}
          onMudar={(v) =>
            setForm({ ...form, parentesco: v as DependenteDto["parentesco"] })
          }
          opcoes={PARENTESCOS.map((p) => ({
            valor: p.valor,
            rotulo: p.rotulo,
          }))}
        />
        {erro("parentesco")}
      </LinhaDoCadastro>
      <LinhaDoCadastro rotulo="Data de nascimento" paraId={`${id}-nasc`}>
        <span className="dependentes__com-sufixo">
          <input
            id={`${id}-nasc`}
            type="date"
            className="dependentes__campo"
            max={diaCivilDeHoje()}
            value={form.dataNascimento ?? ""}
            onChange={(e) =>
              setForm({ ...form, dataNascimento: e.target.value || null })
            }
          />
          {idade !== null && idade >= 0 ? (
            <span className="dependentes__suave">{anos(idade)}</span>
          ) : null}
        </span>
        {erro("dataNascimento")}
      </LinhaDoCadastro>
      <LinhaDoCadastro rotulo="CPF e telefone">
        <div className="dependentes__lado-a-lado">
          <input
            className="dependentes__campo"
            aria-label="CPF"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            value={form.cpf ?? ""}
            onChange={(e) => setForm({ ...form, cpf: e.target.value || null })}
          />
          <input
            className="dependentes__campo"
            aria-label="Telefone"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            maxLength={16}
            value={form.telefone ?? ""}
            onChange={(e) =>
              setForm({ ...form, telefone: e.target.value || null })
            }
          />
        </div>
        {erro("cpf")}
        {erro("telefone")}
      </LinhaDoCadastro>
      <LinhaDoCadastro rotulo="E-mail" ajuda="Opcional." paraId={`${id}-email`}>
        <input
          id={`${id}-email`}
          type="email"
          className="dependentes__campo"
          placeholder="email@exemplo.com"
          value={form.email ?? ""}
          onChange={(e) => setForm({ ...form, email: e.target.value || null })}
        />
        {erro("email")}
      </LinhaDoCadastro>
      {erros.geral ? (
        <p className="editar-colaborador__erro-campo" role="alert">
          {erros.geral}
        </p>
      ) : null}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          disabled={salvando}
          onClick={() => setEditando(null)}
        >
          Cancelar
        </Button>
        <Button type="button" disabled={salvando} onClick={() => void salvar()}>
          {editando === "novo" ? "Adicionar dependente" : "Salvar dependente"}
        </Button>
      </FormActions>
    </div>
  );

  return (
    <div className="dependentes">
      {podeOperar && editando === null ? (
        <div className="dependentes__acao">
          <Button type="button" variant="secondary" onClick={() => abrir(null)}>
            <IconeMais tamanho={16} />
            Adicionar dependente
          </Button>
        </div>
      ) : null}
      {aviso ? (
        <p className="dependentes__aviso" role="status">
          {aviso}
        </p>
      ) : null}
      {falhou ? (
        <div role="alert">
          <p>Não foi possível carregar os dependentes.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void carregar()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : lista === null ? (
        <p className="dependentes__suave" role="status">
          Carregando os dependentes…
        </p>
      ) : (
        <>
          {lista.length === 0 && editando === null ? (
            <div className="editar-colaborador__vazio">
              <p className="editar-colaborador__vazio-titulo">
                Nenhum dependente cadastrado
              </p>
              <p className="editar-colaborador__vazio-texto">
                Filhos, cônjuge e outras pessoas vinculadas para plano de saúde
                e benefícios.
              </p>
            </div>
          ) : (
            <ul className="dependentes__lista" aria-label="Dependentes">
              {lista.map((d) =>
                editando === d.id ? (
                  <li key={d.id}>{formulario}</li>
                ) : (
                  <li key={d.id} className="dependentes__item">
                    <span className="dependentes__avatar" aria-hidden="true">
                      {iniciaisDe(d.nome)}
                    </span>
                    <span className="dependentes__textos">
                      <span>
                        <strong>{d.nome}</strong>{" "}
                        <span className="dependentes__selo">
                          {rotuloDoParentesco(d.parentesco)}
                        </span>
                      </span>
                      <span className="dependentes__suave">
                        {d.dataNascimento
                          ? `${formatarDiaCivil(d.dataNascimento)} · ${anos(idadeHoje(d.dataNascimento))}`
                          : "Sem data de nascimento"}
                      </span>
                    </span>
                    {podeOperar && editando === null ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="dependentes__menu"
                          aria-label={`Ações de ${d.nome}`}
                        >
                          <IconeMaisAcoes tamanho={18} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => abrir(d)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="dependentes__perigo"
                            onSelect={() => setARemover(d)}
                          >
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          )}
          {editando === "novo" ? formulario : null}
        </>
      )}
      <Dialog
        aberto={aRemover !== null}
        titulo={aRemover ? `Remover ${aRemover.nome}?` : ""}
        descricao="A pessoa sai da lista de dependentes e de todo plano a partir deste mês. O histórico dos meses anteriores fica guardado."
        onFechar={() => setARemover(null)}
        rodape={
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setARemover(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={removendo}
              onClick={async () => {
                if (!aRemover || removendo) return;
                setRemovendo(true);
                setFalhaAoRemover(null);
                try {
                  await servico.remover(colaboradorId, aRemover.id);
                  setAviso(`${aRemover.nome} saiu da lista de dependentes.`);
                  setARemover(null);
                  await carregar();
                } catch {
                  setFalhaAoRemover(
                    "Não foi possível remover agora. Tente de novo.",
                  );
                } finally {
                  setRemovendo(false);
                }
              }}
            >
              Remover
            </Button>
          </FormActions>
        }
      >
        {falhaAoRemover ? (
          <p className="secao-dependentes__erro" role="alert">
            {falhaAoRemover}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
