import FacebookHeader from "./facebook-header";
import FacebookHero from "./facebook-hero";
import FacebookCardCarousel from "./facebook-card-carousel";
import FacebookLiveFeed from "./facebook-live-feed";
import FacebookReelsFlipCard from "./facebook-reels-flipcard";
import FacebookTrustedPartners from "./facebook-trusted-partners";
import FacebookFooter from "./facebook-footer";

export default function FacebookLandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-[#0A0A0B] text-white selection:bg-[#0866FF]/30 selection:text-white antialiased">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[30%] left-[15%] h-[70%] w-[60%] rounded-full bg-[#0866FF]/[0.15] blur-[140px]" />
        <div className="absolute top-[10%] right-[10%] h-[40%] w-[35%] rounded-full bg-[#1877F2]/[0.10] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] h-[50%] w-[50%] rounded-full bg-[#E7F3FF]/[0.03] blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10">
        <FacebookHeader />
        <main>
          <FacebookHero />
          <FacebookCardCarousel />
          <FacebookLiveFeed />
          <FacebookReelsFlipCard />
          <FacebookTrustedPartners />
        </main>
        <FacebookFooter />
      </div>
    </div>
  );
}
