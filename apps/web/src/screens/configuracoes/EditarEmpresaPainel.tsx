/**
 * T209 — editar a empresa no painel lateral (o mesmo `Sheet` do "Adicionar
 * colaborador"): cabeçalho com o nome e "CNPJ · Principal"; seção Empresa
 * (razão social, CNPJ e porte) e seção Endereço (CEP que preenche o resto,
 * logradouro, número e complemento, bairro, cidade e UF); rodapé com Cancelar
 * e Salvar. Fechar com alteração pede confirmação (o próprio `Sheet`).
 */
import { useEffect, useRef, useState } from "react";
import { Building2, Check } from "lucide-react";
import { CampoMascarado } from "../../components";
import { Button, Sheet } from "../../ui";
import {
  EmpresasApiError,
  atualizarEmpresa,
  type EmpresaCadastradaApi,
  type EmpresaDaContaApi,
  type PorteDeEmpresa,
} from "../../api/empresasClient";
import { cnpjValido, formatarCnpj, mascararCnpj } from "../../format/cnpj";
import { useCepAssistido } from "../pessoas/cepAssistido";
import {
  ENDERECO_INICIAL,
  type ValoresEndereco,
} from "../pessoas/dadosPessoais";
import { UFS, siglaDaUf } from "../pessoas/ufs";
import { OPCOES_DE_PORTE } from "./NovaEmpresaScreen";
import "./EditarEmpresaPainel.css";

type CampoComErro = "cnpj" | "nome";

const ID = {
  nome: "editar-empresa-nome",
  cnpj: "editar-empresa-cnpj",
  porte: "editar-empresa-porte",
  cep: "editar-empresa-cep",
  logradouro: "editar-empresa-logradouro",
  numero: "editar-empresa-numero",
  complemento: "editar-empresa-complemento",
  bairro: "editar-empresa-bairro",
  cidade: "editar-empresa-cidade",
  uf: "editar-empresa-uf",
} as const;

function enderecoDe(e: EmpresaDaContaApi): ValoresEndereco {
  return {
    ...ENDERECO_INICIAL,
    cep: e.cep ? `${e.cep.slice(0, 5)}-${e.cep.slice(5)}` : "",
    logradouro: e.logradouro ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    cidade: e.cidade ?? "",
    estado: e.uf ?? "",
  };
}

export function EditarEmpresaPainel({
  empresa,
  onFechar,
  onSalva,
}: {
  readonly empresa: EmpresaDaContaApi;
  readonly onFechar: () => void;
  readonly onSalva: (empresa: EmpresaCadastradaApi) => void;
}) {
  const inicial = useRef({
    nome: empresa.nome,
    cnpj: empresa.cnpj ? formatarCnpj(empresa.cnpj) : "",
    porte: (empresa.porte ?? "") as PorteDeEmpresa | "",
    endereco: enderecoDe(empresa),
  });
  const [nome, setNome] = useState(inicial.current.nome);
  const [cnpj, setCnpj] = useState(inicial.current.cnpj);
  const [porte, setPorte] = useState<PorteDeEmpresa | "">(
    inicial.current.porte,
  );
  const [endereco, setEndereco] = useState<ValoresEndereco>(
    inicial.current.endereco,
  );
  const [erros, setErros] = useState<Partial<Record<CampoComErro, string>>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const focarRef = useRef<CampoComErro | null>(null);
  const consultarAoCompletarRef = useRef(false);

  const alterado =
    nome !== inicial.current.nome ||
    cnpj !== inicial.current.cnpj ||
    porte !== inicial.current.porte ||
    JSON.stringify(endereco) !== JSON.stringify(inicial.current.endereco);

  const consultaCep = useCepAssistido({
    endereco,
    setEndereco: (acao) =>
      setEndereco((prev) => {
        const proximo = typeof acao === "function" ? acao(prev) : acao;
        return { ...proximo, estado: siglaDaUf(proximo.estado) };
      }),
    onErroNoCep: () => {},
    onCamposAjustados: () => {},
    idBotaoBuscar: ID.cep,
  });
  const cep = consultaCep.estado;
  const buscarCep = consultaCep.buscar;
  useEffect(() => {
    if (!consultarAoCompletarRef.current) return;
    consultarAoCompletarRef.current = false;
    void buscarCep("botao");
  }, [endereco.cep, buscarCep]);

  useEffect(() => {
    const alvo = focarRef.current;
    if (alvo === null) return;
    focarRef.current = null;
    document.getElementById(ID[alvo])?.focus();
  });

  function atualizarEndereco(campo: keyof ValoresEndereco, valor: string) {
    setEndereco((prev) => ({ ...prev, [campo]: valor }));
    if (campo === "cep") consultaCep.descartarResultado();
  }

  const nomeLimpo = nome.trim().replace(/\s+/g, " ");
  const cnpjOk = cnpjValido(cnpj);

  async function salvar() {
    if (salvandoRef.current) return;
    const novos: Partial<Record<CampoComErro, string>> = {};
    if (cnpj.trim() === "") novos.cnpj = "CNPJ é obrigatório";
    else if (!cnpjOk) novos.cnpj = "CNPJ inválido. Confira os números.";
    if (nomeLimpo === "") novos.nome = "Informe o nome da empresa";
    setErros(novos);
    const primeiro = (["cnpj", "nome"] as const).find((c) => novos[c]);
    if (primeiro) {
      focarRef.current = primeiro;
      return;
    }
    const e = endereco;
    const enderecoDto = Object.fromEntries(
      (
        [
          ["cep", e.cep.replace(/\D/g, "")],
          ["logradouro", e.logradouro.trim()],
          ["numero", e.numero.trim()],
          ["complemento", e.complemento.trim()],
          ["bairro", e.bairro.trim()],
          ["cidade", e.cidade.trim()],
          ["uf", siglaDaUf(e.estado)],
        ] as const
      ).filter(([, v]) => v !== ""),
    );
    salvandoRef.current = true;
    setSalvando(true);
    setFalha(null);
    try {
      const salva = await atualizarEmpresa(empresa.id, {
        cnpj: cnpj.replace(/[^0-9A-Za-z]/g, "").toUpperCase(),
        nome: nomeLimpo,
        ...(porte ? { porte } : {}),
        ...(Object.keys(enderecoDto).length > 0
          ? { endereco: enderecoDto }
          : {}),
      });
      onSalva(salva);
    } catch (erro) {
      const doCnpj =
        erro instanceof EmpresasApiError
          ? erro.erros.find((x) => x.campo === "cnpj")
          : undefined;
      if (doCnpj) {
        setErros({
          cnpj:
            doCnpj.motivo === "em_uso"
              ? "Este CNPJ já está cadastrado."
              : "CNPJ inválido. Confira os números.",
        });
        focarRef.current = "cnpj";
      } else {
        setFalha("Não foi possível salvar agora. Tente de novo.");
      }
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  const erroDe = (campo: CampoComErro) =>
    erros[campo] ? (
      <p id={`${ID[campo]}-erro`} className="editar-empresa__erro">
        {erros[campo]}
      </p>
    ) : null;
  const propsDe = (campo: CampoComErro) => ({
    id: ID[campo],
    "aria-invalid": erros[campo] ? ("true" as const) : undefined,
    "aria-describedby": erros[campo] ? `${ID[campo]}-erro` : undefined,
  });

  const subtitulo = [
    empresa.cnpj ? formatarCnpj(empresa.cnpj) : "Sem CNPJ",
    empresa.principal ? "Principal" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      aberto
      titulo={empresa.nome}
      descricao={subtitulo}
      icone={<Building2 size={18} />}
      onFechar={onFechar}
      alterado={alterado}
      bloqueado={salvando}
      className="editar-empresa"
      rodape={
        <div className="editar-empresa__rodape">
          <Button variant="secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <form
        className="editar-empresa__form"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <p className="editar-empresa__secao">Empresa</p>
        <div className="editar-empresa__campo">
          <label htmlFor={ID.nome}>
            Razão social ou nome
            <span className="editar-empresa__obrigatorio" aria-hidden="true">
              {" "}
              *
            </span>
          </label>
          <input
            type="text"
            maxLength={160}
            autoComplete="off"
            aria-required="true"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErros(({ nome: _n, ...resto }) => resto);
            }}
            {...propsDe("nome")}
          />
          {erroDe("nome")}
        </div>
        <div className="editar-empresa__linha editar-empresa__linha--2">
          <div className="editar-empresa__campo">
            <label htmlFor={ID.cnpj}>
              CNPJ
              <span className="editar-empresa__obrigatorio" aria-hidden="true">
                {" "}
                *
              </span>
            </label>
            <input
              type="text"
              autoComplete="off"
              maxLength={18}
              placeholder="00.000.000/0000-00"
              aria-required="true"
              value={cnpj}
              onChange={(e) => {
                setCnpj(mascararCnpj(e.target.value));
                setErros(({ cnpj: _c, ...resto }) => resto);
              }}
              {...propsDe("cnpj")}
            />
            {erroDe("cnpj")}
          </div>
          <div className="editar-empresa__campo">
            <label htmlFor={ID.porte}>Porte</label>
            <select
              id={ID.porte}
              value={porte}
              onChange={(e) => setPorte(e.target.value as PorteDeEmpresa | "")}
            >
              <option value="">Selecione</option>
              {OPCOES_DE_PORTE.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="editar-empresa__secao">Endereço</p>
        <div className="editar-empresa__campo editar-empresa__campo--cep">
          <label htmlFor={ID.cep}>CEP</label>
          <CampoMascarado
            id={ID.cep}
            mascara="cep"
            placeholder="00000-000"
            value={endereco.cep}
            onValorChange={(valor) => {
              atualizarEndereco("cep", valor);
              if (/^\d{8}$/.test(valor.replace(/\D/g, ""))) {
                consultarAoCompletarRef.current = true;
              }
            }}
            onBlur={() => void buscarCep("saida")}
          />
          <p
            className={
              cep.tipo === "sugerido" && cep.encontrado
                ? "editar-empresa__cep editar-empresa__cep--encontrado"
                : "editar-empresa__cep"
            }
            role="status"
          >
            {cep.tipo === "buscando" ? (
              "Buscando endereço…"
            ) : cep.tipo === "sugerido" && cep.encontrado ? (
              <>
                <Check size={14} aria-hidden="true" />
                Endereço encontrado
              </>
            ) : cep.tipo === "aviso" || cep.tipo === "sugerido" ? (
              cep.mensagem
            ) : (
              ""
            )}
          </p>
        </div>
        <div className="editar-empresa__campo">
          <label htmlFor={ID.logradouro}>Logradouro</label>
          <input
            id={ID.logradouro}
            type="text"
            maxLength={200}
            autoComplete="off"
            value={endereco.logradouro}
            onChange={(e) => atualizarEndereco("logradouro", e.target.value)}
          />
        </div>
        <div className="editar-empresa__linha editar-empresa__linha--numero">
          <div className="editar-empresa__campo">
            <label htmlFor={ID.numero}>Número</label>
            <input
              id={ID.numero}
              type="text"
              maxLength={20}
              autoComplete="off"
              value={endereco.numero}
              onChange={(e) => atualizarEndereco("numero", e.target.value)}
            />
          </div>
          <div className="editar-empresa__campo">
            <label htmlFor={ID.complemento}>Complemento</label>
            <input
              id={ID.complemento}
              type="text"
              maxLength={120}
              autoComplete="off"
              value={endereco.complemento}
              onChange={(e) => atualizarEndereco("complemento", e.target.value)}
            />
          </div>
        </div>
        <div className="editar-empresa__linha editar-empresa__linha--cidade">
          <div className="editar-empresa__campo">
            <label htmlFor={ID.bairro}>Bairro</label>
            <input
              id={ID.bairro}
              type="text"
              maxLength={120}
              autoComplete="off"
              value={endereco.bairro}
              onChange={(e) => atualizarEndereco("bairro", e.target.value)}
            />
          </div>
          <div className="editar-empresa__campo">
            <label htmlFor={ID.cidade}>Cidade</label>
            <input
              id={ID.cidade}
              type="text"
              maxLength={120}
              autoComplete="off"
              value={endereco.cidade}
              onChange={(e) => atualizarEndereco("cidade", e.target.value)}
            />
          </div>
          <div className="editar-empresa__campo">
            <label htmlFor={ID.uf}>UF</label>
            <select
              id={ID.uf}
              value={siglaDaUf(endereco.estado)}
              onChange={(e) => atualizarEndereco("estado", e.target.value)}
            >
              <option value="">Selecione</option>
              {UFS.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.sigla}
                </option>
              ))}
            </select>
          </div>
        </div>
        {falha ? (
          <p className="editar-empresa__erro" role="alert">
            {falha}
          </p>
        ) : null}
        {/* Enter num campo salva (envio implícito do formulário). */}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </Sheet>
  );
}
