import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, Copy } from "lucide-react";
import { GETTING_STARTED, GUIDE_PLATFORMS } from "./guideContent";
import { SiteChrome } from "./SiteChrome";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="mt-3 rounded-[6px] border border-[#eaeaea] bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#aaa]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ddd] hover:text-white"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3 text-[11px] leading-[1.55] font-mono text-[#e8e8e8] overflow-x-auto whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

export default function Guide() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || id === "guide") {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <SiteChrome>
      <main className="flex-1 max-w-[1080px] w-full mx-auto px-6 py-10 md:py-14">
        <a
          href="#home"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#666] hover:text-[#111] mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to overview
        </a>

        <div className="max-w-[760px] mb-8">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-wider mb-2">
            <BookOpen className="w-3.5 h-3.5 text-[#111]" />
            Usage guide
          </div>
          <h1 className="font-['Lora',Georgia,serif] text-[2rem] sm:text-[2.4rem] leading-[1.2] font-semibold tracking-[-0.03em] text-[#0a0a0a] mb-3">
            How to use CARF with your stack
          </h1>
          <p className="text-[15px] leading-[1.65] text-[#555]">
            Start with any GitHub repository, then add a standalone adapter or an augment integration.
            Thresholds stay on the project; extra platforms live under Integrations.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2 mb-10" aria-label="Guide sections">
          <a
            href="#getting-started"
            className="text-[12px] font-medium px-3 py-1.5 rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] text-[#333] hover:border-[#111]"
          >
            Any project
          </a>
          {GUIDE_PLATFORMS.map((platform) => (
            <a
              key={platform.id}
              href={`#${platform.id}`}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] text-[#333] hover:border-[#111]"
            >
              {platform.name.split(" (")[0]}
            </a>
          ))}
        </nav>

        <section id="getting-started" className="mb-8 scroll-mt-20 border border-[#eaeaea] bg-white rounded-[6px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
              {GETTING_STARTED.title}
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f5f5f5] border border-[#e8e8e8] text-[#555]">
              Required first
            </span>
          </div>
          <p className="text-[13px] leading-[1.65] text-[#555] mb-5">{GETTING_STARTED.summary}</p>
          <ol className="flex flex-col gap-3">
            {GETTING_STARTED.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[11px] font-mono flex items-center justify-center">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold text-[#111]">{step.title}</h3>
                  <p className="text-[13px] leading-[1.6] text-[#555] mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-6">
          {GUIDE_PLATFORMS.map((platform) => (
            <section
              key={platform.id}
              id={platform.id}
              className="scroll-mt-20 border border-[#eaeaea] bg-white rounded-[6px] p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
                  {platform.name}
                </h2>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    platform.mode === "standalone"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}
                >
                  {platform.badge}
                </span>
              </div>
              <p className="text-[13px] leading-[1.65] text-[#555]">{platform.summary}</p>
              <p className="text-[13px] leading-[1.65] text-[#444] mt-2">
                <span className="font-semibold">When to use: </span>
                {platform.whenToUse}
              </p>

              <ol className="mt-4 flex flex-col gap-2.5">
                {platform.steps.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] text-[#111] text-[10px] font-mono flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[13px] font-semibold text-[#111]">{step.title}</h3>
                      <p className="text-[13px] leading-[1.6] text-[#555] mt-0.5">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <CopyBlock label=".carf.yml" text={platform.carfYml} />
              <CopyBlock label={platform.deploySnippetTitle} text={platform.deploySnippet} />
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href="https://carf.indevs.in/dashboard"
            className="inline-flex items-center bg-[#0a0a0a] hover:bg-[#262626] text-white text-[14px] font-medium px-5 py-2.5 rounded-[5px]"
          >
            Open Dashboard
          </a>
          <a
            href="https://carf.indevs.in/signup"
            className="inline-flex items-center bg-white hover:bg-[#f7f7f7] border border-[#e0e0e0] text-[#111] text-[14px] font-medium px-4 py-2.5 rounded-[5px]"
          >
            Create Account
          </a>
        </div>
      </main>
    </SiteChrome>
  );
}
