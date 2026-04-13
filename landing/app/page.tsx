import Link from 'next/link'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const APP_URL = 'https://knoswmba.parrytech.co'
const PARRYTECH_URL = 'https://www.parrytech.co'
const SIGNUP_URL = `${APP_URL}/signup`
const LOGIN_URL = `${APP_URL}/login`
const DEMO_URL = APP_URL

const features = [
  {
    icon: '⚡',
    title: 'AI Compilation',
    description:
      'Paste any article, document, or raw note. One click compiles it into a structured wiki note with wikilinks, headers, key concepts, and cross-references — using Claude or GPT-4o.',
  },
  {
    icon: '🕸️',
    title: 'Knowledge Graph',
    description:
      'Every compiled note automatically joins a live, interactive graph. Watch your research connect into a network of ideas. Click any node to open the note behind it.',
  },
  {
    icon: '💬',
    title: 'Chat With Your Vault',
    description:
      'Ask questions in plain English. KnowledgeOS retrieves the most relevant compiled notes and answers using your own knowledge — with citations pointing back to exact sources.',
  },
  {
    icon: '🎛️',
    title: 'Presets & Conventions',
    description:
      'Built-in presets for academics, lawyers, investors, and engineers — or build your own. Each preset steers how the AI compiles and names notes, without touching any code.',
  },
  {
    icon: '🔒',
    title: 'Local-First Option',
    description:
      'Point KnowledgeOS at a folder on your own machine. All vault reads and writes happen in your browser — no files leave your computer. Chromium-based browsers only.',
  },
  {
    icon: '📦',
    title: 'Obsidian Compatible',
    description:
      'All compiled notes are plain markdown with [[wikilinks]]. Open your vault in Obsidian at any time. No proprietary format, no lock-in. Your knowledge is yours.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Paste your sources',
    description:
      'Drop in articles, research papers, meeting notes, or any text you want to remember. KnowledgeOS stores them as raw notes — unprocessed, exactly as you added them.',
  },
  {
    number: '02',
    title: 'Compile to wiki',
    description:
      'Select one or more raw notes and hit Compile. The AI reads your sources, structures the information, extracts key concepts, and writes a linked wiki note in seconds.',
  },
  {
    number: '03',
    title: 'Query and explore',
    description:
      'Ask questions in the chat, explore the knowledge graph, or navigate wikilinks. Your vault gets smarter with every note you add — and so do your answers.',
  },
]

const useCases = [
  {
    role: 'Academics & Researchers',
    icon: '🎓',
    description:
      'Compile literature reviews, cross-reference findings, and chat with your reading list. Stop re-reading papers you already know.',
  },
  {
    role: 'Lawyers & Legal Professionals',
    icon: '⚖️',
    description:
      'Organise case law, regulatory updates, and precedents into a queryable system. Find what you know — in seconds, not hours.',
  },
  {
    role: 'Management Consultants',
    icon: '📊',
    description:
      'Build a living methodology library across every engagement. Query your frameworks, client research, and industry data in one place.',
  },
  {
    role: 'Investors & Analysts',
    icon: '📈',
    description:
      'Compile market reports, deal flow, and macro research into a structured intelligence system. Ask it anything about your research.',
  },
  {
    role: 'Founders & Operators',
    icon: '🚀',
    description:
      'Keep competitive intel, product research, and team knowledge organised and queryable. Stop losing context between sprints.',
  },
  {
    role: 'Content Creators',
    icon: '✍️',
    description:
      'Build a research library that compounds. Every article you read trains your vault — so your next piece is faster and deeper.',
  },
]

const plans = [
  {
    name: 'Free',
    price: '£0',
    period: 'forever',
    description: 'Try the demo vault, or connect your own local folder using the browser. No card required.',
    highlight: false,
    comingSoon: false,
    cta: 'Get started free',
    ctaHref: SIGNUP_URL,
    features: [
      'Full access to demo vault',
      'Local vault mode (Chrome/Edge)',
      'AI compilation',
      'Knowledge graph',
      'RAG chat',
      'Custom presets',
      'Obsidian-compatible export',
    ],
    missing: ['Higher daily limits', 'Priority support'],
  },
  {
    name: 'Starter',
    price: '£10',
    period: 'per month',
    description: 'Everything you need to build a serious knowledge base. 100 actions per day.',
    highlight: false,
    comingSoon: false,
    cta: 'Start Starter',
    ctaHref: SIGNUP_URL,
    features: [
      'Everything in Free',
      '100 chats + compilations per day',
      'Email support',
    ],
    missing: ['Priority support', 'Early access to new features'],
  },
  {
    name: 'Pro',
    price: '£40',
    period: 'per month',
    description: 'Serious knowledge work at full speed. 500 actions per day with priority support.',
    highlight: true,
    comingSoon: false,
    cta: 'Start Pro',
    ctaHref: SIGNUP_URL,
    features: [
      'Everything in Starter',
      '500 chats + compilations per day',
      'Usage analytics dashboard',
      'Priority email support',
      'Early access to new features',
    ],
    missing: [],
  },
  {
    name: 'Expert',
    price: '£80',
    period: 'per month',
    description: 'Maximum throughput for power users. 1,000 actions per day.',
    highlight: false,
    comingSoon: false,
    cta: 'Start Expert',
    ctaHref: SIGNUP_URL,
    features: [
      'Everything in Pro',
      '1,000 chats + compilations per day',
    ],
    missing: [],
  },
  {
    name: 'Team',
    price: '£120',
    period: 'per month',
    description: '3 members all on Expert, plus collaboration features and additional seats at cost.',
    highlight: false,
    comingSoon: true,
    cta: 'Coming soon',
    ctaHref: '#',
    features: [
      '3 team members included',
      'All members on Expert limits',
      'Collaboration features',
      'Additional members at cost',
      'Dedicated support',
    ],
    missing: [],
  },
]

const faqs = [
  {
    question: 'What AI models does KnowledgeOS use?',
    answer:
      'KnowledgeOS uses OpenAI GPT-4o and text-embedding-3-small for compilation and chat — no API key needed on any plan. AI is fully managed.',
  },
  {
    question: 'Is my data private?',
    answer:
      'On the Free plan with local vault mode, your files never leave your computer — all reads and writes happen in your browser using the File System Access API. On paid plans, your vault is stored on secure, encrypted servers. We never train on your vault content.',
  },
  {
    question: 'What is a "compilation"?',
    answer:
      'A compilation is one AI processing job — selecting one or more raw notes and generating a structured wiki note from them. Compilation is always manual (you trigger it), so you control when and how your token budget is used.',
  },
  {
    question: 'Is the output compatible with Obsidian?',
    answer:
      'Yes. All compiled notes are plain markdown files with [[wikilinks]]. You can open your cloud vault export — or your local vault directly — in Obsidian at any time. No proprietary format, no lock-in.',
  },
  {
    question: 'Can I cancel at any time?',
    answer:
      'Yes. Subscriptions are monthly, no contracts. Cancel from your billing page and you keep access until the end of your billing period. Your vault data can be exported before cancellation.',
  },
  {
    question: 'What is the local vault mode?',
    answer:
      'Local mode lets you point KnowledgeOS at a folder on your own machine. The browser reads and writes markdown files directly using the File System Access API — no files are uploaded. This works on Chrome and Edge. AI compilation calls our managed API on all plans.',
  },
]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">K</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">KnowledgeOS</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={LOGIN_URL}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </a>
          <a
            href={SIGNUP_URL}
            className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg transition-colors"
          >
            Get started free
          </a>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="pt-32 pb-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/40 rounded-full px-4 py-1.5 text-xs text-blue-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Now in early access — free to try
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
          The knowledge base{' '}
          <span className="gradient-text">that builds itself</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Paste anything. KnowledgeOS compiles it into a structured wiki with AI, connects it to a
          live knowledge graph, and lets you query everything you know — in plain English.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <a
            href={DEMO_URL}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
          >
            Try the demo — no signup
          </a>
          <a
            href={SIGNUP_URL}
            className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors text-sm border border-gray-700"
          >
            Create free account
          </a>
        </div>

        {/* App preview illustration */}
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950 z-10 pointer-events-none" style={{ top: '70%' }} />
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 overflow-hidden shadow-2xl shadow-black/60">
            {/* Mock app header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                </div>
                <span className="text-xs text-gray-500 font-mono">knoswmba.parrytech.co</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 text-xs bg-blue-900/60 text-blue-300 rounded">Chat</span>
                <span className="px-3 py-0.5 text-xs bg-blue-900/60 text-blue-300 rounded">Graph</span>
                <span className="px-3 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">Settings</span>
              </div>
            </div>

            {/* Mock app body */}
            <div className="flex h-80">
              {/* Sidebar */}
              <div className="w-52 bg-gray-900 border-r border-gray-800 p-3 shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 px-1">Wiki Notes</p>
                {['Strategy Framework', 'Market Analysis', 'Competitive Intel', 'Q1 Research', 'RAG Architecture'].map((note, i) => (
                  <div
                    key={note}
                    className={`px-2 py-1.5 rounded text-xs mb-0.5 ${i === 0 ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {note}
                  </div>
                ))}
              </div>

              {/* Main area — graph mock */}
              <div className="flex-1 bg-gray-950 relative overflow-hidden">
                <svg className="absolute inset-0 w-full h-full opacity-70" viewBox="0 0 400 280">
                  {/* Edges */}
                  <line x1="200" y1="140" x2="120" y2="80" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" />
                  <line x1="200" y1="140" x2="280" y2="80" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" />
                  <line x1="200" y1="140" x2="320" y2="180" stroke="#8b5cf6" strokeWidth="1.5" strokeOpacity="0.4" />
                  <line x1="200" y1="140" x2="100" y2="200" stroke="#8b5cf6" strokeWidth="1.5" strokeOpacity="0.4" />
                  <line x1="200" y1="140" x2="200" y2="220" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.3" />
                  <line x1="120" y1="80" x2="60" y2="120" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="280" y1="80" x2="340" y2="120" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="100" y1="200" x2="60" y2="240" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.2" />
                  {/* Stub edges */}
                  <line x1="320" y1="180" x2="360" y2="230" stroke="#4b5563" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />
                  <line x1="200" y1="220" x2="150" y2="260" stroke="#4b5563" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

                  {/* Central node */}
                  <circle cx="200" cy="140" r="10" fill="#3b82f6" fillOpacity="0.9" />
                  <circle cx="200" cy="140" r="16" fill="none" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.3" />

                  {/* Connected wiki nodes */}
                  <circle cx="120" cy="80" r="7" fill="#6366f1" fillOpacity="0.85" />
                  <circle cx="280" cy="80" r="7" fill="#6366f1" fillOpacity="0.85" />
                  <circle cx="320" cy="180" r="7" fill="#6366f1" fillOpacity="0.85" />
                  <circle cx="100" cy="200" r="7" fill="#6366f1" fillOpacity="0.85" />
                  <circle cx="200" cy="220" r="7" fill="#6366f1" fillOpacity="0.85" />

                  {/* Second-hop nodes */}
                  <circle cx="60" cy="120" r="5" fill="#4b5563" fillOpacity="0.7" />
                  <circle cx="340" cy="120" r="5" fill="#4b5563" fillOpacity="0.7" />
                  <circle cx="60" cy="240" r="5" fill="#4b5563" fillOpacity="0.7" />

                  {/* Stub nodes */}
                  <circle cx="360" cy="230" r="5" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="150" cy="260" r="5" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="3 2" />

                  {/* Labels */}
                  <text x="200" y="125" textAnchor="middle" fill="#93c5fd" fontSize="9" fontFamily="sans-serif">Strategy</text>
                  <text x="110" y="68" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="sans-serif">Market</text>
                  <text x="290" y="68" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="sans-serif">Competitive</text>
                  <text x="200" y="208" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="sans-serif">Research</text>
                </svg>

                {/* Chat overlay */}
                <div className="absolute bottom-3 right-3 w-52 bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-xs">
                  <div className="text-gray-500 mb-2">Chat</div>
                  <div className="bg-gray-800 rounded-lg px-3 py-2 text-gray-300 mb-2">
                    What frameworks are in my vault?
                  </div>
                  <div className="text-gray-400 leading-relaxed">
                    Your vault has 3 strategy frameworks: Porter&#39;s Five Forces, the McKinsey 7S model, and...{' '}
                    <span className="text-blue-400">Sources: Strategy Framework, Market Analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Problem() {
  return (
    <section className="py-24 px-6 bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">The problem</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-snug">
              You have years of research. None of it is organised.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-6">
              Your knowledge is scattered across browser bookmarks, a Downloads folder, PDFs you saved
              once and never found again, and research you definitely did at some point.
            </p>
            <p className="text-gray-400 text-lg leading-relaxed">
              Every time you need to remember something, you start from scratch — searching, re-reading,
              re-synthesising. The work compounds, but the knowledge doesn&#39;t.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Browser bookmarks', count: '347', icon: '🔖' },
              { label: 'Unread PDFs', count: '89', icon: '📄' },
              { label: 'Saved articles', count: '214', icon: '📰' },
              { label: 'Searchable knowledge', count: '0', icon: '🔍', red: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  item.red
                    ? 'bg-red-950/20 border-red-900/40'
                    : 'bg-gray-900 border-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className={`text-sm ${item.red ? 'text-red-400' : 'text-gray-300'}`}>
                    {item.label}
                  </span>
                </div>
                <span className={`text-2xl font-bold ${item.red ? 'text-red-400' : 'text-white'}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything your knowledge needs
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From raw paste to a queryable intelligence system — without touching a config file.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-gray-900/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Three steps to a smarter vault
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            No setup, no schema design, no prompt engineering. Just paste and compile.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-gray-700 to-transparent z-10" />
              )}
              <div className="text-5xl font-black text-gray-800 mb-4 tabular-nums">{step.number}</div>
              <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UseCases() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">Who it&#39;s for</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Built for serious knowledge work
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            If your work depends on what you know and how fast you can access it, KnowledgeOS is for you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((uc) => (
            <div
              key={uc.role}
              className="p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-blue-800/60 transition-colors group"
            >
              <div className="text-3xl mb-4">{uc.icon}</div>
              <h3 className="text-white font-semibold mb-2 group-hover:text-blue-300 transition-colors">
                {uc.role}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{uc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6 bg-gray-900/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Start free. Upgrade for higher daily limits. All plans include managed AI — no API key needed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {plans.slice(0, 3).map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-2xl border flex flex-col ${
                plan.highlight
                  ? 'bg-blue-950/40 border-blue-700/60 shadow-xl shadow-blue-900/20'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-white font-semibold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm">/{plan.period}</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 shrink-0">–</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.slice(3).map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-2xl border flex flex-col ${
                plan.comingSoon
                  ? 'bg-gray-900/60 border-gray-800/60 opacity-80'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              {plan.comingSoon && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-700 text-gray-300 text-xs font-semibold px-3 py-1 rounded-full">
                  Coming soon
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-white font-semibold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm">/{plan.period}</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 shrink-0">–</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.comingSoon ? '#' : plan.ctaHref}
                className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  plan.comingSoon
                    ? 'bg-gray-800/60 text-gray-500 border border-gray-700/60 cursor-default'
                    : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-sm mt-8">
          All paid plans billed monthly. Cancel anytime. VAT may apply.
        </p>
      </div>
    </section>
  )
}

function FAQ() {
  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Common questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="p-6 rounded-2xl bg-gray-900 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">{faq.question}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="p-12 rounded-3xl bg-gradient-to-br from-blue-950/60 via-violet-950/40 to-gray-950 border border-blue-800/30">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-snug">
            Your research is waiting to be compiled
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Try the demo vault in seconds, no signup. Or create a free account and connect your own
            local folder today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={DEMO_URL}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Open the demo
            </a>
            <a
              href={SIGNUP_URL}
              className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors text-sm border border-gray-700"
            >
              Create free account
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-gray-800/60">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + links */}
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <span className="text-gray-400 font-medium text-sm">KnowledgeOS</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-gray-600">
              <a href={`${APP_URL}/privacy`} className="hover:text-gray-400 transition-colors">Privacy</a>
              <a href={`${APP_URL}/terms`} className="hover:text-gray-400 transition-colors">Terms</a>
              <a href={`${APP_URL}/billing`} className="hover:text-gray-400 transition-colors">Billing</a>
              <a href={SIGNUP_URL} className="hover:text-gray-400 transition-colors">Sign up</a>
            </div>
          </div>

          {/* ParryTech branding */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Powered by</span>
            <Link
              href={PARRYTECH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors font-medium"
            >
              <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold leading-none">P</span>
              </div>
              ParryTech.co
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800/40 text-center text-xs text-gray-700">
          © {new Date().getFullYear()} KnowledgeOS. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <UseCases />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
