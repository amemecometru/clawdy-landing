import { motion } from "framer-motion";

const partners = [
  { name: "Cloudflare Workers", role: "Edge Compute", color: "#F6821F" },
  { name: "Workers AI", role: "Inference Engine", color: "#F6821F" },
  { name: "Meta Graph API", role: "Publishing", color: "#0866FF" },
  { name: "Apify", role: "Web Scraping", color: "#1EA68D" },
  { name: "21st.dev", role: "UI Components", color: "#A855F7" },
  { name: "Hono", role: "API Framework", color: "#FF6B35" },
  { name: "n8n", role: "Workflow Orchestration", color: "#EA4B71" },
  { name: "Qwen", role: "Pricing Intelligence", color: "#6366F1" },
  { name: "Stripe", role: "Payments", color: "#635BFF" },
  { name: "D1 Database", role: "Persistence", color: "#F6821F" },
  { name: "KV Store", role: "Session Cache", color: "#F6821F" },
  { name: "Framer Motion", role: "Animations", color: "#FF0055" },
];

export default function FacebookTrustedPartners() {
  return (
    <section id="partners" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[11px] font-semibold tracking-widest text-[#0866FF] uppercase"
        >
          Infrastructure
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-[28px] md:text-[36px] font-bold tracking-[-0.03em]"
        >
          Built on Proven Infrastructure
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-3 text-[15px] text-white/45 max-w-lg mx-auto"
        >
          Every component in the factory stack is battle-tested and production-ready.
        </motion.p>

        {/* Partner grid */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {partners.map((partner, i) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="group relative rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col items-center justify-center gap-3 hover:bg-white/[0.05] hover:border-white/[0.10] transition-colors"
            >
              {/* Color dot */}
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${partner.color}15`, border: `1px solid ${partner.color}25` }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: partner.color }}
                />
              </div>
              <div className="text-center">
                <div className="text-[12px] font-semibold text-white/80 leading-tight">
                  {partner.name}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  {partner.role}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6"
        >
          {[
            "Zero Watermarks",
            "Original Content Only",
            "Adaptive Rate Limiting",
            "Trust-Score Backoff",
            "HITL Gates",
            "Exponential Backoff",
          ].map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-white/40"
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
