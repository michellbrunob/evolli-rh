/**
 * Mapa modular e inventário do protótipo (T146).
 *
 * Tudo aqui é SINTÉTICO e estático. Não há chamada de rede, persistência,
 * `localStorage`, `sessionStorage`, cookie ou API — o protótipo só desenha.
 *
 * DUAS ESCALAS, QUE NUNCA SE MISTURAM NO MESMO NÚMERO
 *
 *   TELA REAL  — arquivo de tela-folha que existe hoje em
 *                `apps/web/src/screens/`. É a escala do que está no ar.
 *                `TELAS_REAIS` abaixo é a ÚNICA fonte dessa contagem.
 *
 *   CAPACIDADE — item do mapa modular proposto. Pode ser um fluxo dentro de
 *                uma tela real (Admissão vive dentro de Colaboradores), pode
 *                ser aparência sem código atrás, pode ser plano. É escala de
 *                arquitetura, não de prontidão.
 *
 * Uma capacidade com `telaReal` herda o estado da tela real — é por isso que
 * manchete, lista, lateral e workspaces não conseguem divergir: o estado tem
 * um dono só. Duas capacidades podem apontar para a MESMA tela real sem
 * inflar contagem alguma, porque telas reais são contadas por identificador.
 *
 * Estados:
 *   funcional     — lê e grava pela API real
 *   parcial       — consulta real, sem escrita nesta fatia
 *   demonstrativo — dados de exemplo no próprio código
 *   planejado     — previsto no mapa, ainda sem tela
 */

export const ESTADOS = {
  funcional: {
    rotulo: "Funcional",
    explicacao:
      "Já funciona de verdade: fala com o servidor, guarda o que você faz e respeita quem pode ver o quê.",
  },
  parcial: {
    rotulo: "Parcial",
    explicacao:
      "Mostra informação real, mas ainda não deixa alterar nada por aqui.",
  },
  demonstrativo: {
    rotulo: "Demonstrativo",
    explicacao:
      "É só a aparência da tela, com dados de exemplo. Nada do que aparece aqui foi guardado.",
  },
  planejado: {
    rotulo: "Planejado",
    explicacao:
      "Está previsto no mapa, mas ainda não existe nenhuma tela construída.",
  },
};

/**
 * FONTE ÚNICA das telas-folha reais que não são demonstrativas.
 *
 * Contadas na T146 em `apps/web/src/screens/`, descontados os seis contêineres
 * de abas (Pessoas, Ponto, Cadastros, Documentos, Relatórios e Portal do
 * colaborador), que são moldura de navegação e não tela.
 *
 * `areaHoje` é onde a tela vive HOJE no aplicativo; `moduloFuturo` é onde o
 * mapa proposto a colocaria. As duas colunas não coincidem de propósito: o
 * mapa é proposta, o aplicativo é o que está no ar.
 */
export const TELAS_REAIS = [
  {
    id: "cadastro-horarios",
    nome: "Horários",
    areaHoje: "Cadastros",
    estado: "funcional",
    moduloFuturo: "administracao",
  },
  {
    id: "estrutura-organizacional",
    nome: "Estrutura organizacional",
    areaHoje: "Cadastros",
    estado: "funcional",
    moduloFuturo: "administracao",
  },
  {
    id: "cargos",
    nome: "Cargos",
    areaHoje: "Cadastros",
    estado: "funcional",
    moduloFuturo: "administracao",
  },
  {
    id: "centros-custo",
    nome: "Centros de custo",
    areaHoje: "Cadastros",
    estado: "funcional",
    moduloFuturo: "administracao",
  },
  {
    id: "colaboradores",
    nome: "Colaboradores",
    areaHoje: "Pessoas",
    estado: "funcional",
    moduloFuturo: "pessoas",
    inclui: "o fluxo de admissão acontece dentro desta tela",
  },
  {
    id: "pessoas-horario",
    nome: "Horário do colaborador",
    areaHoje: "Pessoas",
    estado: "funcional",
    moduloFuturo: "jornada",
  },
  {
    id: "historico-funcional",
    nome: "Histórico funcional",
    areaHoje: "Pessoas",
    estado: "funcional",
    moduloFuturo: "pessoas",
  },
  {
    id: "pessoas-documentos",
    nome: "Documentos",
    areaHoje: "Pessoas",
    estado: "funcional",
    moduloFuturo: "pessoas",
  },
  {
    id: "pessoas-solicitacoes",
    nome: "Solicitações",
    areaHoje: "Pessoas",
    estado: "funcional",
    moduloFuturo: "solicitacoes",
  },
  {
    id: "visao-periodo",
    nome: "Visão do período",
    areaHoje: "Ponto",
    estado: "funcional",
    moduloFuturo: "jornada",
    inclui: "as marcações são exibidas dentro desta tela",
  },
  {
    id: "contas-acesso",
    nome: "Contas de acesso",
    areaHoje: "Administração",
    estado: "funcional",
    moduloFuturo: "administracao",
  },
  {
    id: "dados-contratuais",
    nome: "Dados contratuais e vínculos",
    areaHoje: "Pessoas",
    estado: "parcial",
    moduloFuturo: "pessoas",
  },
];

/**
 * Telas-folha restantes, que só têm aparência: dados de exemplo no próprio
 * código. Não estão nomeadas aqui porque nenhuma leitura do protótipo depende
 * do nome delas — só da contagem, que fecha o total de 45.
 */
export const DEMONSTRATIVAS_NO_CODIGO = 33;

const indicePorId = new Map(TELAS_REAIS.map((t) => [t.id, t]));

/** Inventário derivado. Nenhum número é digitado duas vezes. */
export const INVENTARIO = {
  funcional: TELAS_REAIS.filter((t) => t.estado === "funcional").length,
  parcial: TELAS_REAIS.filter((t) => t.estado === "parcial").length,
  demonstrativo: DEMONSTRATIVAS_NO_CODIGO,
  get totalFolhas() {
    return this.funcional + this.parcial + this.demonstrativo;
  },
};

/** A tela real por trás de uma capacidade, quando existe uma. */
export const telaRealDe = (capacidade) =>
  capacidade.telaReal ? indicePorId.get(capacidade.telaReal) : undefined;

/** Estado de uma capacidade: herdado da tela real, quando há uma. */
export const estadoDaCapacidade = (capacidade) =>
  telaRealDe(capacidade)?.estado ?? capacidade.estado;

/** Telas REAIS de um módulo, sem repetição — duas capacidades podem citar uma só. */
export const telasReaisDoModulo = (modulo) => {
  const vistas = new Set();
  const telas = [];
  for (const c of modulo.capacidades) {
    const t = telaRealDe(c);
    if (t && !vistas.has(t.id)) {
      vistas.add(t.id);
      telas.push(t);
    }
  }
  return telas;
};

export const MODULOS = [
  {
    id: "inicio",
    icone: "inicio",
    nome: "Início",
    grupo: "Operação",
    resumo: "Onde o ecossistema se apresenta: o que existe e o que falta.",
    atalhos: [],
    pendencias: [],
    capacidades: [{ nome: "Visão geral", estado: "demonstrativo" }],
  },
  {
    id: "pessoas",
    icone: "pessoas",
    nome: "Pessoas",
    grupo: "Operação",
    resumo: "Quem trabalha na empresa, do primeiro dia ao histórico completo.",
    atalhos: [
      { rotulo: "Admitir colaborador", acao: "admissao" },
      { rotulo: "Abrir lista de colaboradores", acao: "lista" },
    ],
    pendencias: [
      { texto: "2 admissões aguardando documentos", selo: "demonstrativo" },
      { texto: "1 retificação de nome em análise", selo: "demonstrativo" },
    ],
    capacidades: [
      { nome: "Colaboradores", telaReal: "colaboradores" },
      {
        nome: "Admissão",
        telaReal: "colaboradores",
        nota: "fluxo dentro de Colaboradores — não é uma segunda tela",
      },
      { nome: "Dados contratuais e vínculos", telaReal: "dados-contratuais" },
      { nome: "Histórico funcional", telaReal: "historico-funcional" },
      { nome: "Documentos", telaReal: "pessoas-documentos" },
    ],
  },
  {
    id: "jornada",
    icone: "jornada",
    nome: "Jornada",
    grupo: "Operação",
    resumo: "Marcações, horários e o fechamento do período.",
    atalhos: [{ rotulo: "Abrir visão do período", acao: "nada" }],
    pendencias: [
      {
        texto: "7 inconsistências de marcação no período",
        selo: "demonstrativo",
      },
    ],
    capacidades: [
      {
        nome: "Visão do período",
        telaReal: "visao-periodo",
        nota: "hoje em Ponto › Visão do período",
      },
      {
        nome: "Marcações",
        telaReal: "visao-periodo",
        nota: "exibidas dentro da Visão do período — não é uma segunda tela",
      },
      {
        nome: "Horário do colaborador",
        telaReal: "pessoas-horario",
        nota: "hoje em Pessoas › Horário do colaborador; o mapa a traria para Jornada",
      },
      {
        nome: "Escalas",
        estado: "demonstrativo",
        nota: "tela separada da anterior: hoje em Ponto › Escalas, só com dados de exemplo",
      },
      { nome: "Ajustes", estado: "demonstrativo" },
      { nome: "Banco de horas", estado: "demonstrativo" },
      { nome: "Espelho de ponto", estado: "demonstrativo" },
    ],
  },
  {
    id: "ausencias",
    icone: "ausencias",
    nome: "Ausências",
    grupo: "Operação",
    resumo: "Férias, afastamentos, atestados e licenças.",
    atalhos: [],
    pendencias: [],
    capacidades: [
      { nome: "Férias", estado: "planejado" },
      { nome: "Afastamentos", estado: "demonstrativo" },
      { nome: "Atestados", estado: "planejado" },
      { nome: "Licenças", estado: "planejado" },
    ],
  },
  {
    id: "solicitacoes",
    icone: "solicitacoes",
    nome: "Solicitações",
    grupo: "Operação",
    resumo: "O que as pessoas pedem e como o RH responde.",
    atalhos: [{ rotulo: "Abrir solicitações", acao: "nada" }],
    pendencias: [
      { texto: "4 solicitações aguardando análise", selo: "demonstrativo" },
    ],
    capacidades: [
      {
        nome: "Solicitações de pessoas",
        telaReal: "pessoas-solicitacoes",
        nota: "hoje em Pessoas › Solicitações; é esta a tela que funciona",
      },
      {
        nome: "Central de solicitações RH",
        estado: "demonstrativo",
        nota: "tela própria, separada da anterior, só com dados de exemplo",
      },
      { nome: "Fila de análise", estado: "demonstrativo" },
      { nome: "Histórico", estado: "demonstrativo" },
    ],
  },
  {
    id: "beneficios",
    icone: "beneficios",
    nome: "Benefícios",
    grupo: "Operação",
    resumo: "Benefícios concedidos e dependentes.",
    atalhos: [],
    pendencias: [],
    capacidades: [
      { nome: "Benefícios", estado: "demonstrativo" },
      { nome: "Dependentes", estado: "demonstrativo" },
    ],
  },
  {
    id: "clima",
    icone: "clima",
    nome: "Clima e desenvolvimento",
    grupo: "Consulta",
    resumo: "Pesquisa de clima e trilha de desenvolvimento.",
    atalhos: [],
    pendencias: [],
    capacidades: [
      { nome: "Pesquisa de clima", estado: "planejado" },
      { nome: "Desenvolvimento", estado: "planejado" },
    ],
  },
  {
    id: "relatorios",
    icone: "relatorios",
    nome: "Relatórios",
    grupo: "Consulta",
    resumo: "Leitura consolidada do que já foi registrado.",
    atalhos: [],
    pendencias: [],
    capacidades: [
      { nome: "Exceções de ponto", estado: "demonstrativo" },
      { nome: "Extrato de banco de horas", estado: "demonstrativo" },
      { nome: "Espelho de ponto", estado: "demonstrativo" },
      { nome: "Justificativas", estado: "demonstrativo" },
      { nome: "Quadro de horários", estado: "demonstrativo" },
      { nome: "Calendário de feriados", estado: "demonstrativo" },
      { nome: "Listagem de colaboradores", estado: "demonstrativo" },
    ],
  },
  {
    id: "administracao",
    icone: "administracao",
    nome: "Administração",
    grupo: "Administração",
    resumo: "A estrutura da empresa e quem tem acesso ao sistema.",
    atalhos: [],
    pendencias: [],
    capacidades: [
      {
        nome: "Estrutura organizacional",
        telaReal: "estrutura-organizacional",
        nota: "hoje em Cadastros › Estrutura organizacional",
      },
      {
        nome: "Cargos",
        telaReal: "cargos",
        nota: "hoje em Cadastros › Cargos",
      },
      {
        nome: "Centros de custo",
        telaReal: "centros-custo",
        nota: "hoje em Cadastros › Centros de custo",
      },
      {
        nome: "Horários",
        telaReal: "cadastro-horarios",
        nota: "hoje em Cadastros › Horários",
      },
      { nome: "Contas de acesso", telaReal: "contas-acesso" },
      { nome: "Configurações", estado: "planejado" },
    ],
  },
];

/**
 * Fora da navegação operacional de propósito: um item no menu é lido como
 * capacidade existente, e nenhum destes três existe.
 */
export const EVOLUCAO_FUTURA = [
  {
    nome: "Folha de pagamento",
    nota: "Depende de decisão de produto e de regras aprovadas pelo RH e pelo jurídico.",
  },
  {
    nome: "eSocial",
    nota: "Integração com obrigação legal; exige layout oficial e homologação própria.",
  },
  {
    nome: "Obrigações fiscais",
    nota: "Fora do escopo das fatias atuais; nenhuma regra fiscal foi modelada.",
  },
];

/** Lista sintética navegável de verdade: filtra e abre detalhe. */
export const COLABORADORES = [
  {
    id: "DEMO-A-0001",
    nome: "Pessoa Demo Alfa Um",
    empresa: "Alfa",
    departamento: "Operações",
    situacao: "ativo",
    vinculos: 1,
    admissao: "05/01/2026",
  },
  {
    id: "DEMO-A-0002",
    nome: "Pessoa Demo Alfa Dois",
    empresa: "Alfa",
    departamento: "Operações",
    situacao: "ativo",
    vinculos: 2,
    admissao: "05/01/2026",
  },
  {
    id: "DEMO-A-0004",
    nome: "Pessoa Demo Alfa Três",
    empresa: "Alfa",
    departamento: "Administrativo",
    situacao: "inativo",
    vinculos: 1,
    admissao: "18/02/2025",
  },
  {
    id: "DEMO-B-0001",
    nome: "Pessoa Demo Beta Um",
    empresa: "Beta",
    departamento: "Operações",
    situacao: "ativo",
    vinculos: 1,
    admissao: "10/02/2026",
  },
  {
    id: "DEMO-B-0002",
    nome: "Pessoa Demo Beta Dois",
    empresa: "Beta",
    departamento: "Comercial",
    situacao: "ativo",
    vinculos: 1,
    admissao: "03/03/2026",
  },
];
