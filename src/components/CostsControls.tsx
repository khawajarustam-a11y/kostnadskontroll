"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  filterLabel: string;
  sortLabel: string;
  allLabel: string;
  weeklyLabel: string;
  monthlyLabel: string;
  yearlyLabel: string;
  sortNextPaymentLabel: string;
  sortAmountHighLabel: string;
  sortAmountLowLabel: string;
  sortVendorLabel: string;
  selectedFilter: string;
  selectedSort: string;
};

export default function CostsControls({
  filterLabel,
  sortLabel,
  allLabel,
  weeklyLabel,
  monthlyLabel,
  yearlyLabel,
  sortNextPaymentLabel,
  sortAmountHighLabel,
  sortAmountLowLabel,
  sortVendorLabel,
  selectedFilter,
  selectedSort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "active");
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="table-controls">
      <label className="stack">
        <span>{filterLabel}</span>
        <select
          name="filter"
          value={selectedFilter}
          onChange={(event) => updateParam("filter", event.target.value)}
        >
          <option value="ALL">{allLabel}</option>
          <option value="WEEKLY">{weeklyLabel}</option>
          <option value="MONTHLY">{monthlyLabel}</option>
          <option value="YEARLY">{yearlyLabel}</option>
        </select>
      </label>
      <label className="stack">
        <span>{sortLabel}</span>
        <select
          name="sort"
          value={selectedSort}
          onChange={(event) => updateParam("sort", event.target.value)}
        >
          <option value="next_payment">{sortNextPaymentLabel}</option>
          <option value="amount_desc">{sortAmountHighLabel}</option>
          <option value="amount_asc">{sortAmountLowLabel}</option>
          <option value="vendor">{sortVendorLabel}</option>
        </select>
      </label>
    </div>
  );
}
