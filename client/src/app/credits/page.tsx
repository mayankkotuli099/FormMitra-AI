"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  Mic,
  ScanText,
  Languages,
  PenTool,
  Sparkles,
  Eye,
  Bot,
  FolderCheck,
  FileDown,
  Code2,
  Server,
  BrainCircuit,
  FileStack,
  Boxes,
  Rocket,
  Smartphone,
  WifiOff,
  Landmark,
  Globe2,
  FileSignature,
  Cloud,
  Mail,
  Linkedin,
  Github,
  Instagram,
  Link as LinkIcon,
  Phone,
  Heart,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Shared animation + layout helpers
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        variants={fadeUp}
        className="mb-12 sm:mb-16"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">
          {eyebrow}
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {title}
        </h2>
      </motion.div>

      {children}
    </section>
  );
}

function GlassCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      variants={fadeUp}
      className={`rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl
        p-6 sm:p-7 transition-all duration-300 hover:border-white/25 hover:bg-white/[0.06]
        hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 shadow-soft ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const techStack = [
  {
    category: "Frontend",
    icon: Code2,
    items: [
      { name: "Next.js", desc: "App Router-based React framework powering the UI" },
      { name: "React", desc: "Component-driven interface and state rendering" },
      { name: "TypeScript", desc: "Type-safe code across the entire client" },
      { name: "Tailwind CSS", desc: "Utility-first styling for a consistent design system" },
    ],
  },
  {
    category: "Backend",
    icon: Server,
    items: [
      { name: "FastAPI", desc: "High-performance Python API serving OCR and form logic" },
      { name: "Python", desc: "Core language for services, parsing, and orchestration" },
    ],
  },
  {
    category: "AI",
    icon: BrainCircuit,
    items: [
      { name: "Mistral AI", desc: "Conversational field extraction and language understanding" },
      { name: "OCR", desc: "Reads scanned government forms into structured text" },
      { name: "Speech Recognition", desc: "Turns spoken answers into form values in real time" },
    ],
  },
  {
    category: "PDF",
    icon: FileStack,
    items: [
      { name: "pdfplumber", desc: "Extracts text and field coordinates from source PDFs" },
      { name: "ReportLab", desc: "Renders handwritten-style values back onto the form" },
      { name: "React PDF", desc: "Live in-browser preview of the form being filled" },
    ],
  },
  {
    category: "State Management",
    icon: Boxes,
    items: [
      { name: "Zustand", desc: "Lightweight global state for sessions, fields, and progress" },
    ],
  },
  {
    category: "Deployment",
    icon: Rocket,
    items: [
      { name: "Deployment Ready", desc: "Dockerized backend and a build-ready Next.js frontend" },
    ],
  },
];

const architectureSteps = [
  "User speaks or uploads a form",
  "Frontend captures voice & file input",
  "Voice AI transcribes the spoken answers",
  "OCR reads the uploaded form's text and layout",
  "Gemini interprets intent and extracted content",
  "Field extraction maps answers to the right boxes",
  "Human handwriting rendering fills the form naturally",
  "Final PDF is generated and handed back to the user",
];

const features = [
  { icon: Mic, title: "Voice Filling", desc: "Answer questions out loud instead of typing into tiny boxes." },
  { icon: ScanText, title: "OCR", desc: "Automatically reads any uploaded government form." },
  { icon: Languages, title: "Regional Language Support", desc: "Fill forms by speaking in your own language." },
  { icon: PenTool, title: "Human Handwriting", desc: "Values are rendered in natural blue-ink handwriting, not typed text." },
  { icon: Sparkles, title: "Smart Form Detection", desc: "Recognizes the type of form and expected fields automatically." },
  { icon: Eye, title: "Live Preview", desc: "Watch the form fill in, field by field, as you speak." },
  { icon: Bot, title: "AI Assistant", desc: "Guides you through the form conversationally, one field at a time." },
  { icon: FolderCheck, title: "Auto Field Mapping", desc: "Matches spoken answers to the correct field without manual tagging." },
  { icon: FileDown, title: "PDF Download", desc: "Get a ready-to-submit, filled PDF at the end of the conversation." },
];

const timeline = [
  { phase: "Ideation", desc: "Identified how confusing government forms are for people who aren't comfortable typing or reading dense text — and how voice could fix that." },
  { phase: "OCR Foundation", desc: "Built the pipeline to read any uploaded PDF form and detect fillable fields with their exact coordinates." },
  { phase: "Conversational Filling", desc: "Connected speech recognition and an AI agent to turn spoken answers into structured field values." },
  { phase: "Live Preview", desc: "Rendered the form being filled in real time, so users can see and trust what's happening." },
  { phase: "Human Handwriting", desc: "Replaced machine-printed output with realistic, natural handwriting for an authentic filled-form look." },
  { phase: "Hardening", desc: "Added retry logic, debouncing, and cleaner logging to make the system production-ready." },
];

const challenges = [
  { title: "OCR", desc: "Government forms come in wildly inconsistent layouts — getting reliable field coordinates took careful, defensive parsing." },
  { title: "AI", desc: "Keeping the conversation focused on one field at a time, without the model wandering off-topic." },
  { title: "PDF Rendering", desc: "Overlaying new content onto an existing PDF without shifting or corrupting the original layout." },
  { title: "Voice Processing", desc: "Handling background noise, accents, and mixed-language speech reliably." },
  { title: "Handwriting", desc: "Making rendered text look genuinely handwritten — readable, natural, and different every time — without a real handwriting model." },
  { title: "State Management", desc: "Keeping the form, session, and live preview in sync as answers stream in over a WebSocket." },
];

const roadmap = [
  { icon: Smartphone, title: "Mobile App", desc: "A native app for filling forms on the go." },
  { icon: WifiOff, title: "Offline AI", desc: "On-device processing for areas with poor connectivity." },
  { icon: Landmark, title: "Government APIs", desc: "Direct submission to official portals where available." },
  { icon: Globe2, title: "Multi-language", desc: "Expanding voice and text support to more regional languages." },
  { icon: FileSignature, title: "Digital Signatures", desc: "Secure, verifiable signing built into the filled form." },
  { icon: Cloud, title: "Cloud Storage", desc: "Save and revisit past forms from any device." },
];

const contactLinks = [
  {
    label: "Email",
    icon: Mail,
    href: "mailto:mayankkotuli099@gmail.com",
    external: false,
  },
  {
    label: "LinkedIn",
    icon: Linkedin,
    href: "https://www.linkedin.com/in/mayank-kotuli-445891363/",
    external: true,
  },
  {
    label: "GitHub",
    icon: Github,
    href: "https://github.com/mayankkotuli099",
    external: true,
  },
  {
    label: "Instagram",
    icon: Instagram,
    href: "https://www.instagram.com/mayank_kotuli.tech/",
    external: true,
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-bg text-ink pt-16 overflow-x-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* 1. Hero */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-start justify-center">
          <div className="w-[36rem] h-[36rem] rounded-full bg-white/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto rounded-full border border-white/15
            bg-white/[0.04] backdrop-blur-xl overflow-hidden mb-8 shadow-glow
            ring-1 ring-white/10"
        >
          <Image
            src="/mayank.png"
            alt="Mayank Kotuli"
            fill
            sizes="144px"
            priority
            className="object-cover object-top"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-semibold tracking-tight mb-4"
        >
          FormMitra AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg sm:text-xl text-muted mb-8"
        >
          "Bolkar Bharo – Forms in Your Language"
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="max-w-2xl mx-auto text-muted leading-relaxed"
        >
          FormMitra AI is an AI-powered Government Form Filling Assistant
          that helps people fill official forms through voice and
          intelligent automation — built by Mayank Kotuli to make government
          paperwork accessible to everyone, regardless of language or
          literacy.
        </motion.p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. About Me */}
      {/* ---------------------------------------------------------------- */}
      <Section id="about-me" eyebrow="Who's behind this" title="About Me">
        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
          <GlassCard>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <dt className="text-muted">Name</dt>
                <dd className="font-medium">Mayank Kotuli</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <dt className="text-muted">College</dt>
                <dd className="font-medium">ABES Engineering College</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <dt className="text-muted">Branch</dt>
                <dd className="font-medium">Computer Science & Engineering</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Year</dt>
                <dd className="font-medium">2nd Year</dd>
              </div>
            </dl>
          </GlassCard>

          <GlassCard delay={0.1}>
            <p className="text-sm leading-relaxed text-muted">
              I'm a Computer Science student and full-stack developer with a
              strong interest in artificial intelligence and government
              technology. I enjoy building systems that solve real-world
              problems — FormMitra AI combines OCR, conversational AI,
              live form preview, and realistic handwriting rendering into a
              single, accessible experience for filling government forms.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {[
                "Full Stack Developer",
                "AI Developer",
                "Computer Science Student",
                "Government Tech Enthusiast",
              ].map((tag) => (
                <span
                  key={tag}
                  className="text-xs border border-white/15 rounded-full px-3 py-1.5 text-muted transition-colors hover:border-white/30 hover:text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. About FormMitra AI */}
      {/* ---------------------------------------------------------------- */}
      <Section id="about-project" eyebrow="The project" title="About FormMitra AI">
        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
          <GlassCard>
            <h3 className="font-semibold mb-2">Problem Statement</h3>
            <p className="text-sm text-muted leading-relaxed">
              Government forms are dense, printed in formal language, and
              assume comfort with reading and writing — an assumption that
              excludes a large part of the population who are more
              comfortable speaking than filling out paperwork.
            </p>
          </GlassCard>

          <GlassCard delay={0.05}>
            <h3 className="font-semibold mb-2">Solution</h3>
            <p className="text-sm text-muted leading-relaxed">
              FormMitra AI reads any uploaded form, asks for each field
              conversationally in the user's own language, and writes the
              answers back onto the original form in realistic handwriting —
              no typing, no confusion.
            </p>
          </GlassCard>

          <GlassCard delay={0.1}>
            <h3 className="font-semibold mb-2">How It Helps People</h3>
            <p className="text-sm text-muted leading-relaxed">
              It removes the two biggest barriers to filling a form: language
              and literacy. Anyone who can speak can now complete an
              application confidently, without help from someone else —
              improving accessibility and digital inclusion in everyday
              government services.
            </p>
          </GlassCard>

          <GlassCard delay={0.15}>
            <h3 className="font-semibold mb-2">Our Vision</h3>
            <p className="text-sm text-muted leading-relaxed">
              To make government paperwork effortless using artificial
              intelligence — where multilingual voice input, automation, and
              intelligent form understanding come together so that filling
              an official document is as simple as having a conversation.
            </p>
          </GlassCard>
        </div>

        <GlassCard delay={0.2} className="mt-6 sm:mt-8">
          <p className="text-sm text-muted leading-relaxed">
            FormMitra AI focuses on <span className="text-white">accessibility</span>,{" "}
            <span className="text-white">digital inclusion</span>,{" "}
            <span className="text-white">government services</span>,{" "}
            <span className="text-white">multilingual support</span>,{" "}
            <span className="text-white">ease of use</span>, and{" "}
            <span className="text-white">automation</span> — built as a
            genuine product for real people, not a one-off demo.
          </p>
        </GlassCard>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Technologies Used */}
      {/* ---------------------------------------------------------------- */}
      <Section id="tech-stack" eyebrow="Under the hood" title="Technologies Used">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {techStack.map((group, i) => {
            const Icon = group.icon;
            return (
              <GlassCard key={group.category} delay={i * 0.05}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-semibold">{group.category}</h3>
                </div>
                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted leading-relaxed">
                        {item.desc}
                      </p>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            );
          })}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Project Architecture */}
      {/* ---------------------------------------------------------------- */}
      <Section id="architecture" eyebrow="How it flows" title="Project Architecture">
        <div className="flex flex-col items-center gap-3">
          {architectureSteps.map((step, i) => (
            <motion.div
              key={step}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              variants={fadeUp}
              className="w-full max-w-xl"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-6 py-4 text-center text-sm font-medium transition-colors hover:border-white/25 hover:bg-white/[0.05]">
                {step}
              </div>
              {i < architectureSteps.length - 1 && (
                <div className="h-6 w-px bg-white/15 mx-auto" />
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 6. Features */}
      {/* ---------------------------------------------------------------- */}
      <Section id="features" eyebrow="What it can do" title="Features">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <GlassCard key={f.title} delay={i * 0.04}>
                <Icon size={22} className="mb-4 text-white/80" />
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </GlassCard>
            );
          })}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 7. Development Journey */}
      {/* ---------------------------------------------------------------- */}
      <Section id="journey" eyebrow="The build" title="Development Journey">
        <div className="relative pl-8 border-l border-white/10 space-y-10">
          {timeline.map((step, i) => (
            <motion.div
              key={step.phase}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              variants={fadeUp}
              className="relative"
            >
              <div className="absolute -left-[2.05rem] top-1 w-3 h-3 rounded-full bg-white" />
              <p className="text-xs uppercase tracking-widest text-muted mb-1">
                Step {i + 1}
              </p>
              <h3 className="font-semibold mb-1">{step.phase}</h3>
              <p className="text-sm text-muted leading-relaxed max-w-2xl">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 8. Challenges Faced */}
      {/* ---------------------------------------------------------------- */}
      <Section id="challenges" eyebrow="What made it hard" title="Challenges Faced">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {challenges.map((c, i) => (
            <GlassCard key={c.title} delay={i * 0.05}>
              <h3 className="font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{c.desc}</p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 9. Future Roadmap */}
      {/* ---------------------------------------------------------------- */}
      <Section id="roadmap" eyebrow="What's next" title="Future Roadmap">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {roadmap.map((r, i) => {
            const Icon = r.icon;
            return (
              <GlassCard key={r.title} delay={i * 0.05}>
                <Icon size={22} className="mb-4 text-white/80" />
                <h3 className="font-semibold mb-1.5">{r.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{r.desc}</p>
              </GlassCard>
            );
          })}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 10. Contact */}
      {/* ---------------------------------------------------------------- */}
      <Section id="contact" eyebrow="Get in touch" title="Contact">
        <GlassCard className="grid sm:grid-cols-2 gap-8 sm:gap-10">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10">
              <Image
                src="/mayank.png"
                alt="Mayank Kotuli"
                fill
                sizes="64px"
                className="object-cover object-top"
              />
            </div>
            <div>
              <p className="font-semibold">Mayank Kotuli</p>
              <p className="text-sm text-muted">Creator of FormMitra AI</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {contactLinks.map(({ label, icon: Icon, href, external }) => (
              <a
                key={label}
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="flex items-center gap-2 text-muted hover:text-white transition-colors"
              >
                <Icon size={16} /> {label}
              </a>
            ))}

            <span className="flex items-center gap-2 text-muted/50 cursor-not-allowed">
              <LinkIcon size={16} /> Portfolio (Coming Soon)
            </span>

            <span className="flex items-center gap-2 text-muted/50 cursor-not-allowed">
              <Phone size={16} /> Phone (Coming Soon)
            </span>
          </div>
        </GlassCard>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 11. Footer */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-white/10 mt-10">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted text-center sm:text-left">
          <p className="flex items-center gap-1.5">
            Made with <Heart size={12} className="text-white" fill="currentColor" /> by Mayank Kotuli
          </p>
          <p>Making Government Forms Simple for Everyone</p>
          <p>v1.0.0 &middot; &copy; {new Date().getFullYear()} FormMitra AI</p>
        </div>
      </footer>
    </main>
  );
}