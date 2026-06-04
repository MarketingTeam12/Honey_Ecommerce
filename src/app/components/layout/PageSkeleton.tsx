import { Skeleton } from '@/app/components/ui/skeleton';

export function PublicPageSkeleton() {
  return (
    <div className="min-h-[70vh] bg-white" aria-hidden="true">
      <section className="border-b border-gray-100 bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div className="space-y-6">
            <Skeleton className="h-5 w-40 bg-gray-200" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full max-w-xl bg-gray-200" />
              <Skeleton className="h-12 w-4/5 max-w-lg bg-gray-200" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full max-w-2xl bg-gray-200" />
              <Skeleton className="h-4 w-11/12 max-w-xl bg-gray-200" />
              <Skeleton className="h-4 w-3/4 max-w-lg bg-gray-200" />
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-11 w-36 rounded-md bg-gray-200" />
              <Skeleton className="h-11 w-32 rounded-md bg-gray-200" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="aspect-[4/3] rounded-lg bg-gray-200" />
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-lg bg-gray-200" />
              <Skeleton className="h-28 rounded-lg bg-gray-200" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56 bg-gray-200" />
            <Skeleton className="h-4 w-80 max-w-full bg-gray-200" />
          </div>
          <Skeleton className="hidden h-10 w-28 rounded-md bg-gray-200 sm:block" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <Skeleton className="mb-4 aspect-square rounded-md bg-gray-200" />
              <Skeleton className="mb-3 h-5 w-4/5 bg-gray-200" />
              <Skeleton className="mb-2 h-4 w-full bg-gray-200" />
              <Skeleton className="h-4 w-2/3 bg-gray-200" />
            </div>
          ))}
        </div>
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
