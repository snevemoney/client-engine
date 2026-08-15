import { Zap, Code2, Rocket, Shield, Monitor, Bot } from "lucide-react";

export const MARKETING_SERVICES = [
  {
    icon: Code2,
    title: "Full-Stack Development",
    description: "Next.js, React, Node.js, PostgreSQL — modern stacks built for performance and scale.",
  },
  {
    icon: Bot,
    title: "AI Integrations",
    description: "OpenAI, LangChain, custom agents — turn AI into a real feature, not a gimmick.",
  },
  {
    icon: Zap,
    title: "Automation Systems",
    description: "Workflows that eliminate repetitive tasks. Data pipelines, notifications, scheduling.",
  },
  {
    icon: Rocket,
    title: "MVP & Rapid Prototyping",
    description: "From idea to deployed demo in days, not months. Validated before you invest further.",
  },
  {
    icon: Monitor,
    title: "Dashboards & Internal Tools",
    description: "Admin panels, analytics dashboards, CRMs — tools your team actually uses.",
  },
  {
    icon: Shield,
    title: "DevOps & Deployment",
    description: "Docker, VPS, CI/CD — your app runs on infrastructure you own, not a platform you rent.",
  },
];

export function ServicesGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {MARKETING_SERVICES.map((s) => (
        <div
          key={s.title}
          className="border border-neutral-800/50 rounded-xl p-6 hover:border-neutral-700/50 transition-colors group"
        >
          <s.icon className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300 transition-colors mb-4" />
          <h3 className="font-medium mb-2">{s.title}</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">{s.description}</p>
        </div>
      ))}
    </div>
  );
}
