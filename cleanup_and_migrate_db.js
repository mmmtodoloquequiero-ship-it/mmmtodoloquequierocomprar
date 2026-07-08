const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if(val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1);
    process.env[key] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required to manage auth users.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BROTHER_TENANT_ID = 'ebbe0ff5-b14b-46d2-955a-2d8e6cafc470'; // Local A - Belgrano
const NEW_EMAIL = 'juliocsa22.ja@gmail.com';
const NEW_PASSWORD = '22leon.juoli.2026';

async function run() {
  console.log('--- STARTING CLEANUP AND MIGRATION ---');

  // 1. DELETE UNUSED TENANTS (Local B, MMYM, juOli vieja)
  const tenantsToDelete = [
    '095d7efe-9602-45e9-b7ca-43833bbacf8b', // Local B
    'e271118a-0b2e-49f4-a780-168fe6064498', // juOli
    'dc657532-2d7c-4081-8a5d-c7870604f6e5'  // MMYM
  ];

  for (let id of tenantsToDelete) {
    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) {
      console.error(`Error deleting tenant ${id}:`, error);
    } else {
      console.log(`Deleted tenant: ${id}`);
    }
  }

  // 2. MIGRATE LOCAL A TO BROTHER'S EMAIL
  console.log(`Creating/Updating auth user for ${NEW_EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
      console.log('User already exists in Auth. Updating password...');
      const { data: users, error: getError } = await supabase.auth.admin.listUsers();
      if (!getError) {
        const user = users.users.find(u => u.email === NEW_EMAIL);
        if (user) {
          await supabase.auth.admin.updateUserById(user.id, { password: NEW_PASSWORD, email_confirm: true });
        }
      }
    } else {
      console.error('Error creating auth user:', authError);
    }
  } else {
    console.log('User created successfully:', authData.user.id);
  }

  console.log('Updating tenant record for Local A...');
  const { error: updateError } = await supabase
    .from('tenants')
    .update({ 
      email: NEW_EMAIL, 
      admin_password: NEW_PASSWORD // Backup retrocompatible
    })
    .eq('id', BROTHER_TENANT_ID);

  if (updateError) {
    console.error('Error updating tenant:', updateError);
  } else {
    console.log('Tenant updated successfully.');
  }

  // 3. SET PREMIUM PLAN FOR 0 ARS
  console.log('Configuring Premium plan (100% discount)...');
  
  // First, get the Premium plan ID
  const { data: planData } = await supabase.from('saas_plans').select('id').eq('name', 'Premium').single();
  
  if (planData) {
    // Check if a subscription exists
    const { data: existingSub } = await supabase.from('saas_subscriptions').select('id').eq('tenant_id', BROTHER_TENANT_ID).single();
    
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    if (existingSub) {
      const { error: subErr } = await supabase.from('saas_subscriptions').update({
        plan_id: planData.id,
        status: 'active',
        current_period_end: oneYearLater.toISOString()
      }).eq('id', existingSub.id);
      if (subErr) console.error('Error updating sub:', subErr);
      else console.log('Subscription updated to Premium.');
    } else {
      const { error: subErr } = await supabase.from('saas_subscriptions').insert({
        tenant_id: BROTHER_TENANT_ID,
        plan_id: planData.id,
        status: 'active',
        current_period_end: oneYearLater.toISOString()
      });
      if (subErr) console.error('Error creating sub:', subErr);
      else console.log('Subscription created as Premium.');
    }
  } else {
    console.error('Premium plan not found in database.');
  }

  console.log('--- CLEANUP AND MIGRATION COMPLETE ---');
}

run();
