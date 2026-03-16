import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import MobileLayout from "@/components/backoffice/mobile-layout";

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <MobileLayout email={user?.email ?? ""} logoutAction={logout}>
      {children}
    </MobileLayout>
  );
}
