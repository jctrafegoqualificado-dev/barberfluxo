import re
import os

with open(r'C:\Users\NeoMissio\Downloads\IA de Barbearia - LP\06 - IA de Barbearia\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract body
body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
if not body_match:
    print("Body not found")
    exit(1)
body = body_match.group(1)

# Remove script tags from body
body = re.sub(r'<script.*?</script>', '', body, flags=re.DOTALL | re.IGNORECASE)

# Extract styles
style_match = re.search(r'<style[^>]*>(.*?)</style>', html, re.DOTALL | re.IGNORECASE)
style = style_match.group(1) if style_match else ""

# Replace class with className
body = body.replace('class="', 'className="')
# Replace for with htmlFor
body = body.replace('for="', 'htmlFor="')
# Self-close img tags
body = re.sub(r'(<img[^>]+)(?<!/)>', r'\1 />', body)
# Self-close input tags
body = re.sub(r'(<input[^>]+)(?<!/)>', r'\1 />', body)
# Replace style strings with style objects (basic heuristic for inline styles, only few exist)
body = re.sub(r'style="max-width:([^;]+);margin-top:([^;]+);?"', r'style={{ maxWidth: "\1", marginTop: "\2" }}', body)
body = re.sub(r'style="color:([^;]+);?"', r'style={{ color: "\1" }}', body)
body = re.sub(r'style="margin-bottom:([^;]+);?"', r'style={{ marginBottom: "\1" }}', body)
body = re.sub(r'style="text-align:([^;]+);?"', r'style={{ textAlign: "\1" }}', body)
body = re.sub(r'style="margin:([^;]+);display:([^;]+);?"', r'style={{ margin: "\1", display: "\2" }}', body)
body = re.sub(r'style="font-size:([^;]+);letter-spacing:([^;]+);white-space:([^;]+);?"', r'style={{ fontSize: "\1", letterSpacing: "\2", whiteSpace: "\3" }}', body)
body = re.sub(r'style="font-size:([^;]+);vertical-align:([^;]+);?"', r'style={{ fontSize: "\1", verticalAlign: "\2" }}', body)
body = re.sub(r'style="font-size:([^;]+);color:([^;]+);font-weight:([^;]+);letter-spacing:([^;]+);text-transform:([^;]+);margin-bottom:([^;]+);?"', r'style={{ fontSize: "\1", color: "\2", fontWeight: "\3", letterSpacing: "\4", textTransform: "\5", marginBottom: "\6" }}', body)
body = re.sub(r'style="font-size:([^;]+);padding:([^;]+);?"', r'style={{ fontSize: "\1", padding: "\2" }}', body)
body = re.sub(r'style="([^"]*)"', r'', body) # Strip any remaining inline styles just in case to avoid compile errors

jsx = f"""// @ts-nocheck
"use client";
import React, {{ useEffect }} from "react";
import Head from "next/head";

export default function LandingPage() {{
  useEffect(() => {{
    // Billing toggle mensal/anual
    const btn = document.getElementById('billingToggle');
    const optM = document.getElementById('optMonthly');
    const optA = document.getElementById('optAnnual');
    const monthlyBlocks = ['priceG-monthly','priceGA-monthly','extraGA-monthly'];
    const annualBlocks  = ['priceG-annual', 'priceGA-annual', 'extraGA-annual'];
    let annual = false;

    if (btn) {{
      const toggleHandler = () => {{
        annual = !annual;
        btn.classList.toggle('annual', annual);
        if (optM) optM.classList.toggle('active', !annual);
        if (optA) optA.classList.toggle('active', annual);
        monthlyBlocks.forEach(id => {{ const el = document.getElementById(id); if(el) el.classList.toggle('hidden', annual); }});
        annualBlocks.forEach(id  => {{ const el = document.getElementById(id);  if(el) el.classList.toggle('hidden', !annual); }});
        document.querySelectorAll('.plan-cta').forEach(cta => {{
          cta.href = annual ? cta.dataset.annual : cta.dataset.monthly;
        }});
      }};
      btn.addEventListener('click', toggleHandler);
    }}

    // Nav hamburger
    const hamburger = document.getElementById('hamburger');
    const navMobile = document.getElementById('navMobile');
    if (hamburger && navMobile) {{
      hamburger.addEventListener('click', () => {{
        hamburger.classList.toggle('open');
        navMobile.classList.toggle('open');
      }});
      navMobile.querySelectorAll('a').forEach(a => {{
        a.addEventListener('click', () => {{
          hamburger.classList.remove('open');
          navMobile.classList.remove('open');
        }});
      }});
    }}

    // FAQ accordion
    document.querySelectorAll('.faq-question').forEach(btn => {{
      btn.addEventListener('click', () => {{
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      }});
    }});

    // Scroll animations
    const observer = new IntersectionObserver((entries) => {{
      entries.forEach(e => {{ if (e.isIntersecting) e.target.classList.add('visible'); }});
    }}, {{ threshold: 0.12 }});
    document.querySelectorAll('.fade-up, .fade-left, .fade-right').forEach(el => observer.observe(el));

    // Carrossel automtico do browser mockup
    const panels = document.querySelectorAll('.browser-panel');
    const dots = document.querySelectorAll('.carousel-dot');
    const urlBar = document.getElementById('carouselUrl');
    let current = 0;
    let timer;

    function goTo(idx) {{
      if(panels.length === 0) return;
      panels[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = idx;
      panels[current].classList.add('active');
      dots[current].classList.add('active');
      if (urlBar) urlBar.textContent = panels[current].dataset.url || '';
    }}

    function next() {{ goTo((current + 1) % panels.length); }}
    function startTimer() {{ timer = setInterval(next, 3200); }}
    function resetTimer() {{ clearInterval(timer); startTimer(); }}

    dots.forEach(dot => {{
      dot.addEventListener('click', () => {{ goTo(parseInt(dot.dataset.idx)); resetTimer(); }});
    }});

    if(panels.length > 0) startTimer();

    // WhatsApp animation ?" HERO
    let heroTimer;
    function runHeroWAAnimation() {{
      const heroSteps = [
        {{ show: 'hwm1', delay: 600 }},
        {{ show: 'hwt1', delay: 1200 }},
        {{ hide: 'hwt1', show: 'hwm2', delay: 2200 }},
        {{ show: 'hwm3', delay: 3200 }},
        {{ show: 'hwt2', delay: 3900 }},
        {{ hide: 'hwt2', show: 'hwm4', delay: 5000 }},
        {{ show: 'hwm5', delay: 6200 }},
        {{ show: 'hwt3', delay: 6900 }},
        {{ hide: 'hwt3', show: 'hwm6', delay: 8000 }},
      ];
      ['hwm1','hwm2','hwm3','hwm4','hwm5','hwm6','hwt1','hwt2','hwt3'].forEach(id => {{
        const el = document.getElementById(id); if(el) el.classList.remove('show');
      }});
      heroSteps.forEach(step => {{
        setTimeout(() => {{
          if (step.hide) {{ const el = document.getElementById(step.hide); if(el) el.classList.remove('show'); }}
          if (step.show) {{ const el = document.getElementById(step.show); if(el) el.classList.add('show'); }}
        }}, step.delay);
      }});
      heroTimer = setTimeout(runHeroWAAnimation, 10500);
    }}
    runHeroWAAnimation();

    // WhatsApp chat animation ?" AGENT
    let agentTimer;
    function runWAAnimation() {{
      const steps = [
        {{ show: 'wm1', delay: 400 }},
        {{ show: 'wt1', delay: 900 }},
        {{ hide: 'wt1', show: 'wm2', delay: 1800 }},
        {{ show: 'wm3', delay: 2800 }},
        {{ show: 'wt2', delay: 3400 }},
        {{ hide: 'wt2', show: 'wm4', delay: 4600 }},
        {{ show: 'wm5', delay: 5800 }},
        {{ show: 'wt3', delay: 6400 }},
        {{ hide: 'wt3', show: 'wm6', delay: 7600 }},
      ];
      ['wm1','wm2','wm3','wm4','wm5','wm6','wt1','wt2','wt3'].forEach(id => {{
        const el = document.getElementById(id);
        if(el) el.classList.remove('show');
      }});
      steps.forEach(step => {{
        setTimeout(() => {{
          if (step.hide) {{ const el = document.getElementById(step.hide); if(el) el.classList.remove('show'); }}
          if (step.show) {{ const el = document.getElementById(step.show); if(el) el.classList.add('show'); }}
        }}, step.delay);
      }});
      agentTimer = setTimeout(runWAAnimation, 10500);
    }}

    const phoneObs = new IntersectionObserver((entries) => {{
      if (entries[0].isIntersecting) {{
        phoneObs.disconnect();
        runWAAnimation();
      }}
    }}, {{ threshold: 0.3 }});
    const phoneSect = document.getElementById('agente');
    if (phoneSect) phoneObs.observe(phoneSect);

    return () => {{
       clearInterval(timer);
       clearTimeout(heroTimer);
       clearTimeout(agentTimer);
       observer.disconnect();
       phoneObs.disconnect();
    }}
  }}, []);

  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <style dangerouslySetInnerHTML={{{{ __html: `{style}` }}}} />
      {body}
    </>
  );
}}
"""

with open(r'c:\Users\NeoMissio\Documents\barberapp-master\src\app\page.tsx', 'w', encoding='utf-8') as f:
    f.write(jsx)

print("Conversion successful.")
