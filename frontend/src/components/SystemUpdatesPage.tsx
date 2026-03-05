import { SYSTEM_UPDATES } from "@/lib/systemUpdates";

const SystemUpdatesPage = () => {
  return (
    <div className="system-updates-page space-y-6">

      {/* HEADER */}
      <section className="updates-hero overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm
                          dark:border-slate-700 dark:bg-slate-900 dark:bg-none">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 
                      dark:text-sky-300">
          Info Pengembangan
        </p>

        <h1 className="mt-2 text-2xl font-semibold text-slate-900 
                       dark:text-white">
          Update Sistem / Revisi
        </h1>

        <p
          className="mt-2 max-w-3xl text-sm text-slate-700 
                     dark:text-slate-300"
          style={{ textAlign: "justify" }}
        >
          Halaman ini berisi riwayat pembaruan sistem agar pembimbing skripsi bisa
          tracking perubahan terbaru. Setiap update mencantumkan versi,
          tanggal, dan detail revisi.
        </p>
      </section>

      {/* UPDATE LIST */}
      <section className="space-y-4">
        {SYSTEM_UPDATES.map((item) => (
          <article
            key={`${item.version}-${item.date}`}
            className="updates-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm
                       dark:border-slate-600 dark:bg-slate-800 dark:shadow-slate-950/40"
          >
            {/* VERSION BADGE */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border border-emerald-200 bg-emerald-50 
                           px-2.5 py-1 text-xs font-semibold text-emerald-700
                           dark:border-emerald-800 dark:bg-emerald-900/30 
                           dark:text-emerald-300"
              >
                Versi {item.version}
              </span>

              <span
                className="rounded-full border border-slate-200 bg-slate-50 
                           px-2.5 py-1 text-xs font-medium text-slate-600
                           dark:border-slate-600 dark:bg-slate-800 
                           dark:text-slate-300"
              >
                {item.date}
              </span>
            </div>

            {/* TITLE */}
            <h2 className="mt-3 text-lg font-semibold text-slate-900 
                           dark:text-white">
              {item.title}
            </h2>

            {/* MAJOR & MINOR GRID */}
            <div className="mt-3 grid gap-4 lg:grid-cols-2">

              {/* MAJOR UPDATE */}
              <section
                className="updates-major rounded-xl border border-rose-200 bg-rose-50 p-3
                           dark:border-rose-700/80 dark:bg-slate-900/40"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[0.16em] 
                             text-rose-700 dark:text-rose-300"
                >
                  Major Update
                </p>

                <ul
                  className="mt-2 list-disc space-y-1.5 pl-5 text-sm 
                             text-slate-700 dark:text-slate-100
                             marker:text-rose-500 dark:marker:text-rose-300"
                >
                  {item.majorUpdates.map((detail) => (
                    <li key={`major-${detail}`} style={{ textAlign: "justify" }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              </section>

              {/* MINOR UPDATE */}
              <section
                className="updates-minor rounded-xl border border-sky-200 bg-sky-50 p-3
                           dark:border-sky-700/80 dark:bg-slate-900/40"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[0.16em] 
                             text-sky-700 dark:text-sky-300"
                >
                  Minor Update
                </p>

                <ul
                  className="mt-2 list-disc space-y-1.5 pl-5 text-sm 
                             text-slate-700 dark:text-slate-100
                             marker:text-sky-500 dark:marker:text-sky-300"
                >
                  {item.minorUpdates.map((detail) => (
                    <li key={`minor-${detail}`} style={{ textAlign: "justify" }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              </section>

            </div>
          </article>
        ))}
      </section>

    </div>
  );
};

export default SystemUpdatesPage;
