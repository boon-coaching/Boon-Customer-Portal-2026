// Run with: node scripts/update-user-metadata.js
// Requires: SUPABASE_SERVICE_ROLE_KEY env var

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jbmhvqbwfhvldrfgjqjp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/update-user-metadata.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function updateUserMetadata() {
  const targetEmail = 'jay.kantar@mediaartslab.com';

  // First get the user's UUID
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError);
    process.exit(1);
  }

  const user = users.find(u => u.email === targetEmail);

  if (!user) {
    console.error(`User not found: ${targetEmail}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id}`);
  console.log('Current app_metadata:', user.app_metadata);

  // Update the user's metadata
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      role: "customer",
      company: "Media Arts Lab",
      company_id: "0f0e4325-db49-4daf-8f75-519f55cfba38",
      provider: "email",
      providers: ["email"],
      program_type: "Scale"
    }
  });

  if (error) {
    console.error('Error updating user:', error);
    process.exit(1);
  }

  console.log('Successfully updated user metadata!');
  console.log('New app_metadata:', data.user.app_metadata);
  console.log('\nHave the user log out and back in to pick up the changes.');
}

updateUserMetadata();
