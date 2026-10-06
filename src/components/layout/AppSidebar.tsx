import {
  Building2,
  FileText,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Trash2,
} from "lucide-react";

import Link from "next/link";

const navigation = [
  {
    name: "ภาพรวม",
    href: "/",
    icon: LayoutDashboard,
  },

  {
    name: "จัดการใบเสนอราคา",
    href: "/quotations",
    icon: FileText,
  },

  {
    name: "ลูกค้า",
    href: "/customers",
    icon: Building2,
  },

  {
    name: "รายงานรายเดือน",
    href: "/reports/monthly",
    icon: CalendarDays,
  },

  {
    name: "รายงานรายปี",
    href: "/reports/yearly",
    icon: CalendarRange,
  },

  {
    name: "ถังขยะ",
    href: "/trash",
    icon: Trash2,
  },
];

export function AppSidebar() {
  return (
    <aside
      className="
        fixed inset-y-0 left-0 z-40
        hidden w-[260px]
        border-r border-[#e5e7eb]
        bg-white
        lg:flex lg:flex-col
      "
    >
      <div
        className="
          flex h-[88px]
          items-center
          border-b border-[#e5e7eb]
          px-6
        "
      >
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <img
            src="/ntp-logo.png"
            alt="NTP Electric and Engineering"
            className="
              h-14 w-14
              object-contain
            "
          />

          <div>
            <div
              className="
                text-lg font-bold
                tracking-tight
                text-[#17379c]
              "
            >
              NTP
            </div>

            <div
              className="
                text-[11px]
                font-medium
                text-[#667085]
              "
            >
              Quotation Management
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-5">
        <div
          className="
            mb-2 px-3
            text-[11px]
            font-semibold
            uppercase
            tracking-[0.08em]
            text-[#98a2b3]
          "
        >
          เมนูหลัก
        </div>

        <div className="space-y-1">
          {navigation.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className="
                    group
                    flex items-center
                    gap-3
                    rounded-lg
                    px-3 py-2.5
                    text-sm
                    font-medium
                    text-[#475467]
                    transition
                    hover:bg-[#eef2ff]
                    hover:text-[#17379c]
                  "
                >
                  <Icon
                    size={19}
                    strokeWidth={
                      1.8
                    }
                  />

                  {item.name}
                </Link>
              );
            },
          )}
        </div>
      </nav>

      <div
        className="
          border-t
          border-[#e5e7eb]
          px-5 py-4
        "
      >
        <p
          className="
            text-[11px]
            leading-5
            text-[#98a2b3]
          "
        >
          NTP Electric and
          Engineering Co., Ltd.
        </p>
      </div>
    </aside>
  );
}