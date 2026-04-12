export default function Loading() {
  return (
    <div className="space-y-6 pb-20 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_24rem]">
        <div className="hero-gradient overflow-hidden rounded-[2rem] border border-white/10 px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11 dark:border-white/6">
          <div className="space-y-5 animate-pulse">
            <div className="h-6 w-36 rounded-full bg-white/20 dark:bg-white/10" />
            <div className="h-14 max-w-3xl rounded-[1.2rem] bg-white/20 dark:bg-white/10 sm:h-20" />
            <div className="h-5 max-w-2xl rounded-full bg-white/16 dark:bg-white/8" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-[1.35rem] border border-white/10 bg-white/[0.08] dark:border-white/6 dark:bg-white/[0.04]"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.08] p-5 dark:border-white/6 dark:bg-white/[0.04]">
          <div className="space-y-4 animate-pulse">
            <div className="h-5 w-28 rounded-full bg-white/20 dark:bg-white/10" />
            <div className="h-8 w-44 rounded-full bg-white/16 dark:bg-white/8" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 rounded-[1.15rem] border border-white/10 bg-white/[0.05] dark:border-white/6 dark:bg-white/[0.03]"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.08] dark:border-white/6 dark:bg-white/[0.04]"
          />
        ))}
      </section>
    </div>
  );
}