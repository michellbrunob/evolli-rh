/**
 * Shell inicial do Painel Administrativo Web V1 (T003).
 *
 * Sem dado de domínio, sem tela de módulo e sem fluxo de negócio — apenas o
 * envoltório visual neutro sobre o qual telas futuras serão construídas.
 * A presença deste shell não concede nem implica autorização: cada tela
 * futura continuará dependendo da decisão do servidor por papel, escopo e
 * objeto (docs/modules/painel-administrativo-web-v1.md, §3.6).
 */
import "./app-shell.css";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">Evolli RH</span>
        <span className="app-shell__subtitle">Painel Administrativo</span>
      </header>
      <main className="app-shell__main">
        <p>Nenhum módulo disponível nesta versão inicial do shell.</p>
      </main>
    </div>
  );
}
