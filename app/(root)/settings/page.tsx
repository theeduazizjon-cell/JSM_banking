import type { Metadata } from 'next';

import ChangePasswordForm from '@/components/ChangePasswordForm';
import HeaderBox from '@/components/HeaderBox';
import { requireUser } from '@/lib/data/user';

export const metadata: Metadata = { title: 'Settings' };

const Settings = async () => {
  const user = await requireUser();

  // Rendered on the server for the signed-in user only; none of this is
  // passed to client components.
  const profile = [
    { label: 'Name', value: `${user.firstName} ${user.lastName}` },
    { label: 'Email', value: user.email },
    { label: 'Address', value: `${user.address1}, ${user.city}, ${user.state} ${user.postalCode}` },
  ];

  return (
    <section className="transactions">
      <HeaderBox title="Settings" subtext="Your profile and sign-in details." />

      <section aria-labelledby="profile-heading" className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="profile-heading" className="header-2">Profile</h2>
          <p className="text-14 text-gray-600">
            These details were verified with Dwolla when you signed up and can&apos;t be edited here.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {profile.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-12 font-medium text-gray-600">{item.label}</dt>
              <dd className="text-16 break-words text-gray-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="password-heading" className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="password-heading" className="header-2">Change password</h2>
          <p className="text-14 text-gray-600">Use at least 8 characters.</p>
        </div>
        <ChangePasswordForm />
      </section>
    </section>
  );
};

export default Settings;
