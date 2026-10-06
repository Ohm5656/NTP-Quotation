"use client";

import Link from "next/link";

import {
  CalendarDays,
  CalendarRange,
  FileText,
  LayoutDashboard,
  Trash2,
} from "lucide-react";

import {
  usePathname,
} from "next/navigation";

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
  const pathname =
    usePathname();

  function isActive(
    href: string,
  ) {
    /*
     * หน้า Customer Detail ถือเป็น
     * ส่วนหนึ่งของหน้าภาพรวม
     */
    if (href === "/") {
      return (
        pathname === "/" ||
        pathname.startsWith(
          "/customers/",
        )
      );
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`,
      )
    );
  }

  return (
    <aside
      className="
        fixed
        inset-y-0
        left-0
        z-40
        hidden
        w-[260px]
        border-r
        border-[#e5e7eb]
        bg-white
        lg:flex
        lg:flex-col
      "
    >
      {/* Logo */}
      <div
        className="
          flex
          h-[88px]
          items-center
          border-b
          border-[#e5e7eb]
          px-6
        "
      >
        <Link
          href="/"
          className="
            flex
            items-center
            gap-3
          "
        >
          <img
            src="/ntp-logo.png"
            alt="NTP Electric and Engineering"
            className="
              h-14
              w-14
              object-contain
            "
          />

          <div>
            <div
              className="
                text-lg
                font-bold
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

      {/* Navigation */}
      <nav
        className="
          flex-1
          px-3
          py-5
        "
      >
        <div
          className="
            mb-2
            px-3
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

              const active =
                isActive(
                  item.href,
                );

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={`
                    relative
                    flex
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-sm
                    transition-all
                    ${
                      active
                        ? `
                            bg-[#eef2ff]
                            font-semibold
                            text-[#17379c]
                          `
                        : `
                            font-medium
                            text-[#475467]
                            hover:bg-[#f8f9fc]
                            hover:text-[#17379c]
                          `
                    }
                  `}
                >
                  {active && (
                    <span
                      className="
                        absolute
                        bottom-2
                        left-0
                        top-2
                        w-[3px]
                        rounded-r-full
                        bg-[#17379c]
                      "
                    />
                  )}

                  <Icon
                    size={19}
                    strokeWidth={
                      active
                        ? 2.2
                        : 1.8
                    }
                  />

                  <span>
                    {item.name}
                  </span>

                  {active && (
                    <span
                      className="
                        ml-auto
                        h-1.5
                        w-1.5
                        rounded-full
                        bg-[#df001b]
                      "
                    />
                  )}
                </Link>
              );
            },
          )}
        </div>
      </nav>

      {/* Footer */}
      <div
        className="
          border-t
          border-[#e5e7eb]
          px-5
          py-4
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