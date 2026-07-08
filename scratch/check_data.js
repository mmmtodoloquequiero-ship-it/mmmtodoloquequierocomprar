const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        const tenantId = 'e271118a-0b2e-49f4-a780-168fe6064498'; // juoli
        const { data: catData, error: catError } = await supabase.from('categories').select('*').eq('tenant_id', tenantId);
        const { data: prodData, error: prodError } = await supabase.from('products').select('*').eq('tenant_id', tenantId);
        
        console.log('CATEGORIES:', catData ? catData.length : 0);
        if (catData) catData.forEach(c => console.log(`- ${c.name} (${c.id})`));
        
        console.log('PRODUCTS:', prodData ? prodData.length : 0);
        if (prodData) prodData.forEach(p => console.log(`- ${p.name} (${p.id})`));
    } catch (e) {
        console.error('Crash:', e);
    }
}

run();
