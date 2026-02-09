const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const targetEmail = process.argv[2];
const companyId = process.argv[3];

if (!targetEmail || !companyId) {
  console.error('Usage: node update-user-metadata.js <email> <company_id>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateUserMetadata() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) { console.error('Error listing users:', listError); process.exit(1); }

  const user = users.find(u => u.email === targetEmail);
  if (!user) { console.error(`User not found: ${targetEmail}`); process.exit(1); }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { company_id: companyId }
  });

  if (error) { console.error('Error updating metadata:', error); process.exit(1); }
  console.log(`Successfully updated metadata for ${targetEmail}`);
}

updateUserMetadata();
