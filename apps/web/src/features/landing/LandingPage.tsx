import { Link } from '@tanstack/react-router';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CircleHelp,
  Github,
  LockKeyhole,
  Play,
  Workflow,
} from 'lucide-react';

const sampleSteps = [
  {
    number: '01',
    kind: 'Trigger',
    title: 'New form response',
    source: 'Webhook',
    state: 'Received',
    color: 'violet',
  },
  {
    number: '02',
    kind: 'Request',
    title: 'Look up the lead',
    source: 'HTTP request',
    state: '200 · 184 ms',
    color: 'blue',
  },
  {
    number: '03',
    kind: 'Condition',
    title: 'Is this a qualified lead?',
    source: 'Filter',
    state: 'Matched',
    color: 'amber',
  },
  {
    number: '04',
    kind: 'Action',
    title: 'Add to your pipeline',
    source: 'Google Sheets',
    state: 'Row 248 added',
    color: 'green',
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav wrap-wide">
        <Link to="/" className="brand-lockup" aria-label="Mortein home">
          <span className="brand-mark">
            <Workflow size={17} strokeWidth={2.4} />
          </span>
          <span>Mortein</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link to="/wiki">Wiki</Link>
          <Link to="/app" className="nav-cta">
            Open the app <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <section className="landing-hero wrap-wide" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> Self-hosted workflow automation
          </div>
          <h1 id="hero-title">
            Make your workflows
            <br />
            <span>make sense.</span>
          </h1>
          <p className="hero-lede">
            Connect the tools you use. See every step run. Keep client workflows and credentials in
            your own hands.
          </p>
          <div className="hero-actions">
            <Link to="/app" className="button button-primary">
              Build your first workflow <ArrowRight size={16} />
            </Link>
            <a className="button button-quiet" href="#how-it-works">
              <Play size={15} /> See how it works
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <Check size={14} /> Self-hosted
            </span>
            <span>
              <Check size={14} /> Runs you can inspect
            </span>
            <span>
              <Check size={14} /> Separate client workspaces
            </span>
          </div>
        </div>

        <figure className="hero-preview" aria-label="Example workflow showing a successful run">
          <div className="preview-topline">
            <div className="preview-workflow-name">
              <span className="tiny-workflow-icon">
                <Workflow size={14} />
              </span>
              <span>Lead intake</span>
              <span className="preview-separator">/</span>
              <span className="preview-run-label">Latest run</span>
            </div>
            <span className="run-status">
              <span /> Succeeded
            </span>
          </div>
          <div className="preview-body">
            <aside className="preview-rail" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </aside>
            <div className="preview-steps">
              {sampleSteps.map((step, index) => (
                <div className="preview-step-wrap" key={step.number}>
                  <article className={`preview-step tone-${step.color}`}>
                    <div className="preview-step-icon">
                      {index === 0 ? '↳' : index === 1 ? '↗' : index === 2 ? '≋' : '▦'}
                    </div>
                    <div className="preview-step-copy">
                      <span className="preview-step-kind">{step.kind}</span>
                      <strong>{step.title}</strong>
                      <small>{step.source}</small>
                    </div>
                    <div className="preview-step-state">
                      <span className="state-check">
                        <Check size={12} />
                      </span>
                      {step.state}
                    </div>
                  </article>
                  {index < sampleSteps.length - 1 && (
                    <div className="preview-connector">
                      <span />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="preview-data-card">
              <div>
                <span>OUTPUT</span>
                <span aria-hidden="true">
                  <ArrowDownRight size={14} />
                </span>
              </div>
              <code>
                {'{'}
                <br />
                &nbsp; <i>"qualified"</i>: <b>true</b>,<br />
                &nbsp; <i>"sheetRow"</i>: <b>248</b>
                <br />
                {'}'}
              </code>
            </div>
          </div>
          <div className="preview-footer">
            <span>
              <LockKeyhole size={13} /> Running on your instance
            </span>
            <span>
              4 steps <b>·</b> 612 ms
            </span>
          </div>
          <figcaption className="visually-hidden">
            A successful four step lead intake workflow run.
          </figcaption>
        </figure>
        <div className="hero-index">
          01 <span>/</span> WORKFLOW
        </div>
      </section>

      <section className="trust-strip">
        <div className="wrap-wide trust-content">
          <p>Built for the people behind the process</p>
          <div>
            <span>Consultants</span>
            <i />
            <span>Operators</span>
            <i />
            <span>Small teams</span>
          </div>
        </div>
      </section>

      <section className="landing-how wrap-wide" id="how-it-works">
        <div className="section-intro">
          <div className="eyebrow">The useful part is knowing what happened</div>
          <h2>
            Automation you can
            <br />
            actually <em>follow.</em>
          </h2>
        </div>
        <div className="benefit-list">
          <article>
            <span className="benefit-number">01</span>
            <div>
              <h3>See the whole run</h3>
              <p>
                Inspect each step’s input, output, and failure. No more guessing where the data
                went.
              </p>
            </div>
          </article>
          <article>
            <span className="benefit-number">02</span>
            <div>
              <h3>Keep client work separate</h3>
              <p>Give each client a workspace with its own workflows and credentials.</p>
            </div>
          </article>
          <article>
            <span className="benefit-number">03</span>
            <div>
              <h3>Run it where you work</h3>
              <p>Self-host your automations and keep control of the data they process.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-cta wrap-wide">
        <div className="cta-rule" />
        <div>
          <span className="eyebrow">Your work. Your workflows.</span>
          <h2>Start with one flow.</h2>
          <p>Build a small automation, run it, and see every step for yourself.</p>
        </div>
        <Link to="/app" className="button button-primary">
          Open Mortein <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="landing-footer wrap-wide">
        <Link to="/" className="brand-lockup">
          <span className="brand-mark">
            <Workflow size={15} strokeWidth={2.4} />
          </span>
          <span>Mortein</span>
        </Link>
        <p>Workflows you can trust.</p>
        <div>
          <Link to="/wiki">
            <CircleHelp size={14} /> Help wiki
          </Link>
          <a href="https://github.com/paramcodes/mortein">
            <Github size={14} /> GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
