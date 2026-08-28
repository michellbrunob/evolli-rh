/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. "Cadastros"
 * (Horários, T043), "Pessoas" (Horário de trabalho, T046) e "Ponto"
 * (Verificar folhas, T045) têm tela própria; os demais dois destinos mostram
 * um estado vazio claro de módulo em preparação (`ModuloEmPreparacao`). Sem
 * autenticação, sessão ou dado real. A presença deste shell não concede nem
 * implica autorização: a tela renderizada continua dependendo da decisão do
 * servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { CadastroHorariosScreen } from "../screens/horarios";
import { PessoasHorarioScreen } from "../screens/pessoas";
import { VerificarFolhasScreen } from "../screens/ponto";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** Descrição neutra por destino ainda sem tela própria. */
const DESCRICAO_EM_PREPARO: Record<string, string> = {
  inicio:
    "A tela inicial do painel ainda está em preparação. Quando estiver disponível, ela reunirá os atalhos autorizados ao seu papel.",
  documentos:
    "O módulo de Documentos ainda está em preparação. Quando estiver disponível, reunirá publicação e consulta de documentos autorizados.",
};

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  cadastros: "horarios-titulo",
  pessoas: "pessoas-horario-titulo",
  ponto: "verificar-folhas-titulo",
};

function conteudoDoDestino(destinoId: string) {
  if (destinoId === "cadastros") {
    return <CadastroHorariosScreen />;
  }
  if (destinoId === "pessoas") {
    return <PessoasHorarioScreen />;
  }
  if (destinoId === "ponto") {
    return <VerificarFolhasScreen />;
  }
  const destino = DESTINOS_PAINEL.find((item) => item.id === destinoId);
  return (
    <ModuloEmPreparacao
      titulo={destino?.label ?? "Módulo"}
      descricao={
        DESCRICAO_EM_PREPARO[destinoId] ??
        "Este módulo ainda está em preparação."
      }
    />
  );
}

export function App() {
  const [destinoAtivoId, setDestinoAtivoId] = useState("cadastros");

  return (
    <div className="app-shell">
      <a className="app-shell__skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>

      <header className="app-shell__topbar">
        <div className="app-shell__topbar-inner">
          <span className="app-shell__brand">Evolli RH</span>
          <span className="app-shell__brand-tag">Painel Administrativo</span>
        </div>
      </header>

      <div className="app-shell__body">
        <PainelNavigation
          destinoAtivoId={destinoAtivoId}
          onSelecionar={setDestinoAtivoId}
        />

        <main
          id="conteudo-principal"
          className="app-shell__main"
          tabIndex={-1}
          aria-labelledby={
            TITULO_ID_POR_DESTINO[destinoAtivoId] ?? "modulo-titulo"
          }
        >
          {conteudoDoDestino(destinoAtivoId)}
        </main>
      </div>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <span className="app-shell__footer-brand">Evolli RH</span>
          <span>Painel Administrativo — fundação visual</span>
          <span>Ambiente interno · sem dados reais</span>
        </div>
      </footer>
    </div>
  );
}
