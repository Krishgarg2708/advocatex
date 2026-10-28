import { Fragment, useEffect, useRef, useState } from "react";
import { Bot, Eraser, SendHorizontal, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SUGGESTED_QUESTIONS, answerQuestion, type AssistantAnswer, type InsightInput } from "@/lib/insights";
import { rangeLabel } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface Msg { id: number; role: "user" | "assistant"; text: string; bullets?: string[]; followUps?: string[]; rangeText?: string }

/** Renders **bold** segments without injecting HTML. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}
const plain = (t: string) => t.replace(/\*\*/g, "");

export function AIChatPanel({ input, className }: { input: InsightInput; className?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [announce, setAnnounce] = useState("");
  const seq = useRef(0);
  const timer = useRef<number>();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestInput = useRef(input);
  latestInput.current = input;

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question || typing) return;
    setMessages((m) => [...m, { id: ++seq.current, role: "user", text: question }]);
    setDraft("");
    setTyping(true);
    setAnnounce("Assistant is preparing an answer");
    timer.current = window.setTimeout(() => {
      const a: AssistantAnswer = answerQuestion(question, latestInput.current);
      setMessages((m) => [...m, { id: ++seq.current, role: "assistant", text: a.text, bullets: a.bullets, followUps: a.followUps, rangeText: rangeLabel(latestInput.current.range) }]);
      setTyping(false);
      setAnnounce(`Assistant: ${plain(a.text)}${a.bullets?.length ? ` ${a.bullets.join(". ")}` : ""}`);
      inputRef.current?.focus();
    }, 600);
  };

  const clear = () => { window.clearTimeout(timer.current); setTyping(false); setMessages([]); setAnnounce("Conversation cleared"); };
  const last = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b bg-ai-soft/50">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ai text-white"><Bot className="h-4 w-4" /></span>
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">AI Business Assistant <Badge variant="ai">Simulated</Badge></CardTitle>
            <CardDescription className="mt-1">Answers use your role's demo data for {rangeLabel(input.range).toLowerCase()} (the global date range).</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!messages.length && !typing} aria-label="Clear chat"><Eraser />Clear</Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        <div ref={listRef} className="h-[420px] space-y-4 overflow-y-auto p-4 scrollbar-thin sm:p-5" role="log" aria-label="Conversation">
          {messages.length === 0 && !typing && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ai-soft text-ai"><Sparkles className="h-5 w-5" /></span>
              <p className="text-sm font-medium">Ask about campaigns, advocates, conversion or rewards</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Pick a suggested question below or type your own. Every figure is calculated from the demo data on this device.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "assistant" ? "bg-ai text-white" : "bg-muted text-muted-foreground")} aria-hidden>
                {m.role === "assistant" ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </span>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed", m.role === "user" ? "rounded-tr-sm bg-action text-white" : "rounded-tl-sm border bg-card text-muted-foreground")}>
                <span className="sr-only">{m.role === "user" ? "You said:" : "Assistant:"}</span>
                <p className={cn(m.role === "assistant" && "text-foreground/90")}>{m.role === "assistant" ? <Rich text={m.text} /> : m.text}</p>
                {m.bullets && m.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {m.bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ai" aria-hidden /><span className="num">{b}</span></li>)}
                  </ul>
                )}
                {m.rangeText && <div className="mt-2 text-[11px] text-muted-foreground/80">Based on {m.rangeText} · deterministic demo engine</div>}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ai text-white" aria-hidden><Sparkles className="h-3.5 w-3.5" /></span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border bg-card px-3.5 py-3" aria-label="Assistant is typing">
                {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai/70" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-3 sm:p-4">
          <div className="flex flex-wrap gap-1.5" aria-label={last?.followUps ? "Follow-up questions" : "Suggested questions"}>
            {(last?.followUps?.length ? last.followUps : SUGGESTED_QUESTIONS).map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} disabled={typing}
                className="rounded-full border border-ai/25 bg-ai-soft/60 px-3 py-1 text-xs font-medium text-ai transition-colors hover:bg-ai-soft disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
            <label htmlFor="ai-question" className="sr-only">Ask the assistant a question</label>
            <Input id="ai-question" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question about your demo data…" autoComplete="off" maxLength={300} />
            <Button type="submit" variant="ai" disabled={!draft.trim() || typing} aria-label="Send question"><SendHorizontal /><span className="hidden sm:inline">Send</span></Button>
          </form>
        </div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">{announce}</div>
      </CardContent>
    </Card>
  );
}
