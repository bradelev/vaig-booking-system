-- Permissive RLS policies for authenticated backoffice users

CREATE POLICY "authenticated_all_clients"
  ON clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_professionals"
  ON professionals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_services"
  ON services FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_bookings"
  ON bookings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_payments"
  ON payments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
