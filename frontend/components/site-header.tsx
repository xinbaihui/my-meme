import Link from 'next/link';
import { demoUrl } from '../lib/demo';

export default function SiteHeader({ active }: { active: 'overview' | 'evals' }) {
  const demo = demoUrl();
  return <header className="site-header">
    <Link className="brand" href="/"><span className="brand-mark">M</span><span>MY MEME</span></Link>
    <nav aria-label="Primary navigation">
      <Link className={`nav-link ${active === 'overview' ? 'active' : ''}`} href="/">Overview</Link>
      <Link className={`nav-link ${active === 'evals' ? 'active' : ''}`} href="/evals">Evaluations</Link>
      {demo && <a className="nav-link" href={demo} target="_blank" rel="noreferrer">Try My Meme ↗</a>}
      <a className="nav-link" href="https://github.com/ellaxin/my-meme" target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>
  </header>;
}
