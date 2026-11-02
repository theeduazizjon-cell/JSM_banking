import Link from "next/link";

import { cn } from "@/lib/utils";

// One tab per bank. Each tab is a link because selecting a bank loads that
// bank's transactions on the server.
export const BankTabItem = ({ account, appwriteItemId, basePath = "/" }: BankTabItemProps) => {
  const isActive = appwriteItemId === account?.appwriteItemId;

  return (
    <Link
      href={`${basePath}?id=${account.appwriteItemId}`}
      scroll={false}
      aria-current={isActive ? "page" : undefined}
      className={cn(`banktab-item border-transparent hover:border-gray-300`, {
        "border-blue-600 hover:border-blue-600": isActive,
      })}
    >
      <span
        className={cn(`text-16 line-clamp-1 flex-1 font-medium text-gray-500`, {
          "text-blue-600": isActive,
        })}
      >
        {account.name}
      </span>
    </Link>
  );
};
