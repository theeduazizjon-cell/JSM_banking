import AuthForm from '@/components/AuthForm'
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

const SignUp = async () => {
  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm type="sign-up" />
    </section>
  )
}

export default SignUp