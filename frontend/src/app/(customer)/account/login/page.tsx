import { Suspense } from 'react';
import { AuthForm } from '@/components/customer/AuthForm';

export default function LoginPage() {
  return (
    <>
      <div className="aurora-move" aria-hidden="true" />
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
