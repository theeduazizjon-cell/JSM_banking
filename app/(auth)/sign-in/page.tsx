import AuthForm from '@/components/AuthForm'
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

const SignIn = () => {
  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm type="sign-in" />
    </section>
  )
}

export default SignIn