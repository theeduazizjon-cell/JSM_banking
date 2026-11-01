"use client";

import Link from 'next/link';
import React from 'react'
import Image from "next/image";
import { sidebarLinks } from '@/constants';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import Footer from './Footer';
import PlaidLink from './PlaidLink';


const Sidebar = ({ user }: SidebarProps) => {
    const pathname = usePathname();

  return (
    <section className="sidebar">
        <nav className="flex flex-col gap-4">

            <Link href="/" className='mb-12 cursor-pointer flex items-center gap-2'>
            <Image 
                      src="/icons/logo.svg" 
                      width={34}
                      height={34} 
                      alt= "Horizon logo"
                      className = "size-[24px] max-xl:size-14"
            />

            <span className="sidebar-logo">
                Horizon
            </span>
            </Link>

            {sidebarLinks.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`)

                return (
                    <Link 
                    href={item.route} 
                    key={item.label} 
                    aria-current={isActive ? 'page' : undefined}
                    // Labels are hidden on medium screens, so keep the name for screen readers and tooltips
                    aria-label={item.label}
                    title={item.label}
                    className={cn('sidebar-link', {'bg-bank-gradient': isActive})}>
                        <div className = 'relative size-6'>
                            <Image
                            src={item.imgURL}
                            alt=""
                            fill
                            className={cn({
                                'brightness-[3] invert-0': isActive,
                            })}
                            />   
                        </div>
                        <p className={cn('sidebar-label',{'!text-white': isActive})}>
                            {item.label}
                        </p>
                    </Link>
                )
            })}
            <PlaidLink />
        </nav>


            <Footer user={user} />
    </section>
  )
}

export default Sidebar;