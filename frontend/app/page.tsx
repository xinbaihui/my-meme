import SiteHeader from '../components/site-header';
import { demoUrl } from '../lib/demo';

export default function Home() {
  const demo = demoUrl();
  return <main>
    <SiteHeader active="overview" />
    <section className="overview-intro shell">
      <div className="eyebrow">AGENT ENGINEERING · MY MEME</div>
      <p className="portfolio-lede">An Agent that finds reaction GIFs, searches meme templates, and creates custom captions.</p>
      <div className="portfolio-actions">
        {demo ? <a className="primary-button" href={demo} target="_blank" rel="noreferrer">Try My Meme ↗</a> : <span className="demo-unavailable">Live demo coming soon</span>}
      </div>
      <p className="demo-caption">Live demo opens in DSH Web.</p>
    </section>
    <section className="overview-contributions shell" aria-labelledby="contributions-heading">
      <h2 id="contributions-heading">What I built</h2>
      <div className="overview-summary">
        <article><span className="section-number">01 / SKILL</span><h3>Routing & clarification</h3><p>Choose the right format and ask when the request is unclear.</p></article>
        <article><span className="section-number">02 / TOOLS</span><h3>Memegen & GIPHY</h3><p>Three tools for template search, GIF search, and caption generation.</p></article>
        <article><span className="section-number">03 / EVALUATIONS</span><h3>Recorded evidence</h3><p>Check tool selection and ordering against saved Agent trajectories.</p></article>
      </div>
    </section>
    <footer className="site-footer shell"><span>BUILT ON DEEPSEEK HARNESS</span><span>My Meme · Agent engineering</span></footer>
  </main>;
}
