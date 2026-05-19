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

  // Count conversations (not messages) with unread messages to match the inbox "Sin leer (N)" filter.
  const { data: convs } = await (supabase as AnyClient)
    .from("inbox_conversations")
    .select("phone, unread_count");
  const count = (convs ?? []).filter(
    (c: { unread_count: number }) => c.unread_count > 0
  ).length;

  return (
    <MobileLayout email={user?.email ?? ""} logoutAction={logout} inboxUnreadCount={count}>
      {children}
    </MobileLayout>
  );
}
