#!/usr/bin/env tsx
/**
 * One-shot script to promote a Supabase user to admin role via app_metadata.
 * Must be run after applying migration 20260417000001_harden_rls_policies.sql,
 * which removes the user_metadata branch from is_admin() — without this,
 * no authenticated user can access the backoffice.
 *
 * Usage: npx tsx scripts/promote-admin.ts <email>
 */
import { createAdminClient } from "../src/lib/supabase/admin";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

const supabase = createAdminClient();

const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Error listing users:", listError.message);
  process.exit(1);
}

const user = users.find((u) => u.email === email);
if (!user) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { role: "admin" },
});

if (error) {
  console.error("Error promoting user:", error.message);
  process.exit(1);
}

console.log(`✓ ${email} (${user.id}) promoted to admin via app_metadata`);
