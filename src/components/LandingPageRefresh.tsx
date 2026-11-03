import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BrainCircuit, Camera, Check,
  ChevronDown, ClipboardCheck, Eye, FileText, LockKeyhole, Menu,
  ShieldCheck, Stethoscope, UserPlus, X,
} from 'lucide-react';
import { SAMPLES } from '@/data/samples';
import { Link } from '@/lib/router';
import clinicianImage from '../image/doctor-consultation.jpg';
import './LandingPageRefresh.css';

interface LandingPageProps {
  onViewDemo: () => void;
}

const PROCESS_STEPS = [
  {
    number: '01',
    icon: Camera,
    title: 'Add an image to the case',
    description: 'Clinicians can upload a clear close-up image to begin an AI-assisted screening workflow.',
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'Review the model output',
    description: 'Explore the model category, risk indicator, visual cues, and patient-provided context together.',
  },
  {
    number: '03',
    icon: ClipboardCheck,
    title: 'Plan follow-up care',
    description: 'Document findings, share a structured report, and continue the patient conversation with clearer context.',
  },
];

const DISEASES = [
  { code: 'MEL', name: 'Melanoma' },
  { code: 'BCC', name: 'Basal cell carcinoma' },
  { code: 'AKIEC', name: 'Actinic keratosis' },
  { code: 'NV', name: 'Melanocytic nevus' },
  { code: 'BKL', name: 'Benign keratosis' },
  { code: 'DF', name: 'Dermatofibroma' },
  { code: 'VASC', name: 'Vascular lesion' },
];

const FAQS = [
  {
    question: 'Does Parakh diagnose skin cancer?',
    answer: 'No. Parakh provides preliminary AI-assisted screening and is not a medical diagnosis. A qualified dermatologist should assess any concerning or changing spot.',
  },
  {
    question: 'What happens to my image?',
    answer: 'Image handling depends on the processing mode configured for your session. In on-device mode, processing stays on your device; in cloud mode, images are processed and discarded after analysis.',
  },
  {
    question: 'Can I share a report with a doctor?',
    answer: 'Yes. Parakh includes patient and clinician accounts, report history, and appointment workflows to support follow-up care.',
  },
  {
    question: 'What does a screening report include?',
    answer: 'The report can include a model-generated category and confidence, a risk indicator, ABCDE observations, visual attention guidance, and suggested follow-up context.',
  },
];

export function LandingPageRefresh({ onViewDemo }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const demo = SAMPLES[0];

  return (
    <main className="parakh-home">
      <header className="home-header">
        <div className="home-nav">
          <Logo />
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#how">How it works</a>
            <a href="#coverage">Screening coverage</a>
            <a href="#privacy">Privacy & care</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="header-actions">
            <Link to="/register" className="header-account">
              <UserPlus aria-hidden="true" size={15} />
              <span>Create account</span>
            </Link>
            <Link to="/login" className="header-start">
              <Stethoscope aria-hidden="true" size={16} />
              <span>Clinician sign in</span>
            </Link>
          </div>
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            {menuOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
            <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#coverage" onClick={() => setMenuOpen(false)}>Screening coverage</a>
            <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy & care</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <Link to="/register" className="mobile-create-account" onClick={() => setMenuOpen(false)}>
              <UserPlus aria-hidden="true" size={16} /> Create account
            </Link>
          </nav>
        )}
      </header>

      <section className="home-hero" aria-labelledby="hero-title">
        <motion.div
          className="hero-copy"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        >
          <p className="hero-eyebrow"><span /> AI-assisted screening for clinicians</p>
          <h1 id="hero-title">A closer look.<br /><em>A clearer next step.</em></h1>
          <p className="hero-description">
            Parakh gives dermatology teams a clearer view of skin screening, structured insights, and the next step in patient care.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="button-primary">
              Clinician sign in <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <button type="button" className="button-quiet" onClick={onViewDemo}>
              Explore a sample report <ArrowUpRight aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="hero-assurances" aria-label="Screening principles">
            <span><ShieldCheck aria-hidden="true" size={16} /> Privacy-minded</span>
            <span><Eye aria-hidden="true" size={16} /> Explainable results</span>
            <span><Stethoscope aria-hidden="true" size={16} /> Clinician-led care</span>
          </div>
        </motion.div>

        <motion.figure
          className="hero-photo"
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.12, ease: 'easeOut' }}
        >
          <img
            src={clinicianImage}
            alt="A clinician examines a patient's skin during a dermatology consultation"
            decoding="async"
          />
          <figcaption>
            <span><span className="caption-indicator" /> Care guided by clinicians</span>
            <span>Parakh · Skin health</span>
          </figcaption>
        </motion.figure>
      </section>

      <section className="capability-band" aria-label="Parakh screening features">
        <div className="capability-item"><strong>07</strong><span>screening label classes</span></div>
        <div className="capability-item"><span className="capability-icon"><Eye aria-hidden="true" size={19} /></span><span>Visual attention guidance</span></div>
        <div className="capability-item"><span className="capability-icon"><FileText aria-hidden="true" size={19} /></span><span>Structured report & follow-up</span></div>
        <div className="capability-note">
          <span className="capability-icon"><ShieldCheck aria-hidden="true" size={19} /></span>
          <span>Screening support, not a diagnosis.</span>
        </div>
      </section>

      <section id="how" className="process-section" aria-labelledby="process-title">
        <div className="section-intro">
          <p className="section-kicker">A considered process</p>
          <h2 id="process-title">From image to<br /><em>informed conversation.</em></h2>
          <p>Each step is designed to make the information easier to understand and easier to bring into care.</p>
        </div>
        <div className="process-list">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.article
                className="process-step"
                key={step.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.09 }}
              >
                <span className="step-number">{step.number}</span>
                <span className="step-icon"><Icon aria-hidden="true" size={20} /></span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="report-section" aria-labelledby="report-title">
        <div className="report-layout">
          <div className="report-copy">
            <p className="section-kicker">Understand the result</p>
            <h2 id="report-title">More than a score.<br /><em>A report with context.</em></h2>
            <p>Explore the sample report to see how Parakh brings together a model output, visual cues, and structured observations.</p>
            <ul className="report-highlights">
              <li><Check aria-hidden="true" size={16} /> Seven-class model output</li>
              <li><Check aria-hidden="true" size={16} /> ABCDE observations</li>
              <li><Check aria-hidden="true" size={16} /> Visual attention map</li>
              <li><Check aria-hidden="true" size={16} /> Follow-up guidance</li>
            </ul>
            <button type="button" className="text-action" onClick={onViewDemo}>View the sample report <ArrowRight aria-hidden="true" size={16} /></button>
          </div>

          <div className="sample-report" aria-label="Illustrative sample screening report">
            <div className="sample-report-header">
              <div><span className="report-overline">PARAKH · SAMPLE CASE A</span><h3>Screening overview</h3></div>
              <span className="sample-badge">Illustrative</span>
            </div>
            <div className="sample-result">
              <span className="sample-case-mark" aria-hidden="true">A</span>
              <div className="sample-result-copy">
                <span className="result-label">Model category</span>
                <strong>{demo.primaryPrediction}</strong>
                <span className="risk-indicator"><span /> Lower risk indicator</span>
              </div>
            </div>
            <div className="confidence-row">
              <div><span>Sample model confidence</span><strong>{demo.confidence.toFixed(1)}%</strong></div>
              <div className="confidence-track"><span style={{ width: `${demo.confidence}%` }} /></div>
            </div>
            <div className="report-detail-row">
              <span><BadgeCheck aria-hidden="true" size={15} /> ABCDE observations</span>
              <span><Eye aria-hidden="true" size={15} /> Visual cues</span>
              <span><FileText aria-hidden="true" size={15} /> Next steps</span>
            </div>
            <p className="report-note">An illustrative AI screening aid. Not a medical diagnosis.</p>
          </div>
        </div>
      </section>

      <section id="coverage" className="coverage-section" aria-labelledby="coverage-title">
        <div className="coverage-heading">
          <div><p className="section-kicker">Screening coverage</p><h2 id="coverage-title">Seven model<br /><em>label classes.</em></h2></div>
          <p>These are categories used by the current screening model. They are not confirmed diagnoses and should be reviewed in clinical context.</p>
        </div>
        <div className="disease-list">
          {DISEASES.map((disease, index) => (
            <div className="disease-row" key={disease.code}>
              <span className="disease-index">0{index + 1}</span>
              <span className="disease-name">{disease.name}</span>
              <span className="disease-code">{disease.code}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" className="care-section" aria-labelledby="care-title">
        <div className="care-intro">
          <p className="section-kicker">Thoughtful by design</p>
          <h2 id="care-title">Technology that<br /><em>knows its place.</em></h2>
          <p>Useful screening belongs in a broader care journey. Parakh supports patient records and clinician workflows while keeping the limits of AI clear.</p>
        </div>
        <div className="care-points">
          <article><span className="care-icon"><LockKeyhole aria-hidden="true" size={19} /></span><div><h3>Private patient accounts</h3><p>Keep screening history and care information in a secure, role-based workspace.</p></div></article>
          <article><span className="care-icon"><Stethoscope aria-hidden="true" size={19} /></span><div><h3>Clinician review</h3><p>Share structured findings as a starting point for a professional conversation.</p></div></article>
          <article><span className="care-icon"><ShieldCheck aria-hidden="true" size={19} /></span><div><h3>Clear boundaries</h3><p>AI screening can inform a next step, but it cannot replace an in-person medical assessment.</p></div></article>
          <p className="care-footnote">Image handling depends on the processing mode configured for your session.</p>
        </div>
      </section>

      <section id="faq" className="faq-section" aria-labelledby="faq-title">
        <div className="faq-heading"><p className="section-kicker">A few important details</p><h2 id="faq-title">Questions, answered.</h2><p>Good health tools should be clear about what they can and cannot do.</p></div>
        <div className="faq-list">{FAQS.map((item) => <FAQItem key={item.question} question={item.question} answer={item.answer} />)}</div>
      </section>

      <section className="closing-band" aria-label="Start using Parakh">
        <div><p className="section-kicker">Begin with a clearer picture</p><h2>A thoughtful next step<br /><em>starts here.</em></h2></div>
        <div className="closing-actions">
          <Link to="/register" className="button-primary"> <UserPlus aria-hidden="true" size={17} /> Create an account <ArrowUpRight aria-hidden="true" size={16} /></Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Logo() {
  return (
    <Link to="/" className="home-logo" aria-label="Parakh home">
      <span className="logo-mark" aria-hidden="true">P<sup>+</sup></span>
      <span className="logo-word">Parakh<span>Skin health, thoughtfully</span></span>
    </Link>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();

  return (
    <article className={`faq-item${open ? ' is-open' : ''}`}>
      <h3>
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={answerId}>
          <span>{question}</span><ChevronDown aria-hidden="true" size={19} />
        </button>
      </h3>
      <motion.div
        id={answerId}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        aria-hidden={!open}
        className="faq-answer-wrap"
      >
        <p>{answer}</p>
      </motion.div>
    </article>
  );
}

function Footer() {
  return (
    <footer className="home-footer">
      <div className="footer-main">
        <div className="footer-brand-block"><Logo /><p>AI-assisted skin screening and connected dermatology care.</p></div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#how">How it works</a><a href="#coverage">Screening coverage</a><a href="#privacy">Privacy & care</a><Link to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="footer-disclaimer"><ShieldCheck aria-hidden="true" size={18} /><p><strong>Medical note</strong> Parakh is a preliminary AI screening tool, not a substitute for professional medical diagnosis. Consult a qualified dermatologist about concerns or changing lesions.</p></div>
      <div className="footer-bottom"><span>© 2026 Parakh</span><span>Designed for clearer conversations about skin health.</span></div>
    </footer>
  );
}