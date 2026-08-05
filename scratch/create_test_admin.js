const { createClient } = require('@supabase/supabase-js');
const url = 'https://vmutnulepjiwthnjlswi.supabase.co';
const key = 'sb_publishable_4GdHJ7EwCF8IteKuQzxspA_itBQacwD';
const db = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function run() {
  const email = 'testadmin@example.com';
  const password = 'password123';
  
  console.log(`Attempting to sign in or register ${email}...`);
  
  let sessionUser = null;
  
  // 1. Try to log in first
  const { data: signInData, error: signInErr } = await db.auth.signInWithPassword({ email, password });
  if (!signInErr && signInData.user) {
    console.log("Logged in successfully!");
    sessionUser = signInData.user;
  } else {
    console.log("Sign in failed (expected if not registered), attempting registration...");
    // 2. Register
    const { data: signUpData, error: signUpErr } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: 'Test Admin User',
          role: 'staff'
        }
      }
    });
    
    if (signUpErr) {
      console.error("Sign up failed:", signUpErr);
      return;
    }
    
    console.log("Registration successful! Session user ID:", signUpData.user.id);
    sessionUser = signUpData.user;
    
    // Use the session from signup
    if (signUpData.session) {
      db.auth.setSession(signUpData.session);
    }
  }
  
  if (!sessionUser) {
    console.error("No authenticated user session.");
    return;
  }
  
  // Sign in to get clean session
  const { data: authClientData, error: authErr } = await db.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("Could not obtain auth session for promotion client:", authErr);
    return;
  }

  const authClient = createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
  await authClient.auth.setSession(authClientData.session);
  
  console.log("Promoting profile role to 'admin'...");
  const { data: updateData, error: updateErr } = await authClient
    .from('profiles')
    .update({ role: 'admin', is_active: true })
    .eq('id', sessionUser.id)
    .select();
    
  if (updateErr) {
    console.error("Promotion failed:", updateErr);
    return;
  }
  
  console.log("Success! Profile updated:", updateData);
}

run();
