import { demoUrl } from "./demo";

export default function SiteHeader() {
  const demo = demoUrl();
  return <header className="site-header">
    <a className="brand" href="/"><span className="brand-mark">M</span><span>MY MEME</span></a>
    <nav aria-label="Primary navigation">
      <a className="nav-link active" href="/" aria-current="page">Evaluations</a>
      {demo && <a className="nav-link" href={demo} target="_blank" rel="noreferrer">Try My Meme ↗</a>}
      <a className="nav-link" href="https://github.com/ellaxin/my-meme" target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>
  </header>;
}
