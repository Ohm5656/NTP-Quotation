export default function Loading() {
  return (
    <div className="loading-shell" role="status" aria-label="กำลังโหลดข้อมูล">
      <div className="skeleton h-7 w-44" />
      <div className="mt-3 skeleton h-4 w-[min(32rem,80%)]" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="skeleton h-4 w-28" />
            <div className="mt-5 skeleton h-8 w-36" />
            <div className="mt-4 skeleton h-3 w-44" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-[#e5e7eb] bg-white p-5">
        <div className="skeleton h-5 w-48" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
