import { BadRequestException } from "@nestjs/common";

/**
 * T209 — o que o rascunho da Nova admissão pode guardar: só os campos do
 * contrato atual da admissão (`AdmitirColaboradorDto` e Módulo 1), mais a
 * etapa em que a pessoa parou e as referências escolhidas (id, código e nome
 * de Departamento, Cargo, Unidade e Centro de custo — dado de catálogo, não
 * pessoal), para a tela mostrar o que estava escolhido.
 *
 * Fechado por lista: grupo ou campo fora dela, valor que não é texto, texto
 * longo ou com caractere de controle recusam o rascunho inteiro (400). Nada
 * de documento, foto ou arquivo. T209 — CPF, RG, gênero e contato de
 * emergência entraram com a etapa 1 do Novo colaborador. A recusa não repete
 * o valor.
 */
const CAMPOS_POR_GRUPO = {
  campos: [
    "nome",
    "matricula",
    "tipo",
    "dataAdmissao",
    "departamentoId",
    "cargoId",
    "unidadeId",
    "areaId",
    "equipeId",
    "centroCustoId",
    "tabelaHorarioId",
    // T209 — etapa 2: o cargo digitado (vira cargo do cadastro ao concluir).
    "cargoNome",
  ],
  perfil: [
    "dataNascimento",
    "cpf",
    "rg",
    "genero",
    "contatoEmergenciaNome",
    "contatoEmergenciaTelefone",
    "sexo",
    "saudacao",
    "estadoCivil",
    "nacionalidade",
    "naturalidade",
    "escolaridade",
    "curso",
    "nomePai",
    "nomeMae",
  ],
  endereco: [
    "pais",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
  ],
  contatos: ["emailPessoal", "celular", "telefone"],
  // T209 — etapa 2: o contrato da admissão, em texto como a tela o guarda.
  contrato: [
    "nivel",
    "gestorDiretoId",
    "jornadaSemanalHoras",
    "escala",
    "salarioBruto",
    "conselhoProfissional",
    "registroProfissional",
    "dependentesIrrf",
    "pensaoAlimenticiaPercentual",
  ],
} as const;

type Grupo = keyof typeof CAMPOS_POR_GRUPO;

const REFERENCIAS = [
  "departamento",
  "cargo",
  "unidade",
  "centroCusto",
] as const;
type ChaveDeReferencia = (typeof REFERENCIAS)[number];

export const LIMITE_DO_VALOR = 300;
const ULTIMA_ETAPA = 3;
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f]/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ReferenciaDoRascunho {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface DadosDoRascunho {
  etapa?: number;
  campos?: Record<string, string>;
  perfil?: Record<string, string>;
  endereco?: Record<string, string>;
  contatos?: Record<string, string>;
  contrato?: Record<string, string>;
  referencias?: Partial<Record<ChaveDeReferencia, ReferenciaDoRascunho>>;
}

function recusar(motivo: string): never {
  throw new BadRequestException({
    message: "Rascunho recusado.",
    erros: [{ campo: "dados", motivo }],
  });
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown, onde: string): string {
  if (typeof valor !== "string") recusar(`${onde}: só texto`);
  if (valor.length > LIMITE_DO_VALOR) recusar(`${onde}: longo demais`);
  if (CONTROLE.test(valor)) recusar(`${onde}: caractere não permitido`);
  return valor;
}

export function filtrarDadosDoRascunho(entrada: unknown): DadosDoRascunho {
  if (!ehObjeto(entrada)) recusar("o rascunho deve ser um objeto");
  const saida: DadosDoRascunho = {};

  for (const [chave, valor] of Object.entries(entrada)) {
    if (chave === "etapa") {
      if (
        typeof valor !== "number" ||
        !Number.isInteger(valor) ||
        valor < 0 ||
        valor > ULTIMA_ETAPA
      ) {
        recusar("etapa inválida");
      }
      saida.etapa = valor;
      continue;
    }

    if (chave === "referencias") {
      if (!ehObjeto(valor)) recusar("referências inválidas");
      const referencias: Partial<
        Record<ChaveDeReferencia, ReferenciaDoRascunho>
      > = {};
      for (const [nome, ref] of Object.entries(valor)) {
        if (!(REFERENCIAS as readonly string[]).includes(nome)) {
          recusar("referência não aceita");
        }
        if (!ehObjeto(ref)) recusar("referência inválida");
        const id = texto(ref.id, "referência");
        if (!UUID.test(id)) recusar("referência inválida");
        const extras = Object.keys(ref).filter(
          (k) => !["id", "codigo", "nome"].includes(k),
        );
        if (extras.length > 0) recusar("referência inválida");
        referencias[nome as ChaveDeReferencia] = {
          id,
          codigo: texto(ref.codigo, "referência"),
          nome: texto(ref.nome, "referência"),
        };
      }
      if (Object.keys(referencias).length > 0) saida.referencias = referencias;
      continue;
    }

    if (!(chave in CAMPOS_POR_GRUPO)) recusar("grupo não aceito");
    if (!ehObjeto(valor)) recusar("grupo inválido");
    const permitidos = CAMPOS_POR_GRUPO[chave as Grupo] as readonly string[];
    const grupo: Record<string, string> = {};
    for (const [campo, conteudo] of Object.entries(valor)) {
      if (!permitidos.includes(campo)) recusar("campo não aceito");
      const limpo = texto(conteudo, "campo");
      if (limpo !== "") grupo[campo] = limpo;
    }
    if (Object.keys(grupo).length > 0) saida[chave as Grupo] = grupo;
  }
  return saida;
}
