/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Os cinco
 * destinos já têm tela própria: "Início" (Visão geral, T048), "Cadastros"
 * (Horários, T043), "Pessoas" (Horário de trabalho, T046), "Ponto"
 * (Verificar folhas, T045) e "Documentos" (Metadados, T047). Os atalhos da
 * Visão geral também trocam apenas esse mesmo estado local (`onNavegar` =
 * `setDestinoAtivoId`). Sem autenticação, sessão ou dado real. A presença
 * deste shell não concede nem implica autorização: a tela renderizada
 * continua dependendo da decisão do servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * `ModuloEmPreparacao` permanece importado como retorno defensivo de
 * `conteudoDoDestino` para qualquer destino fora da lista conhecida — hoje
 * inalcançável, já que todos os itens de `DESTINOS_PAINEL` têm tela própria.
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { DocumentosMetadadosScreen } from "../screens/documentos";
import { CadastroHorariosScreen } from "../screens/horarios";
import { InicioVisaoGeralScreen } from "../screens/inicio";
import { PessoasHorarioScreen } from "../screens/pessoas";
import { VerificarFolhasScreen } from "../screens/ponto";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  inicio: "inicio-visao-geral-titulo",
  cadastros: "horarios-titulo",
  pessoas: "pessoas-horario-titulo",
  ponto: "verificar-folhas-titulo",
  documentos: "documentos-metadados-titulo",
};

function conteudoDoDestino(
  destinoId: string,
  onNavegar: (destinoId: string) => void,
) {
  if (destinoId === "inicio") {
    return <InicioVisaoGeralScreen onNavegar={onNavegar} />;
  }
  if (destinoId === "cadastros") {
    return <CadastroHorariosScreen />;
  }
  if (destinoId === "pessoas") {
    return <PessoasHorarioScreen />;
  }
  if (destinoId === "ponto") {
    return <VerificarFolhasScreen />;
  }
  if (destinoId === "documentos") {
    return <DocumentosMetadadosScreen />;
  }
  const destino = DESTINOS_PAINEL.find((item) => item.id === destinoId);
  return (
    <ModuloEmPreparacao
      titulo={destino?.label ?? "Módulo"}
      descricao="Este módulo ainda está em preparação."
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
          {conteudoDoDestino(destinoAtivoId, setDestinoAtivoId)}
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
