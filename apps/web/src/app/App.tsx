/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Só
 * "Cadastros" (Horários) tem tela própria (T043); os demais quatro destinos
 * mostram um estado vazio claro de módulo em preparação
 * (`ModuloEmPreparacao`). Sem autenticação, sessão ou dado real. A presença
 * deste shell não concede nem implica autorização: a tela renderizada
 * continua dependendo da decisão do servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { CadastroHorariosScreen } from "../screens/horarios";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** Descrição neutra por destino ainda sem tela própria. */
const DESCRICAO_EM_PREPARO: Record<string, string> = {
  inicio:
    "A tela inicial do painel ainda está em preparação. Quando estiver disponível, ela reunirá os atalhos autorizados ao seu papel.",
  pessoas:
    "O módulo de Pessoas ainda está em preparação. Quando estiver disponível, reunirá colaboradores, vínculos e movimentações.",
  ponto:
    "O módulo de Ponto ainda está em preparação. Quando estiver disponível, reunirá marcações, apuração e o espelho de ponto.",
  documentos:
    "O módulo de Documentos ainda está em preparação. Quando estiver disponível, reunirá publicação e consulta de documentos autorizados.",
};

function conteudoDoDestino(destinoId: string) {
  if (destinoId === "cadastros") {
    return <CadastroHorariosScreen />;
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
            destinoAtivoId === "cadastros" ? "horarios-titulo" : "modulo-titulo"
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
