'use client'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { sidebarLinks } from "@/constants"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Footer from "./Footer"

const MobileNav = ({ user }: MobileNavProps) => {
  const pathname = usePathname();

  return (
    <section className="w-full max-w-[264px]">
      <Sheet>
        <SheetTrigger className="cursor-pointer" aria-label="Open navigation menu">
          <Image
            src="/icons/hamburger.svg"
            width={30}
            height={30}
            alt=""
          />
        </SheetTrigger>
        <SheetContent side="left" className="border-none bg-white">
          {/* Base UI dialogs need a title/description for screen readers */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Ledgerly navigation menu</SheetDescription>

          <Link href="/" className="cursor-pointer flex items-center gap-1 px-4 pt-4">
            <Image
              src="/icons/logo.svg"
              width={34}
              height={34}
              alt="Ledgerly logo"
            />
            <span className="text-26 font-ibm-plex-serif font-bold text-black-1">Ledgerly</span>
          </Link>
          <div className="mobilenav-sheet">
            <nav className="flex h-full flex-col gap-6 pt-16 text-white">
              {sidebarLinks.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`)

                return (
                  <SheetClose
                    key={item.label}
                    nativeButton={false}
                    render={
                      <Link
                        href={item.route}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn('mobilenav-sheet_close w-full', { 'bg-bank-gradient': isActive })}
                      />
                    }
                  >
                    <Image
                      src={item.imgURL}
                      alt=""
                      width={20}
                      height={20}
                      className={cn({
                        'brightness-[3] invert-0': isActive
                      })}
                    />
                    <p className={cn("text-16 font-semibold text-black-2", { "text-white": isActive })}>
                      {item.label}
                    </p>
                  </SheetClose>
                )
              })}
            </nav>

            <Footer user={user} type="mobile" />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

export default MobileNav
