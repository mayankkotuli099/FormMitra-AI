"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="w-full flex flex-col items-center justify-center pt-40 pb-16 px-8">
      <motion.span
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xs uppercase tracking-[0.2em] text-muted border border-border rounded-full px-4 py-1.5 mb-6"
      >
        AI Government Form Assistant
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-5xl md:text-6xl font-semibold text-center tracking-tight max-w-4xl"
      >
        Fill any government form
        <br />
        just by speaking.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-6 text-lg text-muted max-w-2xl text-center leading-relaxed"
      >
        Upload a PAN, Aadhaar, Passport, or any other government form.
        FormMitra AI reads it, asks only what's missing, and fills it
        in — live, in your own language.
      </motion.p>
    </section>
  );
}