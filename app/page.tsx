export default function HomePage() {
  return (
    <main className="container">
      <div className="hero">
        <div>
          <span className="badge">Live classroom</span>
          <h1 className="title">Online Polish Classes, Face-to-Face.</h1>
          <p className="subtitle">
            Share a room link and teach instantly. No logins, no setup — just real-time video,
            audio, and chat in a focused learning space.
          </p>
          <div className="grid" style={{ maxWidth: 420 }}>
            <a className="button" href="/room/demo">Open demo room</a>
            <a className="button ghost" href="/room/new-class">Start a new class</a>
          </div>
        </div>
        <div className="card fade-in">
          <h2 style={{ marginTop: 0 }}>What you get</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)', lineHeight: 1.6 }}>
            <li>HD video and clear audio for every participant.</li>
            <li>Chat stream tailored to teaching moments.</li>
            <li>Teacher-first flow: open the room and wait.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
