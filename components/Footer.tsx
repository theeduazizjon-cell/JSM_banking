'use client';

import { logoutAccount } from '@/lib/actions/user.actions'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React from 'react'

const Footer = ({ user, type = 'desktop' }: FooterProps) => {
  const router = useRouter();

  const handleLogOut = async () => {
    await logoutAccount();

    router.push('/sign-in')
    router.refresh()
  }

  return (
    <footer className="footer">
      <div className={type === 'mobile' ? 'footer_name-mobile' : 'footer_name'}>
        <p className="text-xl font-bold text-gray-700">
          {user?.firstName[0]}
        </p>
      </div>

      <div className={type === 'mobile' ? 'footer_email-mobile' : 'footer_email'}>
          <p className="text-14 truncate text-gray-700 font-semibold">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-14 truncate font-normal text-gray-600">
            {user?.email}
          </p>
      </div>

      <button type="button" className="footer_image" onClick={handleLogOut} aria-label="Log out">
        <Image src="/icons/logout.svg" fill alt="" />
      </button>
    </footer>
  )
}

export default Footer