import { Progress } from "@/components/landing/Progress";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Fly } from "@/components/landing/Fly";
import { CompanyDemo } from "@/components/landing/CompanyDemo";
import { Topics } from "@/components/landing/Topics";
import { Guide } from "@/components/landing/Guide";
import { Privacy } from "@/components/landing/Privacy";
import { Workflow } from "@/components/landing/Workflow";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Progress />
      <Nav />
      <main id="top">
        <Hero />
        <div className="perf to-paper" aria-hidden="true" />
        <Problem />
        <div className="perf to-ink" aria-hidden="true" />
        <Fly />
        <div className="perf to-paper" aria-hidden="true" />
        <CompanyDemo />
        <div className="perf to-ink" aria-hidden="true" />
        <Topics />
        <div className="perf to-paper" aria-hidden="true" />
        <Guide />
        <div className="perf to-ink" aria-hidden="true" />
        <Privacy />
        <div className="perf to-paper" aria-hidden="true" />
        <Workflow />
        <div className="perf to-ink" aria-hidden="true" />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
