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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const BROTHER_TENANT_ID = 'ebbe0ff5-b14b-46d2-955a-2d8e6cafc470';
  const { data: planData } = await supabase.from('saas_plans').select('id').eq('name', 'Pro Ilimitado').single();
  
  if (planData) {
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const { data: existingSub } = await supabase.from('saas_subscriptions').select('id').eq('tenant_id', BROTHER_TENANT_ID).single();
    if (existingSub) {
      await supabase.from('saas_subscriptions').update({
        plan_id: planData.id,
        status: 'active',
        current_period_end: oneYearLater.toISOString()
      }).eq('id', existingSub.id);
      console.log('Subscription updated to Pro Ilimitado (100% discount, 1 year).');
    } else {
      await supabase.from('saas_subscriptions').insert({
        tenant_id: BROTHER_TENANT_ID,
        plan_id: planData.id,
        status: 'active',
        current_period_end: oneYearLater.toISOString()
      });
      console.log('Subscription created as Pro Ilimitado (100% discount, 1 year).');
    }
  }
}
run();
