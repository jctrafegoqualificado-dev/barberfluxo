const fs = require('fs');

const htmlPath = 'C:\\Users\\NeoMissio\\Downloads\\IA de Barbearia - LP\\06 - IA de Barbearia\\index.html';
const outPath = 'c:\\Users\\NeoMissio\\Documents\\barberapp-master\\src\\app\\page.tsx';

let html = fs.readFileSync(htmlPath, 'utf8');

const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) {
  console.error("Body not found");
  process.exit(1);
}
let body = bodyMatch[1];

// Remove script tags from body to execute them manually in useEffect
body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const style = styleMatch ? styleMatch[1] : '';

// Escapar crases e contra-barras para usar em template string
const safeBody = body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
const safeStyle = style.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const jsx = `// @ts-nocheck
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
        document.querySelectorAll('.plan-cta').forEach(cta => {
          cta.href = annual ? cta.dataset.annual : cta.dataset.monthly;
        });
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
      <style dangerouslySetInnerHTML={{ __html: \`${safeStyle}\` }} />
      <div dangerouslySetInnerHTML={{ __html: \`${safeBody}\` }} />
    </div>
  );
}
`;

fs.writeFileSync(outPath, jsx, 'utf8');
console.log("Conversion complete.");
