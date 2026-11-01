// Right-hand panel on the sign-in and sign-up pages. Built in HTML instead of
// a screenshot so it stays sharp, light (the old image was 780 KB) and on-brand.
const sampleRows = [
  { name: 'Payroll deposit', amount: '+$3,200.00', credit: true },
  { name: 'Grocery market', amount: '-$84.17', credit: false },
  { name: 'Transfer to savings', amount: '-$500.00', credit: false },
];

const highlights = [
  'Link accounts securely with Plaid',
  'Send transfers through Dwolla',
  'Sandbox only: no real money moves',
];

const AuthBrandPanel = () => {
  return (
    <div className="auth-asset">
      <div className="flex w-full max-w-[460px] flex-col gap-10 px-12">
        <div className="flex flex-col gap-3">
          <p className="text-14 font-semibold uppercase tracking-[0.12em] text-blue-600">Ledgerly</p>
          <p className="text-36 font-ibm-plex-serif font-bold text-black-1">
            Every account.<br />One clear ledger.
          </p>
        </div>

        {/* Decorative preview with sample figures */}
        <div aria-hidden="true" className="rounded-2xl border border-white bg-white/80 p-6 shadow-profile backdrop-blur">
          <div className="rounded-xl bg-bank-gradient p-5 text-white">
            <p className="text-12 font-medium text-blue-25">Total balance · sample</p>
            <p className="text-30 mt-1 font-semibold">$12,480.32</p>
            <p className="text-12 mt-4 tracking-[0.2em] text-blue-25">●●●● 4021</p>
          </div>
          <ul className="mt-5 flex flex-col divide-y divide-gray-200">
            {sampleRows.map((row) => (
              <li key={row.name} className="text-14 flex items-center justify-between py-3">
                <span className="font-medium text-gray-700">{row.name}</span>
                <span className={row.credit ? 'font-semibold text-success-600' : 'font-semibold text-gray-900'}>
                  {row.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="flex flex-col gap-3">
          {highlights.map((item) => (
            <li key={item} className="text-16 flex items-center gap-3 text-gray-700">
              <span aria-hidden="true" className="size-2 rounded-full bg-blue-600" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AuthBrandPanel;
