import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import MobileLayout from "@/components/backoffice/mobile-layout";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch inbox unread count for sidebar badge
  const { count } = await (supabase as AnyClient)
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .is("admin_read_at", null);

  return (
    <MobileLayout email={user?.email ?? ""} logoutAction={logout} inboxUnreadCount={count ?? 0}>
      {children}
    </MobileLayout>
  );
}
