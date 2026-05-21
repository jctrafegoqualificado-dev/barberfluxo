const fs = require('fs');

let content = fs.readFileSync('c:\\Users\\NeoMissio\\Documents\\barberapp-master\\src\\app\\page.tsx', 'utf8');

// 1. Nav CTA: Change to go to /login and add an explicit "Entrar" link next to it
content = content.replace(
  /<a href="https:\/\/wa\.me\/5541955442055" target="_blank" rel="noopener" class="nav-cta">Começar agora<\/a>/g,
  '<a href="/login" class="nav-links" style="font-size: 14px; font-weight: 600; margin-right: 15px; color: var(--dark);">Entrar</a><a href="/login" class="nav-cta">Começar agora</a>'
);

// 2. Mobile CTA
content = content.replace(
  /<a href="https:\/\/wa\.me\/5541955442055" target="_blank" rel="noopener" class="mobile-cta">Começar agora →<\/a>/g,
  '<a href="/login" class="mobile-cta">Entrar na conta</a><a href="/login" class="mobile-cta" style="color: var(--orange);">Começar agora →</a>'
);

// 3. Replace ALL other WhatsApp links with /login
content = content.replace(/href="https:\/\/wa\.me\/[^"]*"/g, 'href="/login"');

// 4. Remove target="_blank" and rel="noopener" from these buttons so they open in the same tab
content = content.replace(/target="_blank" rel="noopener"/g, '');

// 5. Remove data-monthly and data-annual attributes from plan buttons so the JS doesn't overwrite the /login link
content = content.replace(/data-monthly="[^"]*"/g, '');
content = content.replace(/data-annual="[^"]*"/g, '');

// Also remove the JS toggle logic that overwrites the plan-cta links
content = content.replace(
  /document\.querySelectorAll\('\.plan-cta'\)\.forEach\(cta => \{\s*cta\.href = annual \? cta\.dataset\.annual : cta\.dataset\.monthly;\s*\}\);/g,
  '// Link update removed since they now point to /login'
);

fs.writeFileSync('c:\\Users\\NeoMissio\\Documents\\barberapp-master\\src\\app\\page.tsx', content, 'utf8');
console.log("Links replaced successfully.");
