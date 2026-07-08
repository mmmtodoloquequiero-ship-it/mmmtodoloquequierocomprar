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
        const { data, error } = await supabase.from('tenants').select('*');
        if (error) {
            console.error('Error fetching tenants:', error);
            return;
        }
        console.log('ACTIVE TENANTS:');
        data.forEach(tenant => {
            console.log(`- ID: ${tenant.id}, Slug: "${tenant.slug}", Name: "${tenant.name}", Tables:`, tenant.tables);
        });
    } catch (e) {
        console.error('Crash:', e);
    }
}

run();
