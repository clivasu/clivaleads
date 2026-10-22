import { SearchNormal1, Notification } from "iconsax-reactjs";
import { BookingNotifications } from "@/components/dashboard/booking-notifications";

export function Topbar() {
  return (
    <header className="flex items-center gap-4 px-3 py-3 md:pl-1 md:pr-4">
      <div className="relative flex-1 max-w-2xl">
        <SearchNormal1
          size={18}
          color="#94a3b8"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          placeholder="Buscar pacientes, profissionais, agendamentos..."
          className="h-11 w-full rounded-full border-0 bg-white pl-11 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
        >
          <Notification size={20} variant="Bulk" color="#475569" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <BookingNotifications />
      </div>
    </header>
  );
}
