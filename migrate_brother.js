const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
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

const BROTHER_TENANT_ID = 'e271118a-0b2e-49f4-a780-168fe6064498'; // juoli
const NEW_EMAIL = 'juliocsa22.ja@gmail.com';
const NEW_PASSWORD = '22leon.juoli.2026';

async function migrateBrother() {
  console.log('--- MIGRATION START ---');
  
  // 1. Create Auth User
  console.log(`Creating auth user for ${NEW_EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true // bypass email confirmation for now
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
      return;
    }
  } else {
    console.log('User created successfully:', authData.user.id);
  }

  // 2. Update Tenant record
  console.log('Updating tenant record...');
  const { error: updateError } = await supabase
    .from('tenants')
    .update({ 
      email: NEW_EMAIL, 
      admin_password: NEW_PASSWORD // We still keep it for backward compatibility for a moment, but eventually remove it
    })
    .eq('id', BROTHER_TENANT_ID);

  if (updateError) {
    console.error('Error updating tenant:', updateError);
    return;
  }
  console.log('Tenant updated successfully.');

  // 3. We run the employee migration manually via JS logic since running SQL directly isn't supported via JS client without RPC
  console.log('Migrating employees (Orphan Data)...');
  const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', BROTHER_TENANT_ID).single();
  
  if (tenantData) {
    // Check if employees exist
    const { data: existingEmps } = await supabase.from('employees').select('id').eq('tenant_id', BROTHER_TENANT_ID);
    if (!existingEmps || existingEmps.length === 0) {
      const newEmployees = [];
      if (tenantData.staff_password) newEmployees.push({ tenant_id: BROTHER_TENANT_ID, name: 'Staff / Caja', role: 'staff', pin_code: tenantData.staff_password });
      if (tenantData.kitchen_password) newEmployees.push({ tenant_id: BROTHER_TENANT_ID, name: 'Cocina', role: 'kitchen', pin_code: tenantData.kitchen_password });
      if (tenantData.bartender_password) newEmployees.push({ tenant_id: BROTHER_TENANT_ID, name: 'Barra', role: 'bartender', pin_code: tenantData.bartender_password });
      if (tenantData.waiter_password) newEmployees.push({ tenant_id: BROTHER_TENANT_ID, name: 'Mozo Principal', role: 'waiter', pin_code: tenantData.waiter_password });
      if (tenantData.delivery_password) newEmployees.push({ tenant_id: BROTHER_TENANT_ID, name: 'Delivery', role: 'delivery', pin_code: tenantData.delivery_password });

      if (newEmployees.length > 0) {
        const { error: insertError } = await supabase.from('employees').insert(newEmployees);
        if (insertError) {
          console.error('Error inserting employees:', insertError);
        } else {
          console.log(`Inserted ${newEmployees.length} employees successfully.`);
        }
      } else {
         console.log('No passwords found to migrate for employees.');
      }
    } else {
      console.log('Employees already exist for this tenant. Skipping employee migration.');
    }
  }

  console.log('--- MIGRATION COMPLETE ---');
}

migrateBrother();
