'use client';

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { PlaidLinkOnExit, PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from 'react-plaid-link'
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
    // Ignore the response if the component unmounted (or React re-ran the
    // effect in development), so Link is only initialised with one token.
    let ignore = false;

    const getLinkToken = async () => {
      const result = await createLinkToken();

      if (ignore) return;

      if (!result.ok) setError(result.error);
      else setToken(result.data.linkToken);
    }

    getLinkToken();

    return () => {
      ignore = true;
    };
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

  // Called when the user closes Link or Plaid hits an error
  const onExit = useCallback<PlaidLinkOnExit>((exitError) => {
    if (exitError) {
      setError(exitError.display_message || exitError.error_message || 'Bank linking failed. Please try again.');
    }
  }, [])

  const config: PlaidLinkOptions = {
    token,
    onSuccess,
    onExit,
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
        <Button onClick={() => open()} disabled={disabled} className="plaidlink-default" aria-label="Connect bank" title="Connect bank">
          <Image
            src="/icons/connect-bank.svg"
            alt=""
            width={24}
            height={24}
          />
          {/* Matches the sidebar links, which show icons only below xl */}
          <span className='sidebar-label'>Connect bank</span>
        </Button>
      )}
      {error && <p role="alert" className="text-12 text-red-500">{error}</p>}
    </>
  )
}

export default PlaidLink
