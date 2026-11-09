export function Footer() {
  return (
    <footer className="foot on-dark">
      <div className="wrap foot-in">
        <div>
          <a className="brand" href="#top" style={{ fontSize: 20 }}>
            PrepLens
          </a>
          <p style={{ marginTop: 10, maxWidth: "34ch" }}>A community archive of NST placement interviews. Written by seniors, for juniors.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#approach">Rounds</a>
          <a href="#companies">Companies</a>
          <a href="#guide">Prep guides</a>
          <a href="#privacy">Privacy</a>
          <a href="#share">Share yours</a>
        </nav>
      </div>
    </footer>
  );
}
