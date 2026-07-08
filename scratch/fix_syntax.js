const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// The syntax error is at line 4346
// We will look for </div>\n)}\n</div> starting from line 4330
const errorLineIdx = 4345; // 0-indexed line 4346
if (lines[errorLineIdx].includes("</div>") && lines[errorLineIdx+1].includes(")}") && lines[errorLineIdx+2].includes("</div>")) {
    lines.splice(errorLineIdx, 3);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log("Fixed the syntax error at line " + (errorLineIdx + 1));
} else {
    // maybe there's an empty line before it
    const realErrorIdx = lines.findIndex((l, i) => i > 4340 && i < 4360 && l.includes("</div>") && lines[i+1] && lines[i+1].includes(")}") && lines[i+2] && lines[i+2].includes("</div>"));
    if (realErrorIdx !== -1) {
        lines.splice(realErrorIdx, 3);
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log("Fixed the syntax error at line " + (realErrorIdx + 1));
    } else {
        console.log("Could not find the exact lines.");
    }
}
