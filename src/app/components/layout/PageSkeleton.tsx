import { Skeleton } from '@/app/components/ui/skeleton';

export function PublicPageSkeleton() {
  return (
    <div className="min-h-[70vh] bg-white" aria-hidden="true">
      <section className="relative flex min-h-[calc(100vh-150px)] items-start overflow-hidden rounded-t-[22px] border-t-4 border-[#2d96d8] bg-gradient-to-b from-[#c7dbea] via-[#bdd4e6] to-[#b4cde0] pt-3 pb-6 sm:min-h-[calc(100vh-120px)] lg:pb-7">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 overflow-hidden opacity-[0.035]">
            <div className="absolute top-[14%] left-0 whitespace-nowrap text-[100px] font-black tracking-[0.2em] text-[#0a1247]">
              TRANSLATION * APOSTILLE * ATTESTATION * CERTIFIED *
            </div>
            <div className="absolute top-[62%] right-0 whitespace-nowrap text-[90px] font-black tracking-[0.18em] text-[#0a1247]">
              GLOBAL * TRUSTED * LEGAL * PROFESSIONAL *
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1500px] px-3 sm:px-4 lg:px-6">
          <div className="mx-auto flex max-w-[1160px] flex-col items-center text-center">
            <div className="mb-2 flex w-full flex-col items-center space-y-3 lg:mb-4">
              <Skeleton className="h-11 w-[530px] max-w-[86vw] rounded-md bg-white/58" />
              <Skeleton className="h-8 w-[940px] max-w-[92vw] rounded-md bg-white/52" />
              <Skeleton className="h-[3px] w-[175px] rounded-full bg-[#0a1247]/45" />
              <Skeleton className="h-6 w-[760px] max-w-[88vw] rounded-md bg-white/45" />
            </div>

            <div className="relative mt-1 w-full sm:mt-2 lg:mt-2.5">
              <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-r from-white/50 via-[#cce2f2]/30 to-white/50 blur-xl" />
              <div className="relative mx-auto flex max-w-[96vw] items-stretch justify-between gap-2.5 sm:max-w-[90vw] lg:max-w-[90vw] lg:gap-3.5">
                <div className="relative min-w-0 flex-1 aspect-[3/4] overflow-hidden rounded-2xl border-[2.5px] border-[#6f88a3] bg-white/70 shadow-lg">
                  <Skeleton className="h-full w-full rounded-none bg-white/58" />
                  <Skeleton className="absolute left-[1%] top-[1%] h-[9.5%] w-[20%] rounded-md bg-white/80" />
                  <Skeleton className="absolute left-[1.5%] top-[1.4%] h-8 w-8 rounded-full bg-[#d9e1ea]" />
                  <Skeleton className="absolute left-[28%] top-[10%] h-5 w-[16%] rounded-sm bg-[#dce3eb]" />
                  <Skeleton className="absolute left-[33%] top-[31%] h-3 w-[40%] rounded-sm bg-[#dce3eb]" />
                  <Skeleton className="absolute bottom-[12%] left-[24%] h-14 w-[50%] rotate-[-18deg] rounded-md bg-[#b8c7e6]/70" />
                </div>

                <div className="relative min-w-0 flex-1 aspect-[3/4] overflow-hidden rounded-2xl border-[2.5px] border-[#6f88a3] bg-white/75 shadow-xl">
                  <Skeleton className="h-full w-full rounded-none bg-white/62" />
                  <Skeleton className="absolute left-[1%] top-[1%] h-[8.8%] w-[9.8%] rounded-md bg-white/80" />
                  <Skeleton className="absolute left-[1.75%] top-[1.8%] h-8 w-8 rounded-full bg-[#d9e1ea]" />
                  <Skeleton className="absolute left-[14%] top-[4%] h-6 w-[62%] rounded-sm bg-[#dce3eb]" />
                  <Skeleton className="absolute left-[13%] top-[18%] h-5 w-[66%] rounded-sm bg-[#dce3eb]" />
                  <div className="absolute left-[15%] top-[30%] w-[70%] space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-2.5 rounded-sm bg-[#dce3eb]" />
                    ))}
                  </div>
                </div>

                <div className="relative min-w-0 flex-1 aspect-[3/4] overflow-hidden rounded-2xl border-[2.5px] border-[#6f88a3] bg-white/70 shadow-lg">
                  <Skeleton className="h-full w-full rounded-none bg-white/58" />
                  <Skeleton className="absolute left-[0.6%] top-[0.8%] h-[10.5%] w-[19%] rounded-md bg-white/80" />
                  <Skeleton className="absolute left-[1.6%] top-[1.6%] h-8 w-8 rounded-full bg-[#d9e1ea]" />
                  <Skeleton className="absolute right-[9%] top-[6%] h-10 w-10 rounded-full bg-white/80" />
                  <Skeleton className="absolute left-[16%] top-[30%] h-2.5 w-[70%] rounded-sm bg-[#dce3eb]" />
                  <Skeleton className="absolute left-[16%] top-[66%] h-20 w-[70%] rounded-md bg-[#dce3eb]" />
                  <Skeleton className="absolute bottom-[7%] left-[26%] h-16 w-[52%] rotate-[-18deg] rounded-md bg-[#b8c7e6]/70" />
                </div>
              </div>

              <div className="mt-4 w-full overflow-hidden border-t border-[#2d96d8]/40 pt-3 sm:mt-5">
                <div className="flex gap-6 sm:gap-8">
                  {Array.from({ length: 13 }).map((_, index) => (
                    <Skeleton key={index} className="h-7 w-10 shrink-0 rounded-sm bg-white/50" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 h-28 w-full bg-gradient-to-t from-white/85 to-transparent" />
      </section>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-gray-50" aria-hidden="true">
      <aside className="hidden w-64 shrink-0 bg-[#1a1f2e] p-4 lg:block">
        <Skeleton className="mb-8 h-10 w-36 bg-white/15" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 rounded-md bg-white/10" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56 bg-gray-200" />
            <Skeleton className="h-4 w-80 max-w-full bg-gray-200" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg bg-gray-200" />
          ))}
        </div>
        <Skeleton className="mt-6 h-96 rounded-lg bg-gray-200" />
      </main>
    </div>
  );
}
