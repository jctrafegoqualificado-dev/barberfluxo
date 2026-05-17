const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/NeoMissio/Documents/barberapp-master/src';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replacements
    const replacements = [
        { from: /amber-500/g, to: 'primary' },
        { from: /amber-600/g, to: 'primary/90' },
        { from: /amber-400/g, to: 'primary/80' },
        { from: /amber-50/g, to: 'primary/10' },
        { from: /amber-100/g, to: 'primary/20' },
    ];

    replacements.forEach(r => {
        if (r.from.test(content)) {
            content = content.replace(r.from, r.to);
            changed = true;
        }
    });

    if (changed) {
        console.log(`Updated: ${file}`);
        fs.writeFileSync(file, content, 'utf8');
    }
});
