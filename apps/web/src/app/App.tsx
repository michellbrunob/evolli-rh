/**
 * Shell do Painel Administrativo Web (fundação visual UI-F01).
 *
 * Apenas o envoltório visual neutro e a fundação de estilo reutilizável sobre a
 * qual telas futuras serão construídas — sem dado de domínio, sem tela de
 * módulo, sem autenticação e sem fluxo de negócio. A presença deste shell não
 * concede nem implica autorização: cada tela futura continuará dependendo da
 * decisão do servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado aqui:
 * não há login nem sessão nesta fundação.
 */
import "./tokens.css";
import "./app-shell.css";

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
        aria-labelledby="shell-titulo"
      >
        <section className="app-shell__empty">
          <h1 id="shell-titulo" className="app-shell__empty-title">
            Fundação visual pronta
          </h1>
          <p className="app-shell__empty-text">
            Esta é a base visual reutilizável do painel administrativo. As telas
            de trabalho aparecem aqui quando disponíveis.
          </p>
        </section>
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
