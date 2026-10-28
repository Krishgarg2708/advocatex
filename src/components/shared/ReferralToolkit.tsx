import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText, shareOrCopy } from "@/lib/clipboard";
import { downloadCanvasPng, referralLink } from "@/lib/referral";
import { DemoNotice } from "./DemoNotice";
import { cn } from "@/lib/utils";

/** Referral link + real QR code (encodes the live demo route) with copy / share / download. */
export function ReferralToolkit({ code, name, className, compact }: { code: string; name: string; className?: string; compact?: boolean }) {
  const link = referralLink(code);
  const wrap = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const doCopy = async (what: "link" | "code") => {
    const ok = await copyText(what === "link" ? link : code);
    if (ok) { setCopied(what); toast.success(what === "link" ? "Referral link copied" : "Referral code copied"); setTimeout(() => setCopied(null), 1800); }
    else toast.error("Could not access the clipboard");
  };
  const doShare = async () => {
    const res = await shareOrCopy({ title: `${name} on AdvocateX`, text: `Use my referral code ${code} for exclusive offers.`, url: link });
    if (res === "copied") toast.success("Sharing isn't available here — link copied instead");
    else if (res === "shared") toast.success("Shared");
  };
  const doDownload = () => {
    const ok = downloadCanvasPng(wrap.current?.querySelector("canvas") ?? null, `advocatex-${code}.png`);
    ok ? toast.success("QR code downloaded") : toast.error("QR code not ready yet");
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Referral tools</CardTitle>
        <CardDescription>Share your link or let customers scan your QR code at the counter.</CardDescription>
      </CardHeader>
      <CardContent className={cn("grid gap-5", !compact && "sm:grid-cols-[auto,1fr]")}>
        <div ref={wrap} className="mx-auto flex flex-col items-center gap-2">
          <div className="rounded-xl border bg-white p-3 shadow-sm">
            <QRCodeCanvas value={link} size={148} level="M" marginSize={1} fgColor="#1e1b4b" title={`QR code for ${link}`} />
          </div>
          <span className="text-[11px] text-muted-foreground">Scan to open the referral page</span>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Referral code</div>
            <div className="flex items-center gap-2">
              <code className="rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-sm font-medium tracking-wide">{code}</code>
              <Button variant="ghost" size="icon-sm" onClick={() => doCopy("code")} aria-label="Copy referral code">{copied === "code" ? <Check className="text-positive" /> : <Copy />}</Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Shareable link</div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-xs" title={link}>{link}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => doCopy("link")}>{copied === "link" ? <Check /> : <Copy />}Copy link</Button>
            <Button size="sm" variant="outline" onClick={doShare}><Share2 />Share</Button>
            <Button size="sm" variant="outline" onClick={doDownload}><Download />Download QR</Button>
            <Button size="sm" variant="ghost" asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink />Preview</a></Button>
          </div>
          <DemoNotice>Demo link — opening it records a simulated referral click in this browser only.</DemoNotice>
        </div>
      </CardContent>
    </Card>
  );
}
