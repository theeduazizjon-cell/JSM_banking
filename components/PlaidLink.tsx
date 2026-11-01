'use client';

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from 'react-plaid-link'
import { useRouter } from 'next/navigation';
import { createLinkToken, exchangePublicToken } from '@/lib/actions/user.actions';
import Image from 'next/image';

// The signed-in user is read from the session on the server, so this
// component needs no user data.
const PlaidLink = ({ variant }: PlaidLinkProps) => {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    const getLinkToken = async () => {
      const result = await createLinkToken();

      if (!result.ok) setError(result.error);
      else setToken(result.data.linkToken);
    }

    getLinkToken();
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token: string) => {
    setIsLinking(true);
    setError(null);

    const result = await exchangePublicToken({ publicToken: public_token });

    setIsLinking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push('/');
    router.refresh();
  }, [router])

  const config: PlaidLinkOptions = {
    token,
    onSuccess
  }

  const { open, ready } = usePlaidLink(config);
  const disabled = !ready || isLinking;

  return (
    <>
      {variant === 'primary' ? (
        <Button
          onClick={() => open()}
          disabled={disabled}
          className="plaidlink-primary"
        >
          {isLinking ? 'Connecting...' : 'Connect bank'}
        </Button>
      ): variant === 'ghost' ? (
        <Button onClick={() => open()} disabled={disabled} variant="ghost" className="plaidlink-ghost">
          <Image
            src="/icons/connect-bank.svg"
            alt=""
            width={24}
            height={24}
          />
          <p className='hidden text-[16px] font-semibold text-black-2 xl:block'>Connect bank</p>
        </Button>
      ): (
        <Button onClick={() => open()} disabled={disabled} className="plaidlink-default">
          <Image
            src="/icons/connect-bank.svg"
            alt=""
            width={24}
            height={24}
          />
          <p className='text-[16px] font-semibold text-black-2'>Connect bank</p>
        </Button>
      )}
      {error && <p role="alert" className="text-12 text-red-500">{error}</p>}
    </>
  )
}

export default PlaidLink
