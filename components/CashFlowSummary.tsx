import { summarizeCashFlow } from "@/lib/transactions";
import { cn, formatAmount } from "@/lib/utils";

import CashFlowChart from "./CashFlowChart";

// Income vs expenses for the selected account over the last six months
const CashFlowSummary = ({ transactions }: { transactions: Transaction[] }) => {
  const months = summarizeCashFlow(transactions, 6);
  const current = months[months.length - 1];
  const net = current.income - current.expenses;
  const hasData = months.some((m) => m.income > 0 || m.expenses > 0);

  const stats = [
    { label: "Income this month", value: formatAmount(current.income), tone: "text-success-700" },
    { label: "Expenses this month", value: formatAmount(current.expenses), tone: "text-gray-900" },
    { label: "Net this month", value: `${net < 0 ? "-" : "+"}${formatAmount(Math.abs(net))}`, tone: net < 0 ? "text-red-600" : "text-success-700" },
  ];

  return (
    <section aria-labelledby="cash-flow-heading" className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 shadow-chart sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="cash-flow-heading" className="header-2">Cash flow</h2>
        <p className="text-14 text-gray-600">Settled income and expenses over the last six months.</p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-gray-25 px-4 py-3">
            <dt className="text-12 font-medium text-gray-600">{stat.label}</dt>
            <dd className={cn("text-20 mt-1 font-semibold", stat.tone)}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {hasData ? (
        <div className="h-56 w-full">
          <CashFlowChart data={months} />
        </div>
      ) : (
        <p className="text-14 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-gray-600">
          No settled transactions in the last six months yet.
        </p>
      )}
    </section>
  );
};

export default CashFlowSummary;
