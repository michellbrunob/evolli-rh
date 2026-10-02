/**
 * Mapa modular e inventário do protótipo (T146).
 *
 * Tudo aqui é SINTÉTICO e estático. Não há chamada de rede, persistência,
 * `localStorage`, `sessionStorage`, cookie ou API — o protótipo só desenha.
 *
 * O campo `estado` de cada tela foi derivado do código em
 * `apps/web/src/screens/` e da navegação, na própria T146:
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

export const MODULOS = [
  {
    id: "inicio",
    nome: "Início",
    grupo: "Operação",
    glifo: "◉",
    resumo: "Onde o ecossistema se apresenta: o que existe e o que falta.",
    atalhos: [],
    pendencias: [],
    telas: [{ nome: "Visão geral", estado: "demonstrativo" }],
  },
  {
    id: "pessoas",
    nome: "Pessoas",
    grupo: "Operação",
    glifo: "◎",
    resumo: "Quem trabalha na empresa, do primeiro dia ao histórico completo.",
    atalhos: [
      { rotulo: "Admitir colaborador", acao: "admissao" },
      { rotulo: "Abrir lista de colaboradores", acao: "lista" },
    ],
    pendencias: [
      { texto: "2 admissões aguardando documentos", selo: "demonstrativo" },
      { texto: "1 retificação de nome em análise", selo: "demonstrativo" },
    ],
    telas: [
      { nome: "Colaboradores", estado: "funcional" },
      { nome: "Admissão", estado: "funcional", nota: "parte de Colaboradores" },
      { nome: "Dados contratuais e vínculos", estado: "parcial" },
      { nome: "Histórico funcional", estado: "funcional" },
      { nome: "Documentos", estado: "funcional" },
    ],
  },
  {
    id: "jornada",
    nome: "Jornada",
    grupo: "Operação",
    glifo: "◷",
    resumo: "Marcações, horários e o fechamento do período.",
    atalhos: [{ rotulo: "Abrir visão do período", acao: "nada" }],
    pendencias: [
      {
        texto: "7 inconsistências de marcação no período",
        selo: "demonstrativo",
      },
    ],
    telas: [
      {
        nome: "Marcações",
        estado: "funcional",
        nota: "parte da Visão do período",
      },
      { nome: "Visão do período", estado: "funcional" },
      { nome: "Horários e escalas", estado: "funcional" },
      { nome: "Ajustes", estado: "demonstrativo" },
      { nome: "Banco de horas", estado: "demonstrativo" },
      { nome: "Espelho de ponto", estado: "demonstrativo" },
    ],
  },
  {
    id: "ausencias",
    nome: "Ausências",
    grupo: "Operação",
    glifo: "◌",
    resumo: "Férias, afastamentos, atestados e licenças.",
    atalhos: [],
    pendencias: [],
    telas: [
      { nome: "Férias", estado: "planejado" },
      { nome: "Afastamentos", estado: "demonstrativo" },
      { nome: "Atestados", estado: "planejado" },
      { nome: "Licenças", estado: "planejado" },
    ],
  },
  {
    id: "solicitacoes",
    nome: "Solicitações",
    grupo: "Operação",
    glifo: "◈",
    resumo: "O que as pessoas pedem e como o RH responde.",
    atalhos: [{ rotulo: "Abrir central", acao: "nada" }],
    pendencias: [
      { texto: "4 solicitações aguardando análise", selo: "demonstrativo" },
    ],
    telas: [
      { nome: "Central", estado: "funcional" },
      { nome: "Fila de análise", estado: "demonstrativo" },
      { nome: "Histórico", estado: "demonstrativo" },
    ],
  },
  {
    id: "beneficios",
    nome: "Benefícios",
    grupo: "Operação",
    glifo: "◆",
    resumo: "Benefícios concedidos e dependentes.",
    atalhos: [],
    pendencias: [],
    telas: [
      { nome: "Benefícios", estado: "demonstrativo" },
      { nome: "Dependentes", estado: "demonstrativo" },
    ],
  },
  {
    id: "clima",
    nome: "Clima e desenvolvimento",
    grupo: "Consulta",
    glifo: "◇",
    resumo: "Pesquisa de clima e trilha de desenvolvimento.",
    atalhos: [],
    pendencias: [],
    telas: [
      { nome: "Pesquisa de clima", estado: "planejado" },
      { nome: "Desenvolvimento", estado: "planejado" },
    ],
  },
  {
    id: "relatorios",
    nome: "Relatórios",
    grupo: "Consulta",
    glifo: "▤",
    resumo: "Leitura consolidada do que já foi registrado.",
    atalhos: [],
    pendencias: [],
    telas: [
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
    nome: "Administração",
    grupo: "Administração",
    glifo: "⚙",
    resumo: "A estrutura da empresa e quem tem acesso ao sistema.",
    atalhos: [],
    pendencias: [],
    telas: [
      { nome: "Estrutura organizacional", estado: "funcional" },
      { nome: "Cargos", estado: "funcional" },
      { nome: "Centros de custo", estado: "funcional" },
      { nome: "Horários", estado: "funcional" },
      { nome: "Contas e acessos", estado: "funcional" },
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

/**
 * Inventário REAL das telas que existem hoje, contado na T146 a partir de
 * `apps/web/src/screens/` e da navegação — não reaproveitado de texto anterior.
 */
export const INVENTARIO = {
  totalFolhas: 45,
  funcional: 11,
  parcial: 1,
  demonstrativo: 33,
};

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
