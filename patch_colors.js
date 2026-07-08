const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            if (content.includes('orange-')) {
                content = content.replace(/orange-/g, 'amber-');
                modified = true;
            }
            if (content.includes('Todo lo que quiero comer')) {
                content = content.replace(/Todo lo que quiero comer/g, 'Todo lo que quiero comprar');
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}
replaceInDir(path.join(__dirname, 'src'));
console.log("Terminado.");
