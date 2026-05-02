const flow = [
  "Ο πελάτης πατά SOS και στέλνει GPS + όχημα.",
  "Το σύστημα βρίσκει διαθέσιμους συνεργάτες μέσα στην ακτίνα.",
  "Ο πιο κοντινός αποδέχεται και ο πελάτης βλέπει ETA.",
  "Ο τεχνικός πηγαίνει με σωστή μπαταρία ή λάστιχο.",
  "Η εργασία ολοκληρώνεται, πληρώνεται και γράφεται service record στο Thronos.",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-purple-300">24/7 Dispatch MVP</p>
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Battery SOS + Thronos</h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">
          Πλατφόρμα οδικής βοήθειας για μπαταρίες και λάστιχα: GPS, αυτόματη ανάθεση, live ETA,
          πληρωμή και blockchain service book.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {flow.map((item, index) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 font-bold">
              {index + 1}
            </div>
            <p className="text-sm text-slate-200">{item}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
