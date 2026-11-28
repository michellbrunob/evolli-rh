/**
 * T216 — Perfil comportamental (DISC): os 4 fatores e o conteúdo de cada um
 * (textos do Evolli). Tudo que a tela, o relatório e a planilha dizem sobre
 * um fator sai daqui.
 */
import type { FatorDisc } from "../../../../api/pesquisasClient";

export type { FatorDisc };

export const FATORES: readonly FatorDisc[] = ["D", "I", "S", "C"];

export interface ConteudoDoFator {
  readonly nome: string;
  /** Token de cor (sem `var()`). */
  readonly cor: string;
  readonly foco: string;
  readonly palavras: readonly [string, string, string];
  readonly comportamentos: readonly [string, string, string];
  /** Frase curta do resultado da pessoa. */
  readonly frase: string;
  /** Glossário. */
  readonly focoAnalisado: string;
  readonly quandoAlto: string;
  readonly quandoBaixo: string;
  /** Conteúdo do perfil (o fator como principal). */
  readonly resumo: string;
  readonly medo: string;
  readonly motivacao: string;
  readonly valoriza: string;
  readonly valor: string;
  readonly fortes: readonly string[];
  readonly atencao: readonly string[];
  readonly desenvolvimento: readonly string[];
  readonly comunicacao: string;
  readonly lideranca: string;
  readonly ambiente: string;
  readonly estresse: readonly string[];
  readonly sintese: string;
  readonly feedback: readonly string[];
  readonly motivar: readonly string[];
  /** 30, 60 e 90 dias. */
  readonly plano: readonly [string, string, string];
  /** Lacuna: o que buscar ao reforçar o fator. */
  readonly reforco: string;
  /** Fator ausente: o risco para o time. */
  readonly risco: string;
}

export const FATOR: Readonly<Record<FatorDisc, ConteudoDoFator>> = {
  D: {
    nome: "Dominância",
    cor: "--faixa-critico",
    foco: "Foco em resultados e desafios",
    palavras: ["Objetividade", "Decisão", "Resultado"],
    comportamentos: [
      "Decide com rapidez",
      "Persegue a meta",
      "Encara desafios",
    ],
    frase: "Decide rápido, vai direto ao ponto e busca resultado.",
    focoAnalisado: "Como reage a desafios e exerce poder",
    quandoAlto: "Assume o comando, compete e quer resultado logo",
    quandoBaixo: "Busca consenso, evita confronto e cede espaço",
    resumo:
      "Age rápido, assume a frente e transforma objetivos em entregas. Gosta de autonomia e de metas que exigem coragem.",
    medo: "Perder o controle da situação ou ficar à mercê de outras pessoas.",
    motivacao: "Desafios, autonomia e resultados que aparecem logo.",
    valoriza: "Competência, franqueza e entregas no prazo.",
    valor:
      "Destrava projetos parados, decide quando ninguém decide e mantém o foco na meta.",
    fortes: [
      "Decide com rapidez, mesmo sob pressão",
      "Assume responsabilidade pelo resultado",
      "Enfrenta problemas difíceis de frente",
      "Mantém o time orientado a metas",
      "Age com iniciativa, sem esperar ordem",
      "Lida bem com prazos apertados",
    ],
    atencao: [
      "Pode atropelar pessoas e processos",
      "Tende a ouvir pouco antes de decidir",
      "Demonstra impaciência com ritmos mais lentos",
      "Pode cobrar de forma dura demais",
      "Arrisca demais quando quer vencer",
    ],
    desenvolvimento: [
      "Ouvir a equipe antes de bater o martelo",
      "Explicar o porquê das decisões",
      "Reconhecer o esforço, não só o resultado",
      "Dar espaço para outras pessoas liderarem",
    ],
    comunicacao: "Direta e curta: vai ao ponto e espera o mesmo em troca.",
    lideranca: "Pela meta e pelo desafio, com muita autonomia para o time.",
    ambiente: "Dinâmico, com metas claras e liberdade para decidir.",
    estresse: [
      "Microgerenciamento",
      "Reuniões longas sem decisão",
      "Burocracia que atrasa a entrega",
      "Falta de autonomia",
    ],
    sintese:
      "Faz acontecer. O passo seguinte é levar as pessoas junto enquanto acelera.",
    feedback: [
      "Seja breve e vá direto ao fato",
      "Mostre o impacto no resultado",
      "Proponha uma meta para a próxima vez",
    ],
    motivar: [
      "Dê desafios com dono e prazo",
      "Ofereça autonomia na forma de fazer",
      "Reconheça conquistas em público",
    ],
    plano: [
      "Praticar escuta ativa nas reuniões do time",
      "Delegar uma decisão importante e acompanhar sem interferir",
      "Conduzir um projeto pedindo opinião antes de cada decisão",
    ],
    reforco:
      "Busque pessoas que decidam com rapidez, assumam riscos calculados e puxem a execução.",
    risco:
      "Sem esse fator, o time pode demorar a decidir e perder o senso de urgência.",
  },
  I: {
    nome: "Influência",
    cor: "--faixa-atencao",
    foco: "Foco em pessoas e entusiasmo",
    palavras: ["Comunicação", "Entusiasmo", "Persuasão"],
    comportamentos: [
      "Comunica com energia",
      "Faz contatos com facilidade",
      "Contagia com otimismo",
    ],
    frase: "Comunica bem, contagia o grupo e convence com facilidade.",
    focoAnalisado: "Como interage com pessoas e convence",
    quandoAlto: "Fala com desenvoltura, anima o grupo e cria vínculos",
    quandoBaixo: "Prefere ouvir, se apoia em fatos e fala pouco",
    resumo:
      "Conecta pessoas, cria entusiasmo e convence com facilidade. Rende mais quando pode trocar ideias e recebe reconhecimento.",
    medo: "Rejeição, isolamento ou perda de prestígio no grupo.",
    motivacao: "Reconhecimento, convívio e liberdade para se expressar.",
    valoriza: "Abertura, bom humor e colaboração.",
    valor:
      "Engaja o time, aproxima áreas e leva ideias adiante com entusiasmo.",
    fortes: [
      "Comunica ideias de forma envolvente",
      "Cria relações de confiança rapidamente",
      "Mantém o time animado em momentos difíceis",
      "Convence pessoas e destrava resistências",
      "Traz criatividade e ideias novas",
      "Representa bem o time fora dele",
    ],
    atencao: [
      "Pode perder o foco em detalhes",
      "Promete mais do que consegue entregar",
      "Evita conversas difíceis para não desagradar",
      "Dispersa a energia em muitas frentes",
      "Decide pela emoção do momento",
    ],
    desenvolvimento: [
      "Organizar prioridades por escrito",
      "Fechar compromissos com prazo",
      "Acompanhar a entrega até o fim",
      "Ouvir mais antes de propor",
    ],
    comunicacao: "Expressiva e calorosa, com histórias e exemplos.",
    lideranca: "Pela inspiração: motiva, celebra e dá visibilidade ao time.",
    ambiente: "Colaborativo, com troca de ideias e espaço para criar.",
    estresse: [
      "Trabalho isolado por muito tempo",
      "Críticas em público",
      "Rotina repetitiva",
      "Falta de reconhecimento",
    ],
    sintese:
      "Move pessoas. O passo seguinte é transformar entusiasmo em entrega constante.",
    feedback: [
      "Comece pelo que deu certo",
      "Fale em particular, com tom próximo",
      "Combine o próximo passo por escrito",
    ],
    motivar: [
      "Dê visibilidade ao trabalho",
      "Envolva em projetos com muita interação",
      "Celebre conquistas com o time",
    ],
    plano: [
      "Usar uma lista de prioridades semanal",
      "Entregar um projeto com cronograma acompanhado",
      "Conduzir uma conversa difícil com preparo prévio",
    ],
    reforco:
      "Busque pessoas que comuniquem bem, criem vínculos e animem o time.",
    risco:
      "Sem esse fator, o time pode ficar fechado, com pouca troca e pouco entusiasmo.",
  },
  S: {
    nome: "Estabilidade",
    cor: "--faixa-forte",
    foco: "Foco em estabilidade e cooperação",
    palavras: ["Constância", "Cooperação", "Calma"],
    comportamentos: [
      "Escuta com atenção",
      "Mantém o ritmo das entregas",
      "Apoia o time",
    ],
    frase: "Tem paciência, cumpre o combinado e coopera com o time.",
    focoAnalisado: "Como lida com mudanças e com o ritmo",
    quandoAlto: "Mantém a calma, é leal e gosta de previsibilidade",
    quandoBaixo: "Se adapta rápido, gosta de variedade e de mudança",
    resumo:
      "Dá constância ao trabalho, apoia quem está ao lado e mantém o clima tranquilo. Rende mais com previsibilidade.",
    medo: "Mudanças bruscas, conflitos e perda de segurança.",
    motivacao: "Estabilidade, harmonia e o sentimento de fazer parte.",
    valoriza: "Lealdade, respeito e combinados cumpridos.",
    valor:
      "Sustenta a rotina, acolhe pessoas novas e garante entregas consistentes.",
    fortes: [
      "Mantém a calma em momentos tensos",
      "Cumpre o que combina",
      "Escuta com paciência",
      "Apoia colegas sem esperar pedido",
      "Dá continuidade ao trabalho",
      "Cria um clima de confiança",
    ],
    atencao: [
      "Pode resistir a mudanças",
      "Evita conflitos necessários",
      "Demora a dizer não",
      "Guarda desconfortos para si",
      "Leva tempo para se adaptar a novidades",
    ],
    desenvolvimento: [
      "Expor discordâncias no momento certo",
      "Testar formas novas de trabalhar",
      "Pedir ajuda quando a carga pesar",
      "Assumir a frente de pequenas mudanças",
    ],
    comunicacao: "Gentil e paciente, com tom calmo e acolhedor.",
    lideranca: "Pelo apoio: cuida das pessoas e mantém o time unido.",
    ambiente: "Tranquilo, estável e com combinados claros.",
    estresse: [
      "Mudanças sem aviso",
      "Conflitos abertos no time",
      "Pressão constante por velocidade",
      "Incerteza sobre o futuro",
    ],
    sintese:
      "Dá segurança ao time. O passo seguinte é ganhar conforto com a mudança.",
    feedback: [
      "Escolha um momento reservado",
      "Explique o contexto com calma",
      "Mostre que a relação continua firme",
    ],
    motivar: [
      "Antecipe mudanças com explicação",
      "Valorize a constância e a lealdade",
      "Inclua nas decisões do time",
    ],
    plano: [
      "Expor uma opinião diferente numa reunião",
      "Testar um processo novo com apoio",
      "Conduzir uma mudança pequena do começo ao fim",
    ],
    reforco:
      "Busque pessoas pacientes, que deem constância às entregas e cuidem do clima.",
    risco:
      "Sem esse fator, o time pode perder constância, paciência e cuidado com as pessoas.",
  },
  C: {
    nome: "Conformidade",
    cor: "--grafico-1",
    foco: "Foco em qualidade e precisão",
    palavras: ["Precisão", "Análise", "Qualidade"],
    comportamentos: [
      "Atenção aos detalhes",
      "Decide com dados",
      "Segue critérios",
    ],
    frase: "Analisa com cuidado e preza a precisão e a qualidade.",
    focoAnalisado: "Como responde a regras e padrões",
    quandoAlto: "Segue padrões, analisa tudo e busca a excelência",
    quandoBaixo: "Questiona regras, prefere o todo aos detalhes",
    resumo:
      "Analisa antes de agir, segue critérios e busca a entrega certa. Rende mais com tempo, informação e padrões claros.",
    medo: "Errar, receber críticas pelo trabalho ou agir sem informação.",
    motivacao: "Qualidade, lógica e regras bem definidas.",
    valoriza: "Precisão, coerência e argumentos com base em dados.",
    valor: "Reduz riscos, evita retrabalho e eleva o padrão das entregas.",
    fortes: [
      "Percebe detalhes que passam despercebidos",
      "Decide com base em dados",
      "Organiza processos e documentos",
      "Mantém alto padrão de qualidade",
      "Antecipa riscos e falhas",
      "Segue normas com rigor",
    ],
    atencao: [
      "Pode demorar para decidir",
      "Tende ao perfeccionismo",
      "Pode passar uma imagem de distância",
      "Resiste a improvisos",
      "Se fecha quando é pressionado",
    ],
    desenvolvimento: [
      "Definir o que é bom o bastante",
      "Decidir com a informação disponível",
      "Compartilhar o raciocínio com o time",
      "Aceitar caminhos diferentes do seu",
    ],
    comunicacao: "Clara e fundamentada, com dados e por escrito.",
    lideranca: "Pelo padrão: define critérios e acompanha a qualidade.",
    ambiente: "Organizado, com processos claros e tempo para análise.",
    estresse: [
      "Prazos sem tempo para revisar",
      "Mudança de regra sem explicação",
      "Desorganização",
      "Críticas sem fundamento",
    ],
    sintese:
      "Garante que seja bem feito. O passo seguinte é decidir no tempo do negócio.",
    feedback: [
      "Traga fatos e exemplos concretos",
      "Dê tempo para pensar antes de responder",
      "Deixe o critério de sucesso por escrito",
    ],
    motivar: [
      "Dê tempo e informação para fazer bem feito",
      "Valorize a qualidade e a precisão",
      "Explique a lógica das decisões",
    ],
    plano: [
      "Combinar um prazo máximo para cada análise",
      "Entregar uma versão inicial e melhorar com retorno",
      "Apresentar ao time a análise de um problema",
    ],
    reforco:
      "Busque pessoas analíticas, que cuidem da qualidade e sigam critérios.",
    risco:
      "Sem esse fator, o time pode errar em detalhes e repetir retrabalho.",
  },
};

export const nomeDoFator = (f: FatorDisc) => FATOR[f].nome;
export const corDoFator = (f: FatorDisc) => `var(${FATOR[f].cor})`;
