export function AppHeader() {
  return (
    <header
      className="
        sticky top-0 z-30
        flex h-[72px]
        items-center
        justify-between
        border-b
        border-[#e5e7eb]
        bg-white/95
        px-5
        backdrop-blur
        md:px-7
        lg:px-9
      "
    >
      <div>
        <p
          className="
            text-xs
            font-medium
            text-[#98a2b3]
          "
        >
          NTP Electric and
          Engineering Co., Ltd.
        </p>
      </div>

      <div
        className="
          flex items-center
          gap-3
        "
      >
        <div
          className="
            flex h-9 w-9
            items-center
            justify-center
            rounded-full
            bg-[#17379c]
            text-xs
            font-bold
            text-white
          "
        >
          NTP
        </div>

        <div className="hidden sm:block">
          <div
            className="
              text-sm
              font-semibold
              text-[#172033]
            "
          >
            Administrator
          </div>

          <div
            className="
              text-xs
              text-[#98a2b3]
            "
          >
            ระบบจัดการใบเสนอราคา
          </div>
        </div>
      </div>
    </header>
  );
}