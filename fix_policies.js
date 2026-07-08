const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'database_schema.sql');
let content = fs.readFileSync(filepath, 'utf8');

// Regex to find CREATE POLICY "name" ON public.table
const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.([a-zA-Z0-9_]+)/g;

content = content.replace(policyRegex, (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS "${policyName}" ON public.${tableName};\n${match}`;
});

fs.writeFileSync(filepath, content);
console.log('Fixed policies in database_schema.sql');
