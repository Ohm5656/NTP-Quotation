import Link from "next/link";

import {
  ChevronRight,
  Folder,
} from "lucide-react";

type Props = {
  href?: string;

  title: string;

  subtitle: string;

  meta?: string;

  disabled?: boolean;
};

export function ReportFolderCard({
  href,
  title,
  subtitle,
  meta,
  disabled = false,
}: Props) {
  const content = (
    <div
      className={`
        group
        flex
        min-h-[145px]
        items-center
        gap-5
        rounded-2xl
        border
        p-5
        transition
        ${
          disabled
            ? `
                border-[#e5e7eb]
                bg-[#f8f9fc]
                opacity-65
              `
            : `
                border-[#d8e3dd]
                bg-white
                hover:-translate-y-0.5
                hover:border-[#9bc6b2]
                hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)]
              `
        }
      `}
    >
      <div
        className={`
          flex
          h-14
          w-14
          shrink-0
          items-center
          justify-center
          rounded-xl
          ${
            disabled
              ? `
                  bg-[#f0f1f3]
                  text-[#98a2b3]
                `
              : `
                  bg-[#eaf6ef]
                  text-[#13795b]
                `
          }
        `}
      >
        <Folder
          size={28}
          strokeWidth={1.8}
        />
      </div>

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <h2
          className="
            text-xl
            font-bold
            text-[#172033]
          "
        >
          {title}
        </h2>

        <p
          className="
            mt-1
            text-sm
            text-[#667085]
          "
        >
          {subtitle}
        </p>

        {meta && (
          <p
            className="
              mt-1
              text-xs
              text-[#98a2b3]
            "
          >
            {meta}
          </p>
        )}
      </div>

      {!disabled && (
        <ChevronRight
          size={22}
          className="
            shrink-0
            text-[#344054]
            transition
            group-hover:
            translate-x-1
            group-hover:
            text-[#13795b]
          "
        />
      )}
    </div>
  );

  if (
    disabled ||
    !href
  ) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block"
    >
      {content}
    </Link>
  );
}