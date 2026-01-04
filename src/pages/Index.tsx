import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import banner from "@/assets/banner-user-2.jpg";
import blurHero from "@/assets/blur_7.jpg";
import logo from "@/assets/logo.svg";
import logoMobile from "@/assets/logo_mobile.svg";
import chatIcon from "@/assets/chat.svg";
import teaser01 from "@/assets/kamy02.mp4";
import teaser02 from "@/assets/kamy03.mp4";
import teaserHighlight from "@/assets/teaser-bolzani-1.mp4";
import profileBolzani from "@/assets/profile-bolzani.jpg";
import bolzaniGrid from "@/assets/bolzani-instagram-grid.jpg";
import { Lock, PlayCircle } from "lucide-react";

import { loadSiteConfig, SiteConfig } from "@/config/siteConfig";

const subscriptionPlansFromConfig = (config: SiteConfig) => [
  {
    label: config.primaryPlanLabel,
    price: config.primaryPlanPriceText,
    href: config.primaryPlanHref,
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrderType, setCurrentOrderType] = useState<"subscription" | "whatsapp" | null>(null);
  const [showWhatsappAccessModal, setShowWhatsappAccessModal] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => loadSiteConfig());
  useEffect(() => {
    // Track page visit
    supabase.from("analytics_events").insert({ event_type: "visit" });
  }, []);

  useEffect(() => {
    if (!currentOrderId) return;

    const channel = supabase
      .channel("orders-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${currentOrderId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          if (newStatus === "paid") {
            // Fecha o modal do PIX e abre o modal de acesso ao WhatsApp
            setPixModalOpen(false);

            if (currentOrderType === "whatsapp") {
              setWhatsappLink("https://chat.whatsapp.com/LgkcC3dkAt908VyoilclWv");
            } else if (currentOrderType === "subscription") {
              setWhatsappLink("https://chat.whatsapp.com/ED0zKAGCwMGCydFzuJpYa9");
            }

            setShowWhatsappAccessModal(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrderId, currentOrderType]);

  const trackEvent = (eventType: string) => {
    supabase.from("analytics_events").insert({ event_type: eventType });
  };

  const handlePixCheckout = async (amountInCents: number, type: "subscription" | "whatsapp") => {
    try {
      setPixError(null);
      setIsLoadingPix(true);
      setPixModalOpen(true);

      const { data, error } = await supabase.functions.invoke("tribopay-create-pix", {
        body: {
          name: "Cliente Bolzani",
          email: "cliente@example.com",
          document: "12345678909",
          amount: amountInCents,
          type,
        },
      });

      if (error || !data) {
        console.error("Erro ao gerar PIX TriboPay:", error, data);
        setPixError(
          (data as any)?.error ||
            "Não foi possível gerar o pagamento PIX. Tente novamente em alguns minutos.",
        );
        return;
      }

      const pixData = data as any;

      // Estrutura típica da TriboPay: data.pix.imageBase64 e data.pix.code
      const qrBase64 = pixData.pix?.imageBase64 ?? pixData.qr_code ?? null;
      const pixCodeValue = pixData.pix?.code ?? pixData.pix_code ?? null;

      if (!qrBase64 && !pixCodeValue) {
        console.error("Resposta TriboPay sem dados de PIX:", pixData);
        setPixError("Não foi possível gerar o pagamento PIX. Tente novamente em alguns minutos.");
        return;
      }

      setPixQrBase64(qrBase64);
      setPixCode(pixCodeValue);

      if (pixData.orderId) {
        setCurrentOrderId(pixData.orderId);
        setCurrentOrderType(type);
      }

      trackEvent(type === "whatsapp" ? "click_whatsapp_pix" : "click_plan_pix");
    } catch (error) {
      console.error("Erro inesperado ao criar pagamento PIX:", error);
      setPixError("Erro inesperado ao gerar o pagamento PIX.");
    } finally {
      setIsLoadingPix(false);
    }
  };
  const handleCopyPixCode = async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      toast({ description: "Código PIX copiado para a área de transferência." });
    } catch (error) {
      console.error("Erro ao copiar código PIX:", error);
      toast({ variant: "destructive", description: "Não foi possível copiar o código PIX." });
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={siteConfig.pageBackgroundColor ? { backgroundColor: siteConfig.pageBackgroundColor } : undefined}
    >
      <main className="relative overflow-hidden">
        <header className="container flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Privacy Kamylinha logo"
              className="hidden h-8 w-auto md:inline-block"
              loading="lazy"
            />
            <img
              src={logoMobile}
              alt="Privacy Kamylinha logo mobile"
              className="inline-block h-9 w-9 md:hidden"
              loading="lazy"
            />
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Privacy</p>
              <p className="text-sm font-medium">Perfil exclusivo</p>
            </div>
          </div>
          <Button variant="outline" size="icon" aria-label="Abrir chat com suporte">
            <img src={chatIcon} alt="Abrir chat com suporte" className="h-5 w-5" loading="lazy" />
          </Button>
        </header>

        <section className="container space-y-4 pb-16 pt-4">
          {/* Faixa de capa com contadores, similar ao original */}
          <div
            className="relative flex h-40 items-end justify-end overflow-hidden rounded-3xl bg-cover bg-center bg-no-repeat md:h-48"
            style={{
              backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.9), transparent), url(${siteConfig.heroBannerUrl})`,
            }}
            aria-label="Capa do perfil com estatísticas"
          >
            <dl className="mr-4 mb-2 flex gap-3 text-xs text-foreground md:mb-3">
              <div className="flex items-baseline gap-1">
                <dt className="sr-only">Posts</dt>
                <dd className="text-sm font-semibold text-foreground">{siteConfig.heroPostsCount}</dd>
                <span className="text-[0.7rem] tracking-wide text-foreground/90">posts</span>
              </div>
              <span className="text-foreground/80">•</span>
              <div className="flex items-baseline gap-1">
                <dt className="sr-only">Curtidas</dt>
                <dd className="text-sm font-semibold text-foreground">{siteConfig.heroLikesCount}</dd>
                <span className="text-[0.7rem] tracking-wide text-foreground/90">likes</span>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-6 md:grid md:grid-cols-[auto,minmax(0,1fr)] md:items-start">
            {/* Avatar + nome, inspirado no perfil original */}
            <section
              aria-labelledby="perfil-heading"
              className="flex flex-col items-start gap-4 md:flex-row md:items-center"
            >
              <div className="relative -mt-12 md:-mt-16">
                <div className="relative inline-flex items-center justify-center rounded-full border-4 border-destructive shadow-[0_0_20px_rgba(248,113,113,0.8)]">
                  <img
                    src={siteConfig.profileImageUrl}
                    alt="Foto de perfil de Bolzani"
                    className="h-24 w-24 rounded-full object-cover md:h-28 md:w-28"
                    loading="lazy"
                  />
                  <span className="badge-pill absolute -bottom-2 right-0 bg-destructive text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-destructive-foreground shadow-md shadow-destructive/40">
                    AO VIVO
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1
                    id="perfil-heading"
                    className="font-display text-2xl font-semibold tracking-tight md:text-3xl"
                  >
                    {siteConfig.profileName}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary">
                    verificado
                  </span>
                </div>
                <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {siteConfig.profileSubtitle}
                </p>
              </div>
            </section>

            {/* Cartão de planos com botão que abre o PIX */}
            <section aria-labelledby="planos-heading" className="space-y-4">
              <header className="space-y-1 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  assine agora
                </p>
              </header>

              <div className="mt-2 space-y-3">
                {subscriptionPlansFromConfig(siteConfig).map((plan) => (
                  <Button
                    key={plan.label}
                    variant="cta"
                    className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-base font-semibold shadow-lg shadow-primary/40 md:text-lg"
                    style={siteConfig.primaryButtonBgColor ? { backgroundColor: siteConfig.primaryButtonBgColor } : undefined}
                    onClick={() => handlePixCheckout(2990, "subscription")}
                  >
                    <span>{plan.label}</span>
                    <span className="flex items-center gap-2 text-sm font-semibold">{plan.price}</span>
                  </Button>
                ))}

                <Button
                  variant="whatsapp"
                  className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-base font-semibold shadow-lg shadow-emerald-500/40 md:text-lg"
                  style={siteConfig.whatsappButtonBgColor ? { backgroundColor: siteConfig.whatsappButtonBgColor } : undefined}
                  onClick={() => {
                    trackEvent("click_whatsapp");
                    handlePixCheckout(15000, "whatsapp");
                  }}
                >
                  <span>{siteConfig.whatsappButtonLabel}</span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {siteConfig.whatsappButtonPriceText}
                  </span>
                </Button>
              </div>

              <p className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span>
                  Pagamento 100% seguro, cobrança discreta no seu cartão e cancelamento simples a qualquer
                  momento.
                </span>
              </p>
            </section>
          </div>
        </section>
      </main>

      <section
        aria-label="Prévia do conteúdo"
        className="border-t border-border/60 bg-gradient-to-b from-background to-background/40"
      >
        <div className="container space-y-8 py-10">
          <div className="grid gap-4" aria-label="Prévia em vídeo do conteúdo da Kamylinha">
            <figure className="card-elevated overflow-hidden rounded-3xl">
              <video
                src={siteConfig.mainTeaserVideoUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
                muted
              />
            </figure>
          </div>

          <figure
            className="card-elevated overflow-hidden rounded-3xl"
            aria-label="Prévia em foto do feed da Bolzani"
          >
            <img
              src={siteConfig.gridImageUrl}
              alt="Prévia do feed da Bolzani com três fotos lado a lado"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="max-w-sm animate-enter rounded-3xl border border-border bg-background/95 px-6 py-5 shadow-xl shadow-primary/30">
          <DialogHeader className="space-y-2 text-center">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-primary">
              pagamento seguro
            </p>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Pague sua assinatura com PIX
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Escaneie o QR Code ou use o código copia e cola para concluir o pagamento em poucos segundos.
            </p>
          </DialogHeader>

          {isLoadingPix && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Gerando seu PIX, aguarde alguns segundos…
            </p>
          )}

          {!isLoadingPix && pixError && (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
              {pixError}
            </p>
          )}

          {!isLoadingPix && !pixError && (
            <div className="mt-4 space-y-4">
              {pixQrBase64 && (
                <div className="flex justify-center">
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-lg shadow-primary/20">
                    <img
                      src={`data:image/png;base64,${pixQrBase64}`}
                      alt="QR Code PIX para pagamento"
                      className="h-48 w-48 rounded-xl object-contain"
                    />
                  </div>
                </div>
              )}

              {pixCode && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    código copia e cola
                  </p>
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-2">
                    <textarea
                      className="max-h-24 min-h-[72px] w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-foreground"
                      readOnly
                      value={pixCode}
                    />
                    <Button
                      size="sm"
                      variant="cta"
                      className="self-stretch hover-scale text-sm font-semibold"
                      onClick={handleCopyPixCode}
                    >
                      Copiar código PIX
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <span>
                  Status: <span className="font-semibold text-primary">Aguardando pagamento</span>
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  <span>Ambiente protegido</span>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsappAccessModal} onOpenChange={setShowWhatsappAccessModal}>
        <DialogContent className="max-w-sm animate-enter rounded-3xl border border-border bg-background/95 px-6 py-5 shadow-xl shadow-emerald-500/30">
          <DialogHeader className="space-y-2 text-center">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-emerald-400">
              acesso liberado
            </p>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Bem-vindo(a) ao grupo VIP
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Seu pagamento foi confirmado. Clique no botão abaixo para entrar imediatamente no grupo VIP
              exclusivo.
            </p>
          </DialogHeader>

          <Button
            className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
            disabled={!whatsappLink}
            onClick={() => {
              if (whatsappLink) {
                window.open(whatsappLink, "_blank", "noopener,noreferrer");
              }
            }}
          >
            Entrar no grupo VIP agora
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
