/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03).
 *
 * Envoltório visual neutro (banner, skip-link, main, rodapé) renderizando a
 * primeira tela de domínio do painel — Cadastros > Horários (T043) — como
 * conteúdo inicial. Sem autenticação, sessão, rota real ou dado real. A
 * presença deste shell não concede nem implica autorização: a tela renderizada
 * continua dependendo da decisão do servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6) — a autenticação real
 * ainda não existe, e nenhum dado aqui é obtido de rede.
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 */
import "./tokens.css";
import "./app-shell.css";
import { CadastroHorariosScreen } from "../screens/horarios";

export function App() {
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

      <main
        id="conteudo-principal"
        className="app-shell__main"
        tabIndex={-1}
        aria-labelledby="horarios-titulo"
      >
        <CadastroHorariosScreen />
      </main>

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
