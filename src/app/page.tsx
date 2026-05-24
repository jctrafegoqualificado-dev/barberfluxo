// @ts-nocheck
"use client";
import React, { useEffect } from "react";

export default function LandingPage() {
  useEffect(() => {
    // Billing toggle mensal/anual
    const btn = document.getElementById('billingToggle');
    const optM = document.getElementById('optMonthly');
    const optA = document.getElementById('optAnnual');
    const monthlyBlocks = ['priceG-monthly','priceGA-monthly','extraGA-monthly'];
    const annualBlocks  = ['priceG-annual', 'priceGA-annual', 'extraGA-annual'];
    let annual = false;

    if (btn) {
      const toggleHandler = () => {
        annual = !annual;
        btn.classList.toggle('annual', annual);
        if (optM) optM.classList.toggle('active', !annual);
        if (optA) optA.classList.toggle('active', annual);
        monthlyBlocks.forEach(id => { const el = document.getElementById(id); if(el) el.classList.toggle('hidden', annual); });
        annualBlocks.forEach(id  => { const el = document.getElementById(id);  if(el) el.classList.toggle('hidden', !annual); });
        // Link update removed since they now point to /login
      };
      btn.addEventListener('click', toggleHandler);
    }

    // Nav hamburger
    const hamburger = document.getElementById('hamburger');
    const navMobile = document.getElementById('navMobile');
    if (hamburger && navMobile) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navMobile.classList.toggle('open');
      });
      navMobile.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          hamburger.classList.remove('open');
          navMobile.classList.remove('open');
        });
      });
    }

    // FAQ accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });

    // Scroll animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.fade-up, .fade-left, .fade-right').forEach(el => observer.observe(el));

    // Carrossel automtico do browser mockup
    const panels = document.querySelectorAll('.browser-panel');
    const dots = document.querySelectorAll('.carousel-dot');
    const urlBar = document.getElementById('carouselUrl');
    let current = 0;
    let timer;

    function goTo(idx) {
      if(panels.length === 0) return;
      panels[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = idx;
      panels[current].classList.add('active');
      dots[current].classList.add('active');
      if (urlBar) urlBar.textContent = panels[current].dataset.url || '';
    }

    function next() { goTo((current + 1) % panels.length); }
    function startTimer() { timer = setInterval(next, 3200); }
    function resetTimer() { clearInterval(timer); startTimer(); }

    dots.forEach(dot => {
      dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.idx)); resetTimer(); });
    });

    if(panels.length > 0) startTimer();

    // WhatsApp animation ?" HERO
    let heroTimer;
    function runHeroWAAnimation() {
      const heroSteps = [
        { show: 'hwm1', delay: 600 },
        { show: 'hwt1', delay: 1200 },
        { hide: 'hwt1', show: 'hwm2', delay: 2200 },
        { show: 'hwm3', delay: 3200 },
        { show: 'hwt2', delay: 3900 },
        { hide: 'hwt2', show: 'hwm4', delay: 5000 },
        { show: 'hwm5', delay: 6200 },
        { show: 'hwt3', delay: 6900 },
        { hide: 'hwt3', show: 'hwm6', delay: 8000 },
      ];
      ['hwm1','hwm2','hwm3','hwm4','hwm5','hwm6','hwt1','hwt2','hwt3'].forEach(id => {
        const el = document.getElementById(id); if(el) el.classList.remove('show');
      });
      heroSteps.forEach(step => {
        setTimeout(() => {
          if (step.hide) { const el = document.getElementById(step.hide); if(el) el.classList.remove('show'); }
          if (step.show) { const el = document.getElementById(step.show); if(el) el.classList.add('show'); }
        }, step.delay);
      });
      heroTimer = setTimeout(runHeroWAAnimation, 10500);
    }
    runHeroWAAnimation();

    // WhatsApp chat animation ?" AGENT
    let agentTimer;
    function runWAAnimation() {
      const steps = [
        { show: 'wm1', delay: 400 },
        { show: 'wt1', delay: 900 },
        { hide: 'wt1', show: 'wm2', delay: 1800 },
        { show: 'wm3', delay: 2800 },
        { show: 'wt2', delay: 3400 },
        { hide: 'wt2', show: 'wm4', delay: 4600 },
        { show: 'wm5', delay: 5800 },
        { show: 'wt3', delay: 6400 },
        { hide: 'wt3', show: 'wm6', delay: 7600 },
      ];
      ['wm1','wm2','wm3','wm4','wm5','wm6','wt1','wt2','wt3'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('show');
      });
      steps.forEach(step => {
        setTimeout(() => {
          if (step.hide) { const el = document.getElementById(step.hide); if(el) el.classList.remove('show'); }
          if (step.show) { const el = document.getElementById(step.show); if(el) el.classList.add('show'); }
        }, step.delay);
      });
      agentTimer = setTimeout(runWAAnimation, 10500);
    }

    const phoneObs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        phoneObs.disconnect();
        runWAAnimation();
      }
    }, { threshold: 0.3 });
    const phoneSect = document.getElementById('agente');
    if (phoneSect) phoneObs.observe(phoneSect);

    return () => {
       clearInterval(timer);
       clearTimeout(heroTimer);
       clearTimeout(agentTimer);
       observer.disconnect();
       phoneObs.disconnect();
    }
  }, []);

  return (
    <div className="landing-page-ceo">
      <style dangerouslySetInnerHTML={{ __html: `
/* ===== RESET ===== */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --white:   #FFFFFF;
  --light:   #F5F4F2;
  --light2:  #EBEBEA;
  --dark:    #111111;
  --dark2:   #1A1A1A;
  --orange:  #FF5F00;
  --border-dark:  rgba(255,255,255,0.08);
  --border-light: rgba(0,0,0,0.09);
  --font: 'Plus Jakarta Sans', sans-serif;
  --radius: 18px;
}

html { scroll-behavior: smooth; }
body { font-family: var(--font); background: var(--white); color: var(--dark); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
a { text-decoration: none; color: inherit; }
::selection { background: var(--orange); color: #fff; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--light); }
::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }

.accent { color: var(--orange); }
.container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
.section { padding: 100px 0; }
.section-dark  { background: var(--dark); }
.section-light { background: var(--light); }
.section-light2 { background: var(--light2); }

/* ===== NAV ===== */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 40px; }
.nav-inner {
  max-width: 1200px; margin: 0 auto; height: 72px;
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,255,255,0.9); backdrop-filter: blur(20px);
  border: 1px solid var(--border-light); border-radius: 100px;
  padding: 0 32px; box-shadow: 0 2px 40px rgba(0,0,0,0.08);
}
/* logo: crop o whitespace extra do PNG com object-fit */
.nav-logo img {
  width: 170px;
  height: 58px;
  object-fit: cover;
  object-position: center 52%;
  display: block;
}
.nav-links { display: flex; align-items: center; gap: 4px; list-style: none; }
.nav-links a { font-size: 14px; font-weight: 500; color: rgba(0,0,0,.5); padding: 8px 16px; border-radius: 100px; transition: color .2s, background .2s; }
.nav-links a:hover { color: var(--dark); background: rgba(0,0,0,.05); }
.nav-cta { background: var(--orange); color: #fff; padding: 10px 24px; border-radius: 100px; font-weight: 800; font-size: 14px; transition: opacity .2s, transform .2s; }
.nav-cta:hover { opacity: .88; transform: translateY(-1px); }
.nav-hamburger { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; }
.nav-hamburger span { display: block; width: 22px; height: 2px; background: var(--dark); transition: all .3s; }
.nav-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.nav-hamburger.open span:nth-child(2) { opacity: 0; }
.nav-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.nav-mobile { display: none; flex-direction: column; background: #fff; border-radius: 16px; margin: 8px 40px 0; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 8px 32px rgba(0,0,0,.08); }
.nav-mobile a { padding: 16px 24px; font-size: 15px; font-weight: 500; color: rgba(0,0,0,.5); border-bottom: 1px solid var(--border-light); transition: color .2s; }
.nav-mobile a:last-child { border-bottom: none; }
.nav-mobile a:hover, .nav-mobile .mobile-cta { color: var(--orange); }
.nav-mobile.open { display: flex; }

/* ===== HERO ===== */
.hero { position: relative; min-height: 100vh; display: flex; align-items: center; background: var(--light); padding: 130px 40px 80px; }
.hero-content { max-width: 1200px; margin: 0 auto; width: 100%; }
.hero-badge { display: inline-flex; align-items: center; gap: 10px; background: rgba(255,95,0,.08); border: 1px solid rgba(255,95,0,.18); color: var(--orange); border-radius: 100px; padding: 8px 18px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 28px; }
.badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--orange); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
.hero-headline { font-size: clamp(48px, 7vw, 100px); font-weight: 900; line-height: .97; letter-spacing: -3px; color: var(--dark); margin-bottom: 28px; }
.hero-sub { font-size: clamp(16px, 1.8vw, 19px); color: #777; line-height: 1.7; font-weight: 400; max-width: 520px; margin-bottom: 44px; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 72px; }
.hero-stats { display: flex; gap: 0; flex-wrap: wrap; border: 1px solid rgba(0,0,0,.1); border-radius: 16px; background: #fff; padding: 28px 40px; width: fit-content; box-shadow: 0 2px 24px rgba(0,0,0,.06); }
.hero-stat { text-align: left; padding: 0 40px; }
.hero-stat:first-child { padding-left: 0; }
.hero-stat-num { display: block; font-size: 32px; font-weight: 900; letter-spacing: -1px; color: var(--dark); }
.hero-stat-lbl { display: block; font-size: 12px; color: #999; margin-top: 4px; font-weight: 400; }
.hero-stat-divider { width: 1px; background: rgba(0,0,0,.08); margin: 0; }

/* ===== BUTTONS ===== */
.btn-orange { background: var(--orange); color: #fff; padding: 16px 36px; border-radius: 100px; font-weight: 800; font-size: 15px; font-family: var(--font); transition: opacity .2s, transform .2s; display: inline-block; cursor: pointer; border: none; box-shadow: 0 4px 32px rgba(255,95,0,.3); }
.btn-orange:hover { opacity: .88; transform: translateY(-1px); }
.btn-outline { background: transparent; color: var(--dark); border: 2px solid var(--dark); padding: 16px 36px; border-radius: 100px; font-weight: 700; font-size: 15px; transition: background .2s, color .2s, transform .2s; display: inline-flex; align-items: center; gap: 8px; }
.btn-outline:hover { background: var(--dark); color: #fff; transform: translateY(-1px); }
.btn-full { width: 100%; text-align: center; }

/* ===== TICKER ===== */
.ticker-wrap { background: var(--dark); padding: 16px 0; overflow: hidden; }
.ticker-track { display: flex; gap: 40px; white-space: nowrap; animation: tickerScroll 28s linear infinite; width: max-content; }
.ticker-track span { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.35); letter-spacing: 2.5px; text-transform: uppercase; }
.ticker-sep { color: var(--orange) !important; opacity: 1 !important; }
@keyframes tickerScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }

/* ===== SECTION HEADERS ===== */
.section-header { margin-bottom: 64px; }
.section-tag { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--orange); margin-bottom: 16px; }
.section-tag::before { content: ''; width: 18px; height: 2px; background: var(--orange); border-radius: 2px; }
.section-tag.dark-tag { color: var(--dark); }
.section-tag.dark-tag::before { background: var(--dark); }
.section-title { font-size: clamp(34px, 4.5vw, 58px); font-weight: 900; letter-spacing: -2px; line-height: 1.05; color: #fff; }
.section-title.dark { color: var(--dark); }
.body-text { font-size: 16px; color: rgba(255,255,255,.45); line-height: 1.85; font-weight: 300; margin-bottom: 16px; }
.body-text.dark-text { color: #555; }
.body-text.dark-text strong { color: var(--dark); }

/* ===== DOR SECTION ===== */
.pain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
.pain-card { background: rgba(255,255,255,.04); border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 36px 32px; transition: transform .25s, background .25s; position: relative; overflow: hidden; }
.pain-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--orange); transform: scaleX(0); transform-origin: left; transition: transform .35s; }
.pain-card:hover { transform: translateY(-4px); background: rgba(255,255,255,.07); }
.pain-card:hover::after { transform: scaleX(1); }
.pain-card-wide { grid-column: span 2; }
.pain-emoji { font-size: 32px; margin-bottom: 20px; display: block; }
.pain-title { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 10px; letter-spacing: -.3px; }
.pain-desc { font-size: 14px; color: rgba(255,255,255,.45); line-height: 1.75; font-weight: 300; }

/* ===== FEATURES GRID ===== */
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.feature-card { background: #fff; border: 1px solid var(--border-light); border-radius: var(--radius); padding: 36px 32px; transition: transform .25s, box-shadow .25s; }
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,.1); }
.feature-check { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,95,0,.1); color: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 20px; }
.feature-title { font-size: 18px; font-weight: 800; color: var(--dark); margin-bottom: 8px; letter-spacing: -.3px; }
.feature-desc { font-size: 14px; color: #777; line-height: 1.7; }

/* ===== BROWSER MOCKUP / CARROSSEL ===== */
.mockup-wrap { margin-top: 72px; }
.browser-frame { background: #1e1e1e; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.2); }
.browser-bar { background: #2c2c2c; padding: 12px 20px; display: flex; align-items: center; gap: 12px; }
.browser-dots { display: flex; gap: 6px; }
.browser-dots span { width: 12px; height: 12px; border-radius: 50%; }
.browser-dots span:nth-child(1) { background: #ff5f57; }
.browser-dots span:nth-child(2) { background: #febc2e; }
.browser-dots span:nth-child(3) { background: #28c840; }
.browser-url { flex: 1; background: #3a3a3a; border-radius: 8px; padding: 6px 14px; font-size: 12px; color: rgba(255,255,255,.4); font-family: monospace; }
.browser-screen { position: relative; height: 480px; overflow: hidden; background: #f1f0ee; }
.browser-panel { position: absolute; inset: 0; opacity: 0; transition: opacity .6s ease; pointer-events: none; }
.browser-panel.active { opacity: 1; pointer-events: auto; }
.browser-panel img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
/* dots indicadores */
.carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
.carousel-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,.2); border: none; cursor: pointer; padding: 0; transition: background .3s, transform .3s; }
.carousel-dot.active { background: var(--orange); transform: scale(1.3); }

/* ===== BARBER PHOTO SECTION ===== */
.barber-split {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: 1fr 1fr;
  min-height: 480px;
}
.barber-split-left {
  background: var(--dark);
  padding: 56px 56px;
  display: flex; flex-direction: column; justify-content: center;
  position: relative; z-index: 2;
}
.barber-split-left::after {
  content: ''; position: absolute; top: 0; right: -40px; bottom: 0;
  width: 80px; background: var(--dark);
  clip-path: polygon(0 0, 0 100%, 100% 100%);
  z-index: 3;
}
.barber-split-right {
  position: relative; overflow: hidden;
  background: #222;
}
.barber-split-right img { width: 100%; height: 100%; object-fit: cover; filter: brightness(.7); }
.barber-split-right-placeholder {
  width: 100%; height: 100%; min-height: 560px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2020 50%, #1a1510 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
}
.barber-ph-icon { font-size: 72px; opacity: .3; }
.barber-ph-text { font-size: 13px; color: rgba(255,255,255,.25); text-align: center; line-height: 1.6; }
.barber-split-left h2 { font-size: clamp(28px, 3vw, 44px); font-weight: 900; letter-spacing: -1.5px; line-height: 1.1; color: #fff; margin-bottom: 16px; }
.barber-split-left p { font-size: 15px; color: rgba(255,255,255,.55); line-height: 1.65; margin-bottom: 28px; max-width: 440px; }
.barber-badge-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
.barber-badge-item { display: flex; align-items: center; gap: 12px; font-size: 15px; color: rgba(255,255,255,.7); font-weight: 500; }
.barber-badge-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,95,0,.15); color: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }

/* ===== AGENTE — layout split ===== */
.agent-layout { display: grid; grid-template-columns: 1fr 380px; gap: 60px; align-items: start; }
.agent-cards-col { display: flex; flex-direction: column; gap: 14px; }
.agent-card { background: rgba(255,255,255,.05); border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 28px 28px; transition: transform .25s, background .25s; display: flex; gap: 18px; align-items: flex-start; }
.agent-card:hover { transform: translateX(6px); background: rgba(255,255,255,.08); }
.agent-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,95,0,.15); color: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.agent-card-body { flex: 1; }
.agent-title { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 4px; }
.agent-desc { font-size: 13px; color: rgba(255,255,255,.45); line-height: 1.7; }

/* ===== WHATSAPP PHONE ANIMATION ===== */
.phone-mockup { position: sticky; top: 120px; }
.phone-shell {
  width: 300px; margin: 0 auto;
  background: #111; border-radius: 40px;
  padding: 14px;
  box-shadow: 0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08);
}
.phone-screen {
  background: #ece5dd;
  border-radius: 28px; overflow: hidden;
  height: 560px; display: flex; flex-direction: column;
}
.wa-header {
  background: #075e54; padding: 12px 14px 10px;
  display: flex; align-items: center; gap: 10px;
}
.wa-avatar { width: 36px; height: 36px; border-radius: 50%; background: #128c7e; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.wa-name { font-size: 13px; font-weight: 700; color: #fff; line-height: 1.2; }
.wa-status { font-size: 11px; color: rgba(255,255,255,.7); }
.wa-body { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.wa-msg { max-width: 82%; padding: 8px 10px 6px; border-radius: 8px; font-size: 11.5px; line-height: 1.5; position: relative; opacity: 0; transform: translateY(10px); transition: opacity .4s, transform .4s; }
.wa-msg.show { opacity: 1; transform: translateY(0); }
.wa-msg-in { background: #fff; align-self: flex-start; border-radius: 0 8px 8px 8px; color: #111; }
.wa-msg-out { background: #d9fdd3; align-self: flex-end; border-radius: 8px 0 8px 8px; color: #111; }
.wa-time { font-size: 9px; color: rgba(0,0,0,.4); text-align: right; margin-top: 2px; }
.wa-typing { background: #fff; align-self: flex-start; border-radius: 0 8px 8px 8px; padding: 10px 14px; display: flex; gap: 4px; align-items: center; opacity: 0; transition: opacity .3s; }
.wa-typing.show { opacity: 1; }
.wa-typing span { width: 6px; height: 6px; border-radius: 50%; background: #999; animation: typing 1.2s infinite; }
.wa-typing span:nth-child(2) { animation-delay: .2s; }
.wa-typing span:nth-child(3) { animation-delay: .4s; }
@keyframes typing { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

/* ===== DIFF BANNER ===== */
.diff-banner { background: rgba(255,95,0,.08); border: 1px solid rgba(255,95,0,.2); border-radius: var(--radius); padding: 24px 32px; display: flex; align-items: center; gap: 18px; margin-bottom: 52px; }
.diff-banner-icon { font-size: 32px; flex-shrink: 0; }
.diff-banner p { font-size: 15px; color: rgba(255,255,255,.7); line-height: 1.6; }
.diff-banner strong { color: var(--orange); }

/* ===== PLANOS ===== */
.billing-toggle { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 48px; }
.billing-opt { font-size: 15px; font-weight: 600; color: #bbb; transition: color .2s; cursor: pointer; }
.billing-opt.active { color: var(--dark); }
.toggle-btn { width: 52px; height: 28px; background: #ddd; border: none; border-radius: 100px; cursor: pointer; position: relative; transition: background .3s; padding: 0; flex-shrink: 0; }
.toggle-btn.annual { background: var(--orange); }
.toggle-thumb { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); transition: transform .3s; }
.toggle-btn.annual .toggle-thumb { transform: translateX(24px); }
.save-badge { background: rgba(255,95,0,.12); color: var(--orange); font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 100px; margin-left: 6px; text-transform: uppercase; letter-spacing: .5px; }

.plans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 900px; margin: 0 auto; }
.plan-card { background: #fff; border: 2px solid var(--border-light); border-radius: 24px; padding: 44px 40px; position: relative; transition: transform .25s, box-shadow .25s; }
.plan-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,.1); }
.plan-card-featured { border-color: var(--orange); box-shadow: 0 8px 48px rgba(255,95,0,.15); }
.plan-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--orange); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 20px; border-radius: 100px; white-space: nowrap; }
.plan-name { font-size: 14px; font-weight: 700; color: var(--orange); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
.plan-price { font-size: 48px; font-weight: 900; letter-spacing: -2px; color: var(--dark); line-height: 1; margin-bottom: 4px; }
.plan-price span { font-size: 20px; font-weight: 600; letter-spacing: 0; vertical-align: super; }
.plan-period { font-size: 13px; color: #aaa; margin-bottom: 20px; }
.plan-desc { font-size: 14px; color: #777; line-height: 1.6; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border-light); }
.plan-features { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
.plan-features li { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: var(--dark); line-height: 1.5; }
.plan-features li::before { content: '✓'; color: var(--orange); font-weight: 900; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.plan-extra { background: rgba(255,95,0,.07); border: 1px solid rgba(255,95,0,.18); border-radius: 10px; padding: 11px 14px; margin-bottom: 28px; font-size: 13px; color: #555; line-height: 1.5; }
.plan-extra strong { color: var(--orange); font-weight: 800; }
.plans-note { text-align: center; margin-top: 24px; font-size: 14px; color: #999; }
.plans-note strong { color: var(--dark); }

/* preços toggle */
.price-block { transition: opacity .25s; }
.hidden { display: none !important; }

/* ===== DEPOIMENTOS ===== */
.testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.testi-card { background: #fff; border: 1px solid var(--border-light); border-radius: var(--radius); padding: 36px 32px; transition: transform .25s, box-shadow .25s; }
.testi-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,.08); }
.testi-stars { color: var(--orange); font-size: 16px; margin-bottom: 16px; letter-spacing: 2px; }
.testi-text { font-size: 15px; color: #444; line-height: 1.75; font-style: italic; margin-bottom: 24px; }
.testi-author { display: flex; align-items: center; gap: 12px; }
.testi-avatar { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,95,0,.1); color: var(--orange); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; flex-shrink: 0; }
.testi-name { font-weight: 800; font-size: 14px; color: var(--dark); }
.testi-biz { font-size: 12px; color: #aaa; }

/* ===== FAQ ===== */
.faq-list { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.faq-item { border: 1px solid rgba(0,0,0,.1); border-radius: var(--radius); overflow: hidden; background: #fff; }
.faq-question { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 22px 28px; background: none; border: none; cursor: pointer; font-family: var(--font); font-size: 16px; font-weight: 700; color: var(--dark); text-align: left; transition: color .2s; }
.faq-question:hover { color: var(--orange); }
.faq-icon { font-size: 22px; flex-shrink: 0; transition: transform .3s; color: var(--orange); }
.faq-answer { max-height: 0; overflow: hidden; transition: max-height .35s ease, padding .3s; padding: 0 28px; }
.faq-answer p { font-size: 15px; color: #555; line-height: 1.7; }
.faq-item.open .faq-icon { transform: rotate(45deg); }
.faq-item.open .faq-answer { max-height: 300px; padding: 0 28px 22px; }

/* ===== CTA FINAL ===== */
.cta-final { background: var(--dark); padding: 72px 40px; text-align: center; }
.cta-final-content { max-width: 900px; margin: 0 auto; }
.cta-final h2 { font-size: clamp(26px, 3.2vw, 44px); font-weight: 900; letter-spacing: -1px; line-height: 1.15; color: #fff; margin-bottom: 16px; }
.cta-final p { font-size: 16px; color: rgba(255,255,255,.5); line-height: 1.7; margin-bottom: 36px; }
.cta-trust { display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; margin-top: 28px; }
.cta-trust-item { font-size: 13px; color: rgba(255,255,255,.35); display: flex; align-items: center; gap: 6px; }
.cta-trust-item::before { content: '·'; color: var(--orange); font-size: 20px; line-height: 1; }

/* ===== FOOTER ===== */
.footer { background: var(--dark2); padding: 32px 40px; border-top: 1px solid var(--border-dark); }
.footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.footer-logo img {
  width: 160px;
  height: 54px;
  object-fit: cover;
  object-position: center 52%;
  display: block;
  filter: brightness(0) invert(1);
}
.footer-copy { font-size: 13px; color: rgba(255,255,255,.2); }
.footer-top { font-size: 13px; color: rgba(255,255,255,.3); transition: color .2s; }
.footer-top:hover { color: var(--orange); }

/* ===== HERO VISUAL (split layout) ===== */
.hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; max-width: 1200px; margin: 0 auto; width: 100%; }
.hero-text .hero-headline { font-size: clamp(32px, 4.2vw, 64px); letter-spacing: -2px; }
.hero-text .hero-sub { max-width: 100%; }
.hero-text .hero-stats { width: 100%; flex-wrap: nowrap; padding: 20px 28px; }
.hero-text .hero-stat { padding: 0 24px; }
.hero-text .hero-stat-num { font-size: 26px; }
.hero-text .hero-stat-lbl { font-size: 11px; }
.hero-visual { position: relative; height: 540px; }
.h-browser {
  position: absolute; top: 0; left: 0; right: 60px;
  background: #1e1e1e; border-radius: 14px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.18); z-index: 1;
}
.h-browser-top { background: #2c2c2c; padding: 9px 14px; display: flex; align-items: center; gap: 10px; }
.h-browser-url { flex: 1; background: #3a3a3a; border-radius: 6px; padding: 4px 10px; font-size: 10px; color: rgba(255,255,255,.4); font-family: monospace; }
.h-browser img { width: 100%; height: 260px; object-fit: cover; object-position: top left; display: block; }
.hero-phone { position: absolute; bottom: 0; right: -10px; z-index: 2; }
.hero-phone .phone-shell { width: 195px; margin: 0; box-shadow: 0 28px 70px rgba(0,0,0,.45); }
.hero-phone .phone-screen { height: 340px; }
.hero-phone .wa-msg { font-size: 10.5px; }

/* ===== ANIMATIONS ===== */
.fade-up { opacity: 0; transform: translateY(30px); transition: opacity .7s ease, transform .7s ease; }
.fade-left { opacity: 0; transform: translateX(-30px); transition: opacity .7s ease, transform .7s ease; }
.fade-right { opacity: 0; transform: translateX(30px); transition: opacity .7s ease, transform .7s ease; }
.fade-up.visible, .fade-left.visible, .fade-right.visible { opacity: 1; transform: translate(0); }
.delay-1 { transition-delay: .1s; }
.delay-2 { transition-delay: .2s; }
.delay-3 { transition-delay: .3s; }
.delay-4 { transition-delay: .45s; }

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .pain-grid { grid-template-columns: 1fr 1fr; }
  .pain-card-wide { grid-column: span 2; }
  .features-grid { grid-template-columns: 1fr 1fr; }
  .testi-grid { grid-template-columns: 1fr 1fr; }
  .plans-grid { grid-template-columns: 1fr; max-width: 500px; }
  .agent-layout { grid-template-columns: 1fr; }
  .phone-mockup { display: none; }
  .barber-split { grid-template-columns: 1fr; }
  .barber-split-left::after { display: none; }
  .barber-split-right { min-height: 300px; }
}
@media (max-width: 768px) {
  .nav { padding: 12px 16px; }
  .nav-inner { height: 64px; }
  .nav-links, .nav-cta { display: none; }
  .nav-hamburger { display: flex; }
  .nav-mobile { margin: 8px 16px 0; }
  .hero { padding: 120px 24px 60px; }
  .hero-grid { grid-template-columns: 1fr; gap: 40px; }
  .hero-visual { display: none; }
  .hero-headline { letter-spacing: -2px; }
  .hero-stats { padding: 20px 24px; flex-direction: column; gap: 16px; }
  .hero-stat { padding: 0 !important; }
  .hero-stat-divider { width: 100%; height: 1px; }
  .section { padding: 72px 0; }
  .container { padding: 0 24px; }
  .section-header { margin-bottom: 40px; }
  .pain-grid { grid-template-columns: 1fr; }
  .pain-card-wide { grid-column: span 1; }
  .features-grid { grid-template-columns: 1fr; }
  .testi-grid { grid-template-columns: 1fr; }
  .plans-grid { grid-template-columns: 1fr; }
  .hero-actions { flex-direction: column; }
  .btn-orange, .btn-outline { text-align: center; justify-content: center; }
  .diff-banner { flex-direction: column; text-align: center; }
  .cta-final { padding: 80px 24px; }
  .footer { padding: 24px; }
  .barber-split-left { padding: 60px 28px; }
  .mockup-tabs { flex-wrap: wrap; }
  .browser-screen { height: 280px; }
}
@media (max-width: 480px) {
  .hero-headline { letter-spacing: -1px; }
  .plan-card { padding: 36px 28px; }
}
` }} />
      <div dangerouslySetInnerHTML={{ __html: `

<!-- NAV -->
<nav class="nav">
  <div class="nav-inner">
    <a href="#" class="nav-logo"><img src="IA de barbearia.png transparente.png" alt="IA de Barbearia"></a>
    <ul class="nav-links">
      <li><a href="#dor">O problema</a></li>
      <li><a href="#produto">Produto</a></li>
      <li><a href="#agente">Agente IA</a></li>
      <li><a href="#planos">Planos</a></li>
      <li><a href="#faq">FAQ</a></li>
    </ul>
    <a href="/cadastro" class="nav-cta">Começar agora</a>
    <button class="nav-hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
  <div class="nav-mobile" id="navMobile">
    <a href="#dor">O problema</a>
    <a href="#produto">Produto</a>
    <a href="#agente">Agente IA</a>
    <a href="#planos">Planos</a>
    <a href="#faq">FAQ</a>
    <a href="/cadastro" class="mobile-cta" style="color: var(--orange);">Começar agora →</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-grid">

    <!-- TEXTO -->
    <div class="hero-text">
      <div class="hero-badge fade-up">
        <span class="badge-dot"></span>
        Sistema + IA para barbearias
      </div>
      <h1 class="hero-headline fade-up delay-1">
        Assuma o controle<br>total da sua<br><span class="accent">barbearia</span><br>com Inteligência<br>Artificial.
      </h1>
      <p class="hero-sub fade-up delay-2">A IA DE BARBEARIA centraliza sua gestão, automatiza suas comissões e atende seus clientes 24 horas por dia.</p>
      <div class="hero-actions fade-up delay-3">
        <a href="/cadastro"  class="btn-orange">Quero modernizar minha barbearia</a>
        <a href="#agente" class="btn-outline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Ver a IA em ação
        </a>
      </div>
      <div class="hero-stats fade-up delay-4">
        <div class="hero-stat">
          <span class="hero-stat-num accent">85%</span>
          <span class="hero-stat-lbl">Menos faltas (no-show)</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <span class="hero-stat-num accent">24/7</span>
          <span class="hero-stat-lbl">Atendimento automático</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <span class="hero-stat-num accent">100%</span>
          <span class="hero-stat-lbl">Comissões sem erros</span>
        </div>
      </div>
    </div>

    <!-- VISUAL: dashboard + WhatsApp -->
    <div class="hero-visual fade-right">
      <!-- Browser com dashboard -->
      <div class="h-browser">
        <div class="h-browser-top">
          <div class="browser-dots"><span></span><span></span><span></span></div>
          <div class="h-browser-url">app.iabarbearia.com.br/dashboard</div>
        </div>
        <img src="Fotos Produtos/Foto Principal.jpeg" alt="Dashboard IA de Barbearia">
      </div>
      <!-- Phone WhatsApp animation -->
      <div class="hero-phone">
        <div class="phone-shell">
          <div class="phone-screen">
            <div class="wa-header">
              <div class="wa-avatar">💈</div>
              <div>
                <div class="wa-name">Barbearia do Lucas</div>
                <div class="wa-status">● online agora</div>
              </div>
            </div>
            <div class="wa-body" id="heroWaBody">
              <div class="wa-msg wa-msg-in" id="hwm1">
                Oi, tem horário amanhã à tarde?
                <div class="wa-time">14:02</div>
              </div>
              <div class="wa-typing" id="hwt1"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="hwm2">
                Oi! Temos sim! 🎉 Às 14h, 15h30 e 17h. Qual prefere?
                <div class="wa-time">14:02</div>
              </div>
              <div class="wa-msg wa-msg-in" id="hwm3">
                15h30 com o Lucas!
                <div class="wa-time">14:03</div>
              </div>
              <div class="wa-typing" id="hwt2"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="hwm4">
                Perfeito! 📅 Agendado. Corte + Barba às 15h30. Vou te lembrar 1h antes! 😊
                <div class="wa-time">14:03</div>
              </div>
              <div class="wa-msg wa-msg-in" id="hwm5">
                Vocês têm plano mensal?
                <div class="wa-time">14:04</div>
              </div>
              <div class="wa-typing" id="hwt3"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="hwm6">
                Temos! 🔥 R\$197/mês, cortes ilimitados. Quer saber mais?
                <div class="wa-time">14:04</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- TICKER -->
<div class="ticker-wrap">
  <div class="ticker-track">
    <span>Agenda inteligente</span><span class="ticker-sep">✦</span>
    <span>Comissões automáticas</span><span class="ticker-sep">✦</span>
    <span>Fluxo de caixa</span><span class="ticker-sep">✦</span>
    <span>Agente de IA no WhatsApp</span><span class="ticker-sep">✦</span>
    <span>Atendimento 24/7</span><span class="ticker-sep">✦</span>
    <span>Histórico de clientes</span><span class="ticker-sep">✦</span>
    <span>Zero no-show</span><span class="ticker-sep">✦</span>
    <span>Dashboard de performance</span><span class="ticker-sep">✦</span>
    <span>Planos de assinatura</span><span class="ticker-sep">✦</span>
    <span>Agenda inteligente</span><span class="ticker-sep">✦</span>
    <span>Comissões automáticas</span><span class="ticker-sep">✦</span>
    <span>Fluxo de caixa</span><span class="ticker-sep">✦</span>
    <span>Agente de IA no WhatsApp</span><span class="ticker-sep">✦</span>
    <span>Atendimento 24/7</span><span class="ticker-sep">✦</span>
    <span>Histórico de clientes</span><span class="ticker-sep">✦</span>
    <span>Zero no-show</span><span class="ticker-sep">✦</span>
    <span>Dashboard de performance</span><span class="ticker-sep">✦</span>
    <span>Planos de assinatura</span><span class="ticker-sep">✦</span>
  </div>
</div>

<!-- DOR -->
<section id="dor" class="section section-dark">
  <div class="container">
    <div class="section-header fade-up">
      <span class="section-tag">O problema</span>
      <h2 class="section-title">Você está perdendo<br>dinheiro todos os dias<br><span class="accent">(e talvez nem perceba)</span></h2>
      <p class="body-text" style="max-width:600px;margin-top:20px;">A verdade é que a maioria das barbearias deixa dinheiro na mesa por três motivos simples: <strong style="color:rgba(255,255,255,.75)">falta de tempo, respostas demoradas e desorganização.</strong></p>
    </div>
    <div class="pain-grid">
      <div class="pain-card fade-up delay-1">
        <span class="pain-emoji">📵</span>
        <h3 class="pain-title">Cliente no WhatsApp, você na cadeira</h3>
        <p class="pain-desc">Enquanto você atende um cliente, três estão esperando no WhatsApp. Quando você finalmente responde, eles já agendaram na concorrência. Cada minuto de silêncio é dinheiro jogado no lixo.</p>
      </div>
      <div class="pain-card fade-up delay-2">
        <span class="pain-emoji">📋</span>
        <h3 class="pain-title">A ilusão da "agenda controlada"</h3>
        <p class="pain-desc">Bloquinho de papel, grupo de WhatsApp ou sistemas complicados. O resultado? Duplo agendamento, esquecimento e cliente que não aparece porque ninguém mandou um lembrete.</p>
      </div>
      <div class="pain-card fade-up delay-3">
        <span class="pain-emoji">💸</span>
        <h3 class="pain-title">O "buraco negro" do financeiro</h3>
        <p class="pain-desc">Quanto sua barbearia faturou de verdade este mês? Qual barbeiro dá mais lucro? Se você precisa rodar três planilhas para descobrir, você não tem controle do seu negócio.</p>
      </div>
      <div class="pain-card fade-up delay-1">
        <span class="pain-emoji">🔄</span>
        <h3 class="pain-title">Clientes que somem sem deixar rastro</h3>
        <p class="pain-desc">Você sabe quem cortou o cabelo há 30 dias e nunca mais voltou? Sem esses dados, você não consegue criar fidelidade. O cliente vai embora e você nem fica sabendo.</p>
      </div>
      <div class="pain-card pain-card-wide fade-up delay-2">
        <span class="pain-emoji">🧮</span>
        <h3 class="pain-title">O pesadelo do fechamento de comissões</h3>
        <p class="pain-desc">Todo sábado ou fim de mês é a mesma coisa: calculadora na mão, conferência de papelzinho, erro humano e desgaste com a equipe. Gestão não deveria ser sinônimo de dor de cabeça.</p>
      </div>
    </div>
  </div>
</section>

<!-- PRODUTO -->
<section id="produto" class="section section-light">
  <div class="container">
    <div class="section-header fade-up">
      <span class="section-tag dark-tag">O sistema</span>
      <h2 class="section-title dark">Sua barbearia na<br>palma da mão</h2>
      <p class="body-text dark-text" style="max-width:640px;margin-top:20px;">O único sistema do mercado que combina gestão completa com um Agente de IA que atende, agenda e vende pelo WhatsApp exatamente como um barbeiro de verdade. Chega de achismo. <strong>Tenha visibilidade total do seu negócio em tempo real.</strong></p>
    </div>
    <div class="features-grid">
      <div class="feature-card fade-up delay-1">
        <div class="feature-check">📅</div>
        <h3 class="feature-title">Agenda inteligente</h3>
        <p class="feature-desc">Visualização limpa e atualizações em tempo real. Nunca mais duplo agendamento ou horário perdido.</p>
      </div>
      <div class="feature-card fade-up delay-2">
        <div class="feature-check">💰</div>
        <h3 class="feature-title">Comissões automáticas</h3>
        <p class="feature-desc">Defina as regras e o sistema calcula tudo sozinho. Zero erros, zero estresse, zero desgaste com a equipe.</p>
      </div>
      <div class="feature-card fade-up delay-3">
        <div class="feature-check">📊</div>
        <h3 class="feature-title">Fluxo de caixa real</h3>
        <p class="feature-desc">Relatórios financeiros simples que mostram para onde vai cada centavo. Decisões com dados, não com achismo.</p>
      </div>
      <div class="feature-card fade-up delay-1">
        <div class="feature-check">🔄</div>
        <h3 class="feature-title">Planos de assinatura</h3>
        <p class="feature-desc">Crie clubes de assinatura para garantir faturamento previsível todo mês. Receita recorrente e clientes fiéis.</p>
      </div>
      <div class="feature-card fade-up delay-2">
        <div class="feature-check">👤</div>
        <h3 class="feature-title">Histórico de clientes</h3>
        <p class="feature-desc">Saiba quem são seus melhores clientes, o que consomem e quando costumam voltar. CRM completo para barbearia.</p>
      </div>
      <div class="feature-card fade-up delay-3">
        <div class="feature-check">🎯</div>
        <h3 class="feature-title">Painel de performance</h3>
        <p class="feature-desc">Gráficos visuais de faturamento, taxa de ocupação das cadeiras e metas por barbeiro. Gestão profissional de verdade.</p>
      </div>
    </div>

    <!-- BROWSER MOCKUP / CARROSSEL AUTOMÁTICO -->
    <div class="mockup-wrap fade-up">
      <div class="browser-frame">
        <div class="browser-bar">
          <div class="browser-dots"><span></span><span></span><span></span></div>
          <div class="browser-url" id="carouselUrl">app.iabarbearia.com.br/dashboard</div>
        </div>
        <div class="browser-screen">
          <div class="browser-panel active" data-url="app.iabarbearia.com.br/dashboard">
            <img src="Fotos Produtos/Foto 1.png" alt="Dashboard IA de Barbearia">
          </div>
          <div class="browser-panel" data-url="app.iabarbearia.com.br/agenda">
            <img src="Fotos Produtos/Foto 2.png" alt="Agenda IA de Barbearia">
          </div>
          <div class="browser-panel" data-url="app.iabarbearia.com.br/financeiro">
            <img src="Fotos Produtos/Foto 3.png" alt="Financeiro IA de Barbearia">
          </div>
          <div class="browser-panel" data-url="app.iabarbearia.com.br/comissoes">
            <img src="Fotos Produtos/Foto 4.png" alt="Comissões IA de Barbearia">
          </div>
        </div>
      </div>
      <div class="carousel-dots">
        <button class="carousel-dot active" data-idx="0"></button>
        <button class="carousel-dot" data-idx="1"></button>
        <button class="carousel-dot" data-idx="2"></button>
        <button class="carousel-dot" data-idx="3"></button>
      </div>
    </div>
  </div>
</section>

<!-- BARBER SPLIT SECTION (barbeiro feliz) -->
<div class="barber-split">
  <div class="barber-split-left fade-left">
    <span class="section-tag" style="margin-bottom:20px;">Por que funciona</span>
    <h2>Feito de barbeiro<br>para <span class="accent">barbeiro.</span></h2>
    <p>O sistema foi criado por quem entende o dia a dia de uma barbearia. Sem burocracia, sem complicação. Na primeira semana você já vê a diferença no caixa e na agenda.</p>
    <div class="barber-badge-list">
      <div class="barber-badge-item">
        <div class="barber-badge-icon">⚡</div>
        Configure em menos de 1 dia com suporte humano
      </div>
      <div class="barber-badge-item">
        <div class="barber-badge-icon">📱</div>
        Acesse do celular, tablet ou computador
      </div>
      <div class="barber-badge-item">
        <div class="barber-badge-icon">🔒</div>
        Seus dados seguros e sempre disponíveis
      </div>
    </div>
    <a href="/cadastro"  class="btn-orange">Quero testar agora</a>
  </div>
  <div class="barber-split-right">
    <img src="Foto - feito de barbeiro para baerbeiro.png" alt="Barbeiro usando o sistema IA de Barbearia">
  </div>
</div>

<!-- AGENTE IA -->
<section id="agente" class="section section-dark">
  <div class="container">
    <div class="section-header fade-up">
      <span class="section-tag">Agente de IA</span>
      <h2 class="section-title">Não é um chatbot travado.<br>É um <span class="accent">funcionário digital</span><br>no seu WhatsApp.</h2>
    </div>

    <div class="diff-banner fade-up">
      <div class="diff-banner-icon">🤖</div>
      <p>Chatbots antigos irritam o cliente com menus numéricos ("Digite 1 para..."). Nosso Agente de IA <strong>conversa de forma natural</strong>, entende gírias, interpreta o contexto, vende e fecha novos agendamentos direto no WhatsApp — <strong>24 horas por dia, 7 dias por semana.</strong></p>
    </div>

    <div class="agent-layout">
      <!-- CARDS LADO ESQUERDO -->
      <div class="agent-cards-col">
        <div class="agent-card fade-up delay-1">
          <div class="agent-icon">💬</div>
          <div class="agent-card-body">
            <h3 class="agent-title">Conversa humana</h3>
            <p class="agent-desc">Linguagem natural, fluida e personalizada com o tom da sua barbearia. Seu cliente nunca vai perceber que é uma IA.</p>
          </div>
        </div>
        <div class="agent-card fade-up delay-2">
          <div class="agent-icon">📱</div>
          <div class="agent-card-body">
            <h3 class="agent-title">Agendamento direto</h3>
            <p class="agent-desc">A IA consulta a disponibilidade da sua agenda em tempo real, oferece os horários livres e fecha o compromisso sem você tocar no telefone.</p>
          </div>
        </div>
        <div class="agent-card fade-up delay-3">
          <div class="agent-icon">🛒</div>
          <div class="agent-card-body">
            <h3 class="agent-title">Vendas no chat</h3>
            <p class="agent-desc">Além de agendar, a IA oferece planos de assinatura e produtos durante a conversa. Receita extra no piloto automático.</p>
          </div>
        </div>
        <div class="agent-card fade-up delay-1">
          <div class="agent-icon">🔔</div>
          <div class="agent-card-body">
            <h3 class="agent-title">Confirmações automáticas</h3>
            <p class="agent-desc">Envia lembretes automáticos reduzindo as faltas em até 85%. Sua agenda cheia e seu caixa no azul.</p>
          </div>
        </div>
        <div class="agent-card fade-up delay-2">
          <div class="agent-icon">⏰</div>
          <div class="agent-card-body">
            <h3 class="agent-title">Atendimento sem pausa</h3>
            <p class="agent-desc">Madrugada, domingos ou feriados — seu cliente tem resposta em segundos. Desligue o celular no domingo e volte com a agenda cheia.</p>
          </div>
        </div>
      </div>

      <!-- PHONE ANIMATION LADO DIREITO -->
      <div class="phone-mockup fade-right">
        <div class="phone-shell">
          <div class="phone-screen">
            <div class="wa-header">
              <div class="wa-avatar">💈</div>
              <div>
                <div class="wa-name">Barbearia do Lucas</div>
                <div class="wa-status">● online agora</div>
              </div>
            </div>
            <div class="wa-body" id="waBody">
              <div class="wa-msg wa-msg-in" id="wm1">
                Oi, tem horário amanhã à tarde pra corte e barba?
                <div class="wa-time">14:02</div>
              </div>
              <div class="wa-typing" id="wt1"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="wm2">
                Oi! Temos sim! 🎉 Amanhã temos horários às 14h, 15h30 e 17h. Qual você prefere? Temos o Lucas e o Rafa disponíveis.
                <div class="wa-time">14:02</div>
              </div>
              <div class="wa-msg wa-msg-in" id="wm3">
                Pode ser às 15h30 com o Lucas!
                <div class="wa-time">14:03</div>
              </div>
              <div class="wa-typing" id="wt2"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="wm4">
                Perfeito! 📅 Agendei: Corte + Barba com Lucas amanhã às 15h30. Valor: R\$60. Vou te mandar um lembrete 1h antes. Até amanhã! 😊
                <div class="wa-time">14:03</div>
              </div>
              <div class="wa-msg wa-msg-in" id="wm5">
                Show! E vocês têm plano mensal?
                <div class="wa-time">14:04</div>
              </div>
              <div class="wa-typing" id="wt3"><span></span><span></span><span></span></div>
              <div class="wa-msg wa-msg-out" id="wm6">
                Temos! 🔥 Nosso plano sai por R\$197/mês e inclui cortes ilimitados + barba. Você economiza mais de R\$100 por mês. Quer mais detalhes?
                <div class="wa-time">14:04</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PLANOS -->
<section id="planos" class="section section-light2">
  <div class="container">
    <div class="section-header fade-up" style="text-align:center">
      <span class="section-tag dark-tag" style="margin:0 auto 16px;display:inline-flex;">Planos</span>
      <h2 class="section-title dark" style="font-size:clamp(28px,3.5vw,46px);letter-spacing:-1.5px;white-space:nowrap;">Conheça nossos planos disponíveis</h2>
    </div>

    <!-- TOGGLE MENSAL / ANUAL -->
    <div class="billing-toggle fade-up">
      <span class="billing-opt active" id="optMonthly">Mensal</span>
      <button class="toggle-btn" id="billingToggle" aria-label="Alternar período">
        <span class="toggle-thumb"></span>
      </button>
      <span class="billing-opt" id="optAnnual">Anual <span class="save-badge">Economize</span></span>
    </div>

    <div class="plans-grid" id="plansGrid">

      <!-- PLANO GESTÃO -->
      <div class="plan-card fade-up delay-1">
        <p class="plan-name">Plano gestão</p>

        <div class="price-block" id="priceG-monthly">
          <div class="plan-price"><span>R\$</span>154<span style="font-size:28px;vertical-align:baseline">,90</span></div>
          <p class="plan-period">por mês · cobrado mensalmente</p>
        </div>
        <div class="price-block hidden" id="priceG-annual">
          <div class="plan-price"><span>R\$</span>139<span style="font-size:28px;vertical-align:baseline">,90</span></div>
          <p class="plan-period">por mês · cobrado anualmente</p>
        </div>

        <p class="plan-desc">Para barbearia completa — organização e controle total da operação interna.</p>
        <ul class="plan-features">
          <li>CRM para gestão completo</li>
          <li>Agendamentos ilimitados</li>
          <li>Controle financeiro e fluxo de caixa</li>
          <li>Gestão de produtos e estoque</li>
          <li>Planos de assinatura e recorrência</li>
          <li>Dashboard de metas e performance</li>
        </ul>
        <a class="btn-outline btn-full plan-cta"
           href="/cadastro?plano=PRO"
           >Assinar plano gestão</a>
      </div>

      <!-- PLANO GESTÃO + ASSISTENTE -->
      <div class="plan-card plan-card-featured fade-up delay-2">
        <div class="plan-badge">Mais popular</div>
        <p class="plan-name">Gestão + Assistente</p>

        <div class="price-block" id="priceGA-monthly">
          <div class="plan-price"><span>R\$</span>197<span style="font-size:28px;vertical-align:baseline">,90</span></div>
          <p class="plan-period">por mês · cobrado mensalmente</p>
        </div>
        <div class="price-block hidden" id="priceGA-annual">
          <div class="plan-price"><span>R\$</span>179<span style="font-size:28px;vertical-align:baseline">,90</span></div>
          <p class="plan-period">por mês · cobrado anualmente</p>
        </div>

        <div class="plan-extra" id="extraGA-monthly">
          A partir do 3º barbeiro: <strong>+R\$ 33,90 por barbeiro/mês</strong>
        </div>
        <div class="plan-extra hidden" id="extraGA-annual">
          A partir do 3º barbeiro: <strong>+R\$ 29,90 por barbeiro/mês</strong>
        </div>

        <p class="plan-desc">O combo definitivo para quem quer delegar o atendimento e focar só no corte.</p>
        <ul class="plan-features">
          <li>Tudo do plano gestão</li>
          <li>Assistente de IA exclusivo no seu WhatsApp</li>
          <li>Atendimento humano e inteligente 24/7</li>
          <li>Agendamento 100% automatizado</li>
          <li>Venda ativa de produtos e planos pela IA</li>
          <li>Resposta instantânea (zero clientes perdidos)</li>
          <li>Lembretes e confirmações automáticas</li>
        </ul>
        <a class="btn-orange btn-full plan-cta"
           href="/cadastro?plano=ELITE"
           >Assinar gestão + assistente</a>
      </div>

    </div>
    <p class="plans-note fade-up delay-3">✨ <strong>Sem pegadinhas:</strong> Sem taxa de adesão. Sem contrato de fidelidade. Cancele quando quiser.</p>
  </div>
</section>

<!-- DEPOIMENTOS -->
<section class="section section-light">
  <div class="container">
    <div class="section-header fade-up" style="text-align:center">
      <span class="section-tag dark-tag" style="margin:0 auto 16px;display:inline-flex;">Depoimentos</span>
      <h2 class="section-title dark" style="font-size:clamp(26px,3.2vw,42px);letter-spacing:-1px;white-space:nowrap;">Quem já modernizou a barbearia</h2>
    </div>
    <div class="testi-grid">
      <div class="testi-card fade-up delay-1">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Antes eu perdia mensagens todo dia porque estava ocupado cortando cabelo. No primeiro mês com o Agente de IA, meu movimento aumentou 40%. A IA responde de imediato, agenda e ainda vendeu 12 planos mensais sozinha."</p>
        <div class="testi-author">
          <div class="testi-avatar">J</div>
          <div>
            <p class="testi-name">João Costa</p>
            <p class="testi-biz">LordofBarba</p>
          </div>
        </div>
      </div>
      <div class="testi-card fade-up delay-2">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Eu achava que sabia o meu faturamento, mas só descobri os verdadeiros números quando instalei o sistema. O fechamento de comissão dos meus 4 barbeiros, que antes demorava horas, agora é feito em dois cliques."</p>
        <div class="testi-author">
          <div class="testi-avatar">R</div>
          <div>
            <p class="testi-name">Rafael Souza</p>
            <p class="testi-biz">Old Style Barber</p>
          </div>
        </div>
      </div>
      <div class="testi-card fade-up delay-3">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"O melhor é a liberdade de desligar o celular no domingo. Voltei de um feriado prolongado e a IA tinha feito 12 novos agendamentos enquanto eu estava viajando. É um funcionário que trabalha 24h e não reclama."</p>
        <div class="testi-author">
          <div class="testi-avatar">F</div>
          <div>
            <p class="testi-name">Felipe Costa</p>
            <p class="testi-biz">Kings Barber Shop</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section id="faq" class="section section-light2">
  <div class="container">
    <div class="section-header fade-up" style="text-align:center">
      <span class="section-tag dark-tag" style="margin:0 auto 16px;display:inline-flex;">FAQ</span>
      <h2 class="section-title dark">Perguntas frequentes</h2>
    </div>
    <div class="faq-list">
      <div class="faq-item fade-up delay-1">
        <button class="faq-question">
          O Agente de IA é aquele chatbot de menu?
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>Não. Chatbots tradicionais seguem um roteiro engessado e travam se o cliente escreve algo diferente. Nosso Agente usa inteligência artificial avançada: ele interpreta o texto, entende o contexto da conversa, responde dúvidas sobre os serviços e toma decisões de agendamento como um atendente humano faria.</p>
        </div>
      </div>
      <div class="faq-item fade-up delay-2">
        <button class="faq-question">
          Preciso entender de tecnologia para usar?
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>De forma alguma. O sistema foi desenhado de barbeiro para barbeiro. A interface é extremamente intuitiva, a configuração inicial é guiada passo a passo e o nosso suporte humano ajuda você a deixar tudo pronto no mesmo dia.</p>
        </div>
      </div>
      <div class="faq-item fade-up delay-3">
        <button class="faq-question">
          Como a IA sabe se tenho horário livre?
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>Ela é totalmente integrada com a agenda do seu sistema. Quando o cliente solicita um atendimento pelo WhatsApp, a IA checa em milissegundos os horários disponíveis da equipe, sugere as opções para o cliente e, assim que ele escolhe, o horário é bloqueado automaticamente.</p>
        </div>
      </div>
      <div class="faq-item fade-up delay-1">
        <button class="faq-question">
          Existe fidelidade ou multa de cancelamento?
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>Não. O modelo é de assinatura mensal. Você usa enquanto fizer sentido para o seu negócio. Se decidir cancelar, não há multas, burocracias ou letras miúdas. Simples assim.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA FINAL -->
<section class="cta-final">
  <div class="cta-final-content">
    <p class="fade-up" style="font-size:13px;color:var(--orange);font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">Pronto para modernizar?</p>
    <h2 class="fade-up delay-1">Tenha uma gestão completa<br>e eficiente da sua barbearia.</h2>
    <p class="fade-up delay-2">Dê à sua barbearia a tecnologia que ela merece. Comece hoje mesmo e veja a diferença no primeiro mês.</p>
    <a href="/cadastro"  class="btn-orange fade-up delay-3" style="font-size:17px;padding:20px 48px;">👉 Quero modernizar minha barbearia</a>
    <div class="cta-trust fade-up delay-4">
      <span class="cta-trust-item">Sem taxa de adesão</span>
      <span class="cta-trust-item">Cancele quando quiser</span>
      <span class="cta-trust-item">Suporte humanizado de verdade</span>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="footer">
  <div class="footer-inner">
    <a href="#" class="footer-logo"><img src="IA de barbearia.png transparente.png" alt="IA de Barbearia"></a>
    <span class="footer-copy">© 2026 IA de Barbearia. Todos os direitos reservados.</span>
    <a href="#" class="footer-top">↑ Topo</a>
  </div>
</footer>



` }} />
    </div>
  );
}
