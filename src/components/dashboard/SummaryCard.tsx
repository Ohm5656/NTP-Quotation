type SummaryCardProps = {
  label: string;
  value: string;
  subtext?: string;
};

export function SummaryCard({
  label,
  value,
  subtext,
}: SummaryCardProps) {
  return (
    <div
      className="
        rounded-xl
        border border-[#e5e7eb]
        bg-white
        p-5
      "
    >
      <div
        className="
          mb-3 text-sm
          font-medium
          text-[#667085]
        "
      >
        {label}
      </div>

      <div
        className="
          text-2xl
          font-bold
          tracking-tight
          text-[#17379c]
        "
      >
        {value}
      </div>

      {subtext && (
        <div
          className="
            mt-2 text-xs
            text-[#98a2b3]
          "
        >
          {subtext}
        </div>
      )}
    </div>
  );
}