import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentOrg } from "@/lib/data/org";
import { isSupabaseConfigured } from "@/lib/env";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { BillingCard } from "@/components/billing/billing-card";
import { ProfileForm } from "@/components/settings/profile-form";
import { createClient } from "@/lib/supabase/server";
import { getBillingState, getUsage } from "@/lib/data/billing";
import { getBookingSettings } from "@/lib/data/booking";
import { BookingSettingsForm, type ProcedureRow } from "@/components/settings/booking-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const h = await headers();
  const host = h.get("host") ?? "prelead.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const billing = await getBillingState(org.id);
  const { data: { user } } = isSupabaseConfigured ? await (await createClient()).auth.getUser() : { data: { user: null } };
  const usage = billing.enabled ? await getUsage(org.id) : null;
  const booking = await getBookingSettings(org.id);
  let procedures: ProcedureRow[] = [];
  if (isSupabaseConfigured) {
    const { data } = await (await createClient()).from("schedule_procedures").select("name, duration_min, price_cents").eq("organization_id", org.id).order("name");
    procedures = ((data ?? []) as ProcedureRow[]).map((p) => ({ name: p.name, duration_min: p.duration_min ?? 60, price_cents: p.price_cents ?? null }));
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Identidade, identificador público, agendamento online e white-label da clínica.</p>
      </header>

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Conecte o Supabase para editar e salvar os dados da clínica.
        </p>
      ) : (
        <>
          {billing.enabled && usage && (
            <BillingCard
              plan={billing.plan}
              status={billing.billing?.status ?? null}
              trialEndsAt={billing.billing?.trial_ends_at ?? null}
              periodEnd={billing.billing?.current_period_end ?? null}
              cancelAtPeriodEnd={Boolean(billing.billing?.cancel_at_period_end)}
              hasCustomer={Boolean(billing.billing?.stripe_customer_id)}
              usage={usage}
            />
          )}
          {user && (
            <ProfileForm
              name={(user.user_metadata?.full_name as string | undefined) ?? ""}
              avatarUrl={(user.user_metadata?.avatar_url as string | undefined) || null}
              email={user.email ?? ""}
            />
          )}
          <OrgSettingsForm org={org} baseUrl={baseUrl} />
          <BookingSettingsForm initial={booking.settings} procedures={procedures} available={booking.available} />
          <ChangePasswordForm />
        </>
      )}
    </div>
  );
}
