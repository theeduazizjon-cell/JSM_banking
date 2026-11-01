import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";
import { requireUser, toPublicUser } from "@/lib/data/user";
import Image from "next/image";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const user = toPublicUser(await requireUser());

  return (
   <main className="flex h-screen w-full font-inter">
    <Sidebar user={user}/>
    <div className='flex size-full flex-col'>
      <div className="root-layout">
        <Image src='/icons/logo.svg' width={30} height={30} alt="logo"/>
        <div>
          <MobileNav user={user}/>
        </div>
      </div>
       {children}
    </div>
   </main>
  );
}