/**
 * T216 — Riscos psicossociais (NR-1): a biblioteca de medidas sugeridas por
 * dimensão, escrita pelo Evolli (sem IA). Três medidas por dimensão, cada uma
 * com o controle na ordem de prioridade da NR-1, o prazo sugerido, duas
 * formas de executar (opção A e B), a referência e o indicador de
 * acompanhamento. A sugestão aparece para as dimensões do resultado; o RH
 * escolhe, adapta e leva ao plano — a decisão e a validação com o
 * profissional de SST são da empresa.
 */
import type {
  ControleNr1,
  MedidaDoPlano,
  NivelNr1,
} from "../../../../api/modelosDePesquisaClient";
import { DIMENSOES_NR1 } from "./definicao";

export interface MedidaSugerida {
  readonly id: string;
  readonly dimensaoId: string;
  readonly controle: ControleNr1;
  /** Prazo sugerido, em dias a partir de hoje. */
  readonly prazoDias: 30 | 60 | 90;
  readonly titulo: string;
  readonly descricao: string;
  readonly opcaoA: string;
  readonly opcaoB: string;
  readonly referencia: string;
  readonly indicador: string;
}

const NR1 = "NR-1, gerenciamento de riscos ocupacionais (item 1.5)";
const NR17 = "NR-17, organização do trabalho";
const ISO = "ISO 45003, saúde e segurança psicológicas no trabalho";
const LEI = "Lei 14.457/2022, prevenção do assédio";
const OIT = "Convenção 190 da OIT, violência e assédio no trabalho";
const CIPA = "NR-5, CIPA e prevenção do assédio";

type Linha = readonly [
  ControleNr1,
  30 | 60 | 90,
  string,
  string,
  string,
  string,
  string,
  string,
];

/** [dimensão, [controle, prazo, título, descrição, A, B, referência, indicador] × 3]. */
const BIBLIOTECA: readonly (readonly [string, readonly Linha[]])[] = [
  [
    "exigencias_quantitativas",
    [
      [
        "eliminacao",
        30,
        "Rever o volume de demandas por pessoa",
        "Levantar o que cada área recebe, cortar tarefas que não geram resultado e redistribuir o excesso antes de cobrar novos prazos.",
        "Mapear as demandas da semana com a equipe e retirar as que podem parar.",
        "Criar uma fila única de pedidos com limite de itens em andamento por pessoa.",
        NR17,
        "Horas extras por pessoa no mês e tarefas atrasadas por área.",
      ],
      [
        "administrativo",
        60,
        "Dimensionar a equipe pela demanda real",
        "Comparar a carga medida com as horas disponíveis e ajustar o quadro ou os prazos quando a conta não fecha.",
        "Abrir vaga ou realocar pessoas das áreas com folga.",
        "Renegociar prazos e escopo com quem pede o trabalho.",
        NR1,
        "Relação entre horas de demanda e horas disponíveis, a cada trimestre.",
      ],
      [
        "administrativo",
        90,
        "Combinar prioridades com a liderança toda semana",
        "Uma conversa curta e fixa para decidir o que entra, o que espera e o que sai da lista.",
        "Reunião semanal de 15 minutos com quadro de prioridades.",
        "Lista de prioridades publicada no canal da equipe toda segunda-feira.",
        ISO,
        "% de pessoas que dizem saber o que é prioridade (pesquisa de pulso).",
      ],
    ],
  ],
  [
    "ritmo_trabalho",
    [
      [
        "eliminacao",
        30,
        "Tirar metas de velocidade que não dependem da pessoa",
        "Revisar metas por hora ou por atendimento que obrigam a acelerar sem pausa e trocar por metas de resultado.",
        "Suspender rankings de produtividade individual.",
        "Trocar a meta por hora por meta diária com margem.",
        NR17,
        "Número de metas de velocidade revisadas e queixas de pressão de tempo.",
      ],
      [
        "administrativo",
        60,
        "Garantir pausas ao longo da jornada",
        "Prever pausas curtas nos períodos de pico e proteger o intervalo de descanso.",
        "Escala de pausas por turno, com cobertura combinada.",
        "Pausa coletiva de 10 minutos a cada duas horas nas atividades repetitivas.",
        NR17,
        "% de pausas cumpridas por turno (registro da liderança).",
      ],
      [
        "substituicao",
        90,
        "Distribuir os picos de trabalho no tempo",
        "Antecipar entregas previsíveis e espalhar as tarefas que se acumulam nos mesmos dias.",
        "Calendário de fechamentos com etapas antecipadas.",
        "Reforço temporário nas semanas de pico.",
        ISO,
        "Horas extras nas semanas de pico, comparadas com o trimestre anterior.",
      ],
    ],
  ],
  [
    "exigencias_cognitivas",
    [
      [
        "substituicao",
        60,
        "Apoiar decisões difíceis com regras claras",
        "Escrever critérios para as decisões que se repetem, para a pessoa não decidir sozinha a cada caso.",
        "Guia de decisão com exemplos dos casos mais comuns.",
        "Canal rápido para consultar a liderança nos casos fora da regra.",
        NR17,
        "Decisões refeitas ou escaladas por mês.",
      ],
      [
        "administrativo",
        60,
        "Reduzir a informação que precisa ser decorada",
        "Colocar em listas de verificação, sistemas ou modelos o que hoje depende da memória da pessoa.",
        "Listas de verificação nas tarefas críticas.",
        "Base de consulta única, atualizada pela própria equipe.",
        ISO,
        "Erros por esquecimento registrados no mês.",
      ],
      [
        "administrativo",
        90,
        "Proteger tempo de concentração",
        "Separar blocos sem interrupção para as tarefas que pedem atenção e criatividade.",
        "Faixas de horário sem reunião duas vezes por semana.",
        'Sinal combinado de "em concentração" respeitado pela equipe.',
        ISO,
        "% de pessoas que conseguem trabalhar sem interrupção (pulso).",
      ],
    ],
  ],
  [
    "exigencias_emocionais",
    [
      [
        "administrativo",
        30,
        "Combinar como agir nos atendimentos difíceis",
        "Definir o que fazer diante de cliente agressivo ou situação de sofrimento, incluindo quando passar o caso adiante.",
        "Roteiro de atendimento difícil com o momento de chamar a liderança.",
        "Dupla de apoio nos atendimentos de maior desgaste.",
        ISO,
        "Atendimentos difíceis registrados e % com apoio acionado.",
      ],
      [
        "protecao",
        60,
        "Oferecer espaço de escuta depois de situações pesadas",
        "Conversa breve e protegida para a pessoa descarregar e ser acolhida após casos difíceis.",
        "Roda de conversa quinzenal conduzida por profissional preparado.",
        "Escuta individual com psicólogo, por convênio ou parceria.",
        ISO,
        "Participação nas rodas e procura pela escuta individual.",
      ],
      [
        "administrativo",
        90,
        "Alternar tarefas de alto desgaste emocional",
        "Evitar que a mesma pessoa fique a jornada toda nas atividades de maior carga emocional.",
        "Rodízio diário entre atendimento e tarefas internas.",
        "Limite de horas seguidas no atendimento mais pesado.",
        NR17,
        "Horas seguidas em atendimento por pessoa (escala).",
      ],
    ],
  ],
  [
    "influencia_trabalho",
    [
      [
        "administrativo",
        60,
        "Ouvir a equipe antes de mudar o trabalho",
        "Incluir quem faz o trabalho nas decisões sobre método, ferramentas e distribuição das tarefas.",
        "Consulta rápida à equipe antes de cada mudança de processo.",
        "Grupo de melhoria com representantes de cada área.",
        NR1,
        "Mudanças de processo com consulta prévia à equipe (%).",
      ],
      [
        "administrativo",
        60,
        "Dar margem para a pessoa organizar a própria rotina",
        "Deixar a ordem das tarefas e o momento das pausas com a pessoa, quando a atividade permitir.",
        "Combinar com cada pessoa a parte da rotina que ela decide.",
        "Horários de pausa flexíveis dentro de uma faixa.",
        ISO,
        "% de pessoas que dizem ter influência sobre o próprio trabalho (pulso).",
      ],
      [
        "administrativo",
        90,
        "Criar um canal de sugestões com resposta",
        "Receber ideias de melhoria e devolver, com prazo, o que será feito ou por que não.",
        "Caixa de sugestões digital com resposta em até 30 dias.",
        "Pauta fixa de ideias da equipe na reunião mensal.",
        ISO,
        "Sugestões recebidas, respondidas e implantadas por trimestre.",
      ],
    ],
  ],
  [
    "possibilidades_desenvolvimento",
    [
      [
        "administrativo",
        60,
        "Plano de desenvolvimento individual",
        "Combinar com cada pessoa o que ela quer aprender no ano e como a empresa vai apoiar.",
        "Conversa anual de desenvolvimento com metas de aprendizado.",
        "Trilhas de capacitação por cargo, escolhidas pela pessoa.",
        ISO,
        "% de pessoas com plano de desenvolvimento e horas de capacitação.",
      ],
      [
        "administrativo",
        90,
        "Rodízio e projetos para usar novas habilidades",
        "Abrir oportunidades de aprender fazendo, em outras funções ou projetos.",
        "Participação em projetos de outras áreas.",
        "Rodízio planejado entre funções afins.",
        ISO,
        "Pessoas que participaram de rodízio ou projeto no semestre.",
      ],
      [
        "administrativo",
        90,
        "Divulgar as vagas internas primeiro",
        "Dar a quem já está na empresa a chance de crescer antes de buscar fora.",
        "Mural de vagas internas com critérios claros.",
        "Recrutamento interno obrigatório por 10 dias antes do externo.",
        ISO,
        "% de vagas preenchidas por pessoas da casa.",
      ],
    ],
  ],
  [
    "significado_trabalho",
    [
      [
        "administrativo",
        60,
        "Mostrar o resultado do trabalho de cada área",
        "Compartilhar como o trabalho da equipe chega ao cliente e ao resultado da empresa.",
        "Relato mensal de casos atendidos ou entregas concluídas.",
        "Visita ou conversa com quem usa o que a equipe produz.",
        ISO,
        "% de pessoas que veem sentido no próprio trabalho (pulso).",
      ],
      [
        "eliminacao",
        60,
        "Cortar tarefas que ninguém usa",
        "Identificar relatórios, controles e retrabalhos sem utilidade e parar de fazê-los.",
        "Revisão trimestral de relatórios com quem os recebe.",
        "Pergunta fixa na reunião: o que podemos parar de fazer?",
        NR17,
        "Tarefas eliminadas por trimestre.",
      ],
      [
        "administrativo",
        90,
        "Ligar as metas da equipe aos objetivos da empresa",
        "Explicar por que cada meta existe e como ela contribui para o todo.",
        "Desdobramento das metas da empresa por área, apresentado à equipe.",
        "Painel simples de metas visível para todos.",
        ISO,
        "% de pessoas que conhecem os objetivos da área.",
      ],
    ],
  ],
  [
    "compromisso_local_trabalho",
    [
      [
        "administrativo",
        60,
        "Agir sobre o que faz as pessoas quererem sair",
        "Usar as entrevistas de desligamento e as pesquisas para corrigir os motivos de saída que se repetem.",
        "Relatório trimestral dos motivos de saída com plano de resposta.",
        "Conversa de permanência com quem tem potencial e sinal de saída.",
        ISO,
        "Rotatividade voluntária e motivos de saída mais citados.",
      ],
      [
        "administrativo",
        90,
        "Contar o que a empresa fez com a pesquisa",
        "Devolver os resultados e as ações escolhidas, para a pessoa ver que a opinião dela muda algo.",
        "Apresentação dos resultados e do plano por área.",
        "Comunicado com o andamento das ações a cada trimestre.",
        NR1,
        "Ações do plano comunicadas e concluídas.",
      ],
      [
        "administrativo",
        90,
        "Valorizar quem está há mais tempo",
        "Reconhecer a trajetória e a contribuição de quem constrói a empresa.",
        "Marcos de tempo de casa celebrados com a equipe.",
        "Convite para mentorar quem está chegando.",
        ISO,
        "Tempo médio de casa e participação em programas de mentoria.",
      ],
    ],
  ],
  [
    "previsibilidade",
    [
      [
        "administrativo",
        30,
        "Avisar mudanças com antecedência",
        "Comunicar mudanças de escala, processo ou estrutura antes de entrarem em vigor, com o motivo.",
        "Regra de aviso mínimo de 15 dias para mudanças planejadas.",
        "Calendário de mudanças publicado para a equipe.",
        NR17,
        "Mudanças comunicadas com antecedência mínima (%).",
      ],
      [
        "administrativo",
        60,
        "Ter um canal oficial de informação",
        "Concentrar os avisos num lugar só, para ninguém depender de boato.",
        "Mural ou canal digital oficial, atualizado toda semana.",
        "Resumo mensal da liderança com as novidades da área.",
        ISO,
        "% de pessoas que se dizem bem informadas (pulso).",
      ],
      [
        "administrativo",
        60,
        "Reunião curta de alinhamento",
        "Um encontro rápido e regular para repassar o que muda e tirar dúvidas.",
        "Alinhamento de 10 minutos no início do turno.",
        "Reunião semanal da área com espaço para perguntas.",
        ISO,
        "Frequência das reuniões de alinhamento realizadas.",
      ],
    ],
  ],
  [
    "reconhecimento",
    [
      [
        "administrativo",
        30,
        "Reconhecer o bom trabalho na hora",
        "Dar retorno positivo específico, logo depois da entrega, de forma individual ou pública.",
        "Momento de reconhecimento na reunião semanal.",
        "Mensagem da liderança registrando a contribuição de cada um.",
        ISO,
        "% de pessoas que se sentem reconhecidas (pulso).",
      ],
      [
        "administrativo",
        90,
        "Critérios claros de remuneração e promoção",
        "Explicar como se cresce na empresa e o que pesa nas decisões de salário e promoção.",
        "Política de cargos e salários publicada.",
        "Conversa individual sobre o caminho de crescimento.",
        NR1,
        "Questionamentos sobre promoção e salário no período.",
      ],
      [
        "administrativo",
        60,
        "Preparar a liderança para dar retorno",
        "Capacitar quem lidera a reconhecer e a dar retorno de forma respeitosa e frequente.",
        "Oficina de conversas de retorno para líderes.",
        "Roteiro simples de retorno mensal com cada pessoa.",
        ISO,
        "% de líderes capacitados e conversas de retorno realizadas.",
      ],
    ],
  ],
  [
    "transparencia_papel",
    [
      [
        "administrativo",
        30,
        "Descrever as responsabilidades de cada função",
        "Deixar escrito o que se espera de cada cargo e até onde vai a autonomia.",
        "Descrição de cargo revisada com a própria pessoa.",
        "Matriz de responsabilidades por processo.",
        NR17,
        "Funções com responsabilidades descritas e revisadas (%).",
      ],
      [
        "administrativo",
        60,
        "Combinar metas e prioridades individuais",
        "Cada pessoa sabe o que entregar, em que prazo e como será avaliada.",
        "Conversa trimestral de metas com registro.",
        "Painel individual de entregas combinado com a liderança.",
        ISO,
        "% de pessoas com metas combinadas.",
      ],
      [
        "administrativo",
        60,
        "Integração completa de quem chega ou muda de função",
        "Apresentar tarefas, contatos e expectativas logo no início.",
        "Roteiro de integração com padrinho ou madrinha.",
        "Conversa de expectativas no primeiro mês na função.",
        ISO,
        "Avaliação da integração aos 30 e 90 dias.",
      ],
    ],
  ],
  [
    "conflitos_papeis",
    [
      [
        "eliminacao",
        30,
        "Acabar com ordens contraditórias",
        "Definir quem dá a palavra final em cada assunto, para a pessoa não receber pedidos opostos.",
        "Um responsável por prioridade em cada processo.",
        "Regra: pedido de outra área passa pela liderança direta.",
        NR17,
        "Relatos de pedidos conflitantes por mês.",
      ],
      [
        "substituicao",
        60,
        "Dar os recursos necessários para cada tarefa",
        "Conferir ferramentas, acessos e informações antes de cobrar a entrega.",
        "Lista de recursos mínimos por atividade, conferida pela liderança.",
        "Canal para registrar falta de recurso, com prazo de solução.",
        NR1,
        "Pedidos de recurso abertos e atendidos no prazo.",
      ],
      [
        "administrativo",
        90,
        "Revisar processos que geram retrabalho",
        'Mapear com a equipe as tarefas feitas "do jeito errado" por falha do processo e corrigi-las.',
        "Oficina de mapeamento de processo com quem executa.",
        "Registro de retrabalho e revisão mensal das causas.",
        NR17,
        "Horas de retrabalho por mês.",
      ],
    ],
  ],
  [
    "qualidade_lideranca",
    [
      [
        "administrativo",
        60,
        "Capacitar a liderança em gestão de pessoas",
        "Formar quem lidera em planejamento, desenvolvimento da equipe e resolução de conflitos.",
        "Programa de formação de líderes com encontros mensais.",
        "Mentoria de líderes experientes para quem está começando.",
        ISO,
        "% de líderes formados e avaliação da liderança na pesquisa.",
      ],
      [
        "administrativo",
        60,
        "Conversas individuais regulares",
        "Encontro periódico entre líder e cada pessoa para falar de trabalho, dificuldades e desenvolvimento.",
        "Conversa individual mensal de 30 minutos.",
        "Conversa quinzenal curta nas equipes maiores.",
        ISO,
        "% de conversas individuais realizadas no mês.",
      ],
      [
        "administrativo",
        90,
        "Ouvir a equipe sobre a liderança",
        "Coletar a percepção da equipe sobre a própria liderança e transformar em plano de melhoria.",
        "Avaliação da liderança pela equipe uma vez por ano.",
        "Pergunta de liderança na pesquisa de pulso trimestral.",
        ISO,
        "Evolução da avaliação da liderança entre aplicações.",
      ],
    ],
  ],
  [
    "apoio_social_superiores",
    [
      [
        "administrativo",
        30,
        "Liderança disponível para pedidos de ajuda",
        "Definir quando e como procurar a liderança diante de um problema, sem medo de represália.",
        "Horário fixo de portas abertas na semana.",
        "Canal direto com a liderança para urgências.",
        ISO,
        "% de pessoas que dizem ter ajuda da liderança (pulso).",
      ],
      [
        "administrativo",
        60,
        "Retorno sobre o desempenho com apoio",
        "Conversas de desempenho que combinam o que melhorar e como a liderança vai ajudar.",
        "Plano de apoio registrado em cada conversa de desempenho.",
        "Acompanhamento em 30 dias do que foi combinado.",
        ISO,
        "Planos de apoio combinados e cumpridos.",
      ],
      [
        "protecao",
        60,
        "Preparar líderes para acolher quem está mal",
        "Ensinar a reconhecer sinais de sofrimento e a encaminhar para ajuda.",
        "Treino de primeira escuta em saúde mental para líderes.",
        "Guia de encaminhamento com os contatos de apoio.",
        ISO,
        "% de líderes treinados e encaminhamentos feitos.",
      ],
    ],
  ],
  [
    "apoio_social_colegas",
    [
      [
        "administrativo",
        60,
        "Estimular a ajuda entre colegas",
        "Criar momentos e combinados que facilitem pedir e oferecer ajuda no dia a dia.",
        "Dupla de referência para cada pessoa da equipe.",
        "Reunião de troca de experiências a cada mês.",
        ISO,
        "% de pessoas que dizem ter ajuda dos colegas (pulso).",
      ],
      [
        "administrativo",
        90,
        "Metas que valorizam o trabalho em equipe",
        "Evitar metas que coloquem colegas em disputa e incluir resultados coletivos.",
        "Parte da meta ligada ao resultado da equipe.",
        "Reconhecimento coletivo pelas entregas conjuntas.",
        ISO,
        "Metas coletivas adotadas por área.",
      ],
      [
        "administrativo",
        60,
        "Integrar quem trabalha isolado",
        "Incluir pessoas em turnos, unidades ou trabalho remoto nas trocas da equipe.",
        "Encontro periódico presencial ou virtual de toda a equipe.",
        "Canal de conversa da equipe com participação de todos os turnos.",
        ISO,
        "Participação de quem trabalha isolado nos encontros.",
      ],
    ],
  ],
  [
    "inseguranca_laboral",
    [
      [
        "administrativo",
        30,
        "Informar com transparência sobre a situação da empresa",
        "Falar abertamente sobre resultados, planos e mudanças que afetam os empregos.",
        "Encontro trimestral da direção com as equipes.",
        "Comunicado escrito sobre mudanças previstas, com espaço para perguntas.",
        ISO,
        "% de pessoas com medo de perder o emprego (pesquisa).",
      ],
      [
        "administrativo",
        60,
        "Critérios claros em reestruturações",
        "Explicar com antecedência como serão tomadas decisões de cortes ou mudanças de função.",
        "Política de reestruturação com critérios publicados.",
        "Conversa individual com quem será afetado antes do anúncio.",
        NR1,
        "Mudanças comunicadas com critérios e antecedência.",
      ],
      [
        "protecao",
        90,
        "Apoiar a recolocação e a requalificação",
        "Oferecer capacitação para novas funções e apoio a quem precisar sair.",
        "Requalificação interna para funções com vaga.",
        "Apoio de recolocação no desligamento.",
        ISO,
        "Pessoas requalificadas ou apoiadas na recolocação.",
      ],
    ],
  ],
  [
    "satisfacao_laboral",
    [
      [
        "substituicao",
        60,
        "Melhorar as condições físicas do trabalho",
        "Corrigir ruído, temperatura, iluminação, mobiliário e equipamentos apontados pela equipe.",
        "Vistoria com a equipe e lista de correções com prazo.",
        "Avaliação ergonômica do posto de trabalho.",
        NR17,
        "Correções do ambiente concluídas no prazo.",
      ],
      [
        "administrativo",
        60,
        "Aproveitar melhor as habilidades de cada um",
        "Conhecer o que cada pessoa sabe fazer e distribuir tarefas que usem esses talentos.",
        "Mapa de habilidades da equipe.",
        "Conversa sobre tarefas preferidas na distribuição do trabalho.",
        ISO,
        "% de pessoas satisfeitas com o uso das habilidades.",
      ],
      [
        "administrativo",
        90,
        "Acompanhar a satisfação com frequência",
        "Medir a satisfação em intervalos curtos e agir sobre o que piorar.",
        "Pesquisa de pulso trimestral.",
        "Conversa de satisfação nas reuniões individuais.",
        ISO,
        "Evolução da satisfação entre as medições.",
      ],
    ],
  ],
  [
    "conflito_trabalho_familia",
    [
      [
        "eliminacao",
        30,
        "Respeitar o horário fora do expediente",
        "Combinar que mensagens e ligações fora da jornada não exigem resposta, salvo emergência definida.",
        "Política de desconexão com as exceções descritas.",
        "Envio programado de mensagens para o horário de trabalho.",
        NR17,
        "Mensagens fora do horário e horas extras não planejadas.",
      ],
      [
        "administrativo",
        60,
        "Flexibilizar horários quando a atividade permitir",
        "Oferecer opções de horário e de local que ajudem a conciliar trabalho e vida pessoal.",
        "Faixa de entrada e saída flexível.",
        "Dias de trabalho remoto para as funções compatíveis.",
        ISO,
        "% de pessoas com algum arranjo flexível.",
      ],
      [
        "administrativo",
        60,
        "Planejar escalas com antecedência",
        "Publicar escalas e plantões com tempo para a pessoa organizar a vida.",
        "Escala publicada com pelo menos um mês de antecedência.",
        "Troca de turnos entre colegas com regra simples.",
        NR17,
        "Escalas publicadas no prazo e trocas atendidas.",
      ],
    ],
  ],
  [
    "confianca_vertical",
    [
      [
        "administrativo",
        60,
        "Cumprir o que a direção promete",
        "Acompanhar publicamente os compromissos assumidos com as equipes e explicar quando algo mudar.",
        "Painel de compromissos da direção com situação atualizada.",
        "Prestação de contas trimestral às equipes.",
        ISO,
        "Compromissos cumpridos no prazo (%).",
      ],
      [
        "administrativo",
        60,
        "Delegar com confiança",
        "Reduzir controles excessivos e dar autonomia proporcional à experiência da pessoa.",
        "Revisão de aprovações e controles que podem sair.",
        "Níveis de autonomia combinados por função.",
        ISO,
        "Controles e aprovações revisados.",
      ],
      [
        "administrativo",
        90,
        "Canais abertos com a direção",
        "Criar oportunidades de conversa direta entre equipes e direção, com resposta às perguntas.",
        "Café ou encontro mensal da direção com as equipes.",
        "Perguntas anônimas respondidas em comunicado.",
        ISO,
        "Perguntas recebidas e respondidas.",
      ],
    ],
  ],
  [
    "confianca_horizontal",
    [
      [
        "administrativo",
        60,
        "Compartilhar informações entre colegas",
        "Tornar acessíveis as informações de trabalho, para ninguém depender de quem as guarda.",
        "Pasta ou sistema único com os documentos da equipe.",
        "Passagem de turno com registro escrito.",
        ISO,
        "Falhas por falta de informação registradas no mês.",
      ],
      [
        "administrativo",
        90,
        "Acordos de convivência da equipe",
        "Construir com a equipe regras de respeito, comunicação e colaboração.",
        "Oficina para escrever os acordos da equipe.",
        "Revisão dos acordos a cada semestre.",
        ISO,
        "% de pessoas que confiam nos colegas (pulso).",
      ],
      [
        "protecao",
        60,
        "Mediar conflitos entre colegas",
        "Tratar cedo os desentendimentos, com conversa conduzida por alguém neutro.",
        "Mediação pelo RH nos conflitos relatados.",
        "Formação de mediadores internos.",
        ISO,
        "Conflitos relatados e resolvidos.",
      ],
    ],
  ],
  [
    "justica_respeito",
    [
      [
        "administrativo",
        30,
        "Distribuir o trabalho com critérios claros",
        "Explicar como as tarefas, escalas e oportunidades são divididas e conferir se a divisão é justa.",
        "Regra de distribuição publicada e revisada com a equipe.",
        "Rodízio das tarefas menos desejadas.",
        NR17,
        "Queixas de distribuição desigual.",
      ],
      [
        "administrativo",
        60,
        "Levar as sugestões a sério",
        "Responder toda sugestão, explicando o que foi feito com ela.",
        "Registro de sugestões com resposta em prazo definido.",
        "Retorno público das sugestões implantadas.",
        ISO,
        "Sugestões respondidas no prazo (%).",
      ],
      [
        "administrativo",
        60,
        "Processo justo para resolver conflitos",
        "Ouvir todas as partes e decidir com critérios conhecidos.",
        "Fluxo de tratamento de conflitos publicado.",
        "Revisão de decisões por uma segunda pessoa quando pedido.",
        NR1,
        "Conflitos tratados pelo fluxo e prazo de resolução.",
      ],
    ],
  ],
  [
    "comunidade_social",
    [
      [
        "administrativo",
        60,
        "Momentos de convivência da equipe",
        "Criar espaços informais de encontro que aproximem as pessoas.",
        "Café coletivo mensal no horário de trabalho.",
        "Ações de integração entre áreas.",
        ISO,
        "Participação nos encontros de convivência.",
      ],
      [
        "administrativo",
        90,
        "Projetos que juntam áreas diferentes",
        "Colocar pessoas de áreas distintas para resolver juntas um problema comum.",
        "Grupo de melhoria com integrantes de várias áreas.",
        "Projeto social ou voluntário da empresa.",
        ISO,
        "Projetos entre áreas realizados.",
      ],
      [
        "administrativo",
        60,
        "Aproximar direção e equipes",
        "Reduzir a distância entre quem decide e quem executa.",
        "Visitas da direção às áreas.",
        "Conversas abertas com a direção a cada trimestre.",
        ISO,
        "% de pessoas que avaliam bem a relação com a direção.",
      ],
    ],
  ],
  [
    "autoeficacia",
    [
      [
        "administrativo",
        60,
        "Capacitar para os problemas mais comuns",
        "Treinar a equipe nas situações difíceis que se repetem no trabalho.",
        "Oficinas práticas com casos reais da área.",
        "Material de consulta rápida para resolver problemas frequentes.",
        ISO,
        "% de pessoas que se sentem preparadas (pulso).",
      ],
      [
        "administrativo",
        60,
        "Acompanhamento de quem está aprendendo",
        "Dar suporte próximo nas primeiras vezes em que a pessoa enfrenta uma tarefa nova.",
        "Padrinho ou madrinha nas tarefas novas.",
        "Revisão conjunta das primeiras entregas.",
        ISO,
        "Tempo até a autonomia nas tarefas novas.",
      ],
      [
        "protecao",
        90,
        "Desenvolver habilidades para lidar com pressão",
        "Oferecer recursos de organização pessoal e manejo do estresse.",
        "Oficina de organização do tempo e prioridades.",
        "Programa de bem-estar com práticas de manejo do estresse.",
        ISO,
        "Participação e avaliação das oficinas.",
      ],
    ],
  ],
  [
    "saude_geral",
    [
      [
        "protecao",
        60,
        "Ampliar o acesso a cuidados de saúde",
        "Facilitar consultas e exames, com orientação sobre a rede disponível.",
        "Campanhas de saúde com exames no local de trabalho.",
        "Orientação sobre o uso do plano ou da rede pública.",
        ISO,
        "Adesão às campanhas e consultas realizadas.",
      ],
      [
        "administrativo",
        90,
        "Programa de qualidade de vida",
        "Ações contínuas de atividade física, alimentação e descanso.",
        "Ginástica laboral e incentivo à atividade física.",
        "Orientação nutricional e pausas para alimentação adequada.",
        ISO,
        "Participação no programa e evolução da saúde autoavaliada.",
      ],
      [
        "administrativo",
        60,
        "Acompanhar afastamentos e retornos",
        "Analisar as causas de afastamento e planejar o retorno ao trabalho com cuidado.",
        "Análise trimestral dos afastamentos com o médico do trabalho.",
        "Plano de retorno gradual combinado com a pessoa.",
        NR1,
        "Dias de afastamento e retornos acompanhados.",
      ],
    ],
  ],
  [
    "stress",
    [
      [
        "eliminacao",
        30,
        "Atacar as principais fontes de tensão",
        "Identificar com a equipe o que mais causa tensão e corrigir as causas no trabalho, não só nas pessoas.",
        "Grupo de escuta para listar as fontes de tensão e priorizar ações.",
        "Revisão das metas e prazos que mais pressionam.",
        NR1,
        "Fontes de tensão tratadas e evolução do estresse na pesquisa.",
      ],
      [
        "protecao",
        60,
        "Apoio psicológico acessível",
        "Disponibilizar atendimento psicológico sigiloso para quem precisar.",
        "Convênio ou programa de apoio com atendimento sigiloso.",
        "Parceria com serviço de saúde mental da região.",
        ISO,
        "Procura pelo apoio (número agregado, sem identificar ninguém).",
      ],
      [
        "administrativo",
        60,
        "Ensinar a liderança a reconhecer sinais de estresse",
        "Preparar líderes para notar mudanças de comportamento e conversar a tempo.",
        "Treino de sinais de alerta e conversa de cuidado.",
        "Roteiro de conversa e de encaminhamento.",
        ISO,
        "% de líderes treinados.",
      ],
    ],
  ],
  [
    "burnout",
    [
      [
        "eliminacao",
        30,
        "Reduzir a sobrecarga contínua",
        "Rever jornada, horas extras e acúmulo de funções nas áreas com mais esgotamento.",
        "Limite de horas extras por pessoa no mês.",
        "Redistribuição de tarefas acumuladas.",
        NR17,
        "Horas extras por pessoa e funções acumuladas.",
      ],
      [
        "administrativo",
        60,
        "Garantir descanso e férias",
        "Assegurar intervalos, folgas e férias de fato, sem trabalho no período.",
        "Planejamento anual de férias por área.",
        "Regra de não contatar quem está de folga ou férias.",
        NR17,
        "Férias vencidas e folgas cumpridas.",
      ],
      [
        "protecao",
        30,
        "Acolher e encaminhar quem está esgotado",
        "Oferecer escuta e acesso rápido a cuidado profissional, com ajuste temporário de tarefas.",
        "Encaminhamento ao médico do trabalho ou psicólogo.",
        "Ajuste temporário de carga combinado com a pessoa.",
        ISO,
        "Encaminhamentos feitos e retornos acompanhados (agregado).",
      ],
    ],
  ],
  [
    "problemas_dormir",
    [
      [
        "eliminacao",
        30,
        "Evitar demandas de trabalho à noite",
        "Proibir cobranças e mensagens fora do horário que tirem o descanso.",
        "Regra de desconexão no período noturno.",
        "Plantão definido para as urgências reais.",
        NR17,
        "Mensagens e chamados fora do horário.",
      ],
      [
        "substituicao",
        60,
        "Organizar turnos que respeitem o descanso",
        "Rever escalas noturnas e trocas de turno para garantir recuperação entre jornadas.",
        "Rodízio de turnos no sentido manhã, tarde e noite.",
        "Intervalo mínimo garantido entre jornadas.",
        NR17,
        "Escalas com descanso mínimo respeitado (%).",
      ],
      [
        "protecao",
        90,
        "Orientar sobre higiene do sono",
        "Oferecer informação e apoio para melhorar a qualidade do sono.",
        "Palestra ou material sobre sono e trabalho.",
        "Encaminhamento para avaliação de saúde quando necessário.",
        ISO,
        "Participação nas ações e evolução do indicador de sono.",
      ],
    ],
  ],
  [
    "sintomas_depressivos",
    [
      [
        "protecao",
        30,
        "Garantir acesso rápido a cuidado em saúde mental",
        "Ter um caminho claro e sigiloso para quem precisa de ajuda profissional.",
        "Programa de apoio psicológico com atendimento sigiloso.",
        "Guia com os contatos da rede de saúde mental e do CVV (188).",
        ISO,
        "Procura pelo apoio (número agregado, sem identificar ninguém).",
      ],
      [
        "administrativo",
        60,
        "Combater o estigma da saúde mental",
        "Falar abertamente sobre saúde mental para que pedir ajuda seja visto como algo normal.",
        "Campanha interna com depoimentos e informações.",
        "Rodas de conversa conduzidas por profissional.",
        ISO,
        "Participação nas ações de conscientização.",
      ],
      [
        "administrativo",
        60,
        "Rever as condições de trabalho ligadas ao sofrimento",
        "Cruzar este resultado com carga, liderança e conflitos para atacar as causas no trabalho.",
        "Análise conjunta com o profissional de SST das dimensões em risco.",
        "Plano por área para as causas encontradas.",
        NR1,
        "Ações sobre as causas concluídas e evolução na próxima aplicação.",
      ],
    ],
  ],
  [
    "comportamentos_ofensivos",
    [
      [
        "eliminacao",
        30,
        "Política de tolerância zero ao assédio",
        "Publicar regras claras contra assédio moral, sexual e violência, com consequências definidas.",
        "Código de conduta revisado e assinado por todos.",
        "Comunicado da direção reforçando a política.",
        LEI,
        "% de pessoas que conhecem a política (pesquisa).",
      ],
      [
        "administrativo",
        30,
        "Canal de denúncia seguro e com retorno",
        "Garantir um canal sigiloso, com proteção contra retaliação e prazo para apurar e responder.",
        "Canal externo independente.",
        "Comissão interna de apuração com prazo definido.",
        OIT,
        "Denúncias recebidas, apuradas e prazo médio de resposta.",
      ],
      [
        "administrativo",
        60,
        "Treinar lideranças e CIPA na prevenção",
        "Capacitar para reconhecer, prevenir e agir diante de assédio e violência.",
        "Treinamento anual obrigatório para líderes e CIPA.",
        "Campanha para toda a empresa sobre o que é assédio.",
        CIPA,
        "% de líderes e membros da CIPA treinados.",
      ],
    ],
  ],
];

export const MEDIDAS_SUGERIDAS: readonly MedidaSugerida[] = BIBLIOTECA.flatMap(
  ([dimensaoId, linhas]) =>
    linhas.map(
      (
        [
          controle,
          prazoDias,
          titulo,
          descricao,
          opcaoA,
          opcaoB,
          referencia,
          indicador,
        ],
        i,
      ): MedidaSugerida => ({
        id: `${dimensaoId}-${i + 1}`,
        dimensaoId,
        controle,
        prazoDias,
        titulo,
        descricao,
        opcaoA,
        opcaoB,
        referencia,
        indicador,
      }),
    ),
);

const ORDEM_DO_CONTROLE: Readonly<Record<ControleNr1, number>> = {
  eliminacao: 0,
  substituicao: 1,
  administrativo: 2,
  protecao: 3,
};

/** As sugestões da dimensão, na ordem de controles da NR-1. */
export function sugestoesDa(dimensaoId: string): MedidaSugerida[] {
  return MEDIDAS_SUGERIDAS.filter((m) => m.dimensaoId === dimensaoId).sort(
    (a, b) =>
      ORDEM_DO_CONTROLE[a.controle] - ORDEM_DO_CONTROLE[b.controle] ||
      a.prazoDias - b.prazoDias,
  );
}

/** Texto sem acento e em minúsculas, para a busca. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** A sugestão contém todos os termos buscados (título, descrição, opções…). */
export function sugestaoCombina(m: MedidaSugerida, busca: string): boolean {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  const texto = normalizar(
    [m.titulo, m.descricao, m.opcaoA, m.opcaoB, m.indicador, m.referencia].join(
      " ",
    ),
  );
  return termos.every((t) => texto.includes(t));
}

/** O texto contém todos os termos buscados (sem acento; vazio: sim). */
export function textoCombina(texto: string, busca: string): boolean {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const alvo = normalizar(texto);
  return termos.every((t) => alvo.includes(t));
}

/** A dimensão aparece na busca pelo nome ou por alguma das sugestões. */
export function dimensaoCombina(
  dimensaoId: string,
  rotulo: string,
  busca: string,
): boolean {
  if (textoCombina(rotulo, busca)) return true;
  return sugestoesDa(dimensaoId).some((m) => sugestaoCombina(m, busca));
}

/** Prazo sugerido pelo nível: crítico mais curto; médio e baixo, 90 dias. */
export function prazoPeloNivel(
  m: MedidaSugerida,
  nivel: NivelNr1 | null,
): number {
  if (nivel === "critico") return Math.min(m.prazoDias, 30);
  if (nivel === "alto") return Math.min(m.prazoDias, 60);
  return Math.max(m.prazoDias, 90);
}

/** "Em até 30 dias". */
export const textoDoPrazo = (dias: number) => `Em até ${dias} dias`;

/** AAAA-MM-DD somado de N dias (dia civil, sem fuso). */
export function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const data = new Date(Date.UTC(a!, m! - 1, d! + dias));
  return data.toISOString().slice(0, 10);
}

/** A medida do plano a partir da sugestão (o RH ainda pode editar tudo). */
export function medidaDaSugestao(
  m: MedidaSugerida,
  id: string,
  hoje: string,
  nivel: NivelNr1 | null,
): MedidaDoPlano {
  return {
    id,
    dimensaoId: m.dimensaoId,
    titulo: m.titulo,
    descricao: `${m.descricao}\nOpção A: ${m.opcaoA}\nOpção B: ${m.opcaoB}\nReferência: ${m.referencia}`,
    controle: m.controle,
    responsavel: null,
    prazo: somarDias(hoje, prazoPeloNivel(m, nivel)),
    indicador: m.indicador,
    situacao: "planejada",
  };
}

/** Todas as dimensões têm sugestões (conferido nos testes). */
export const DIMENSOES_COM_SUGESTAO = new Set(
  MEDIDAS_SUGERIDAS.map((m) => m.dimensaoId),
);
export const TOTAL_DE_DIMENSOES = DIMENSOES_NR1.length;
