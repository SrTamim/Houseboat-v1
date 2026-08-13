import { Suspense } from 'react';
import { AuthForm } from '@/components/customer/AuthForm';

export default function RegisterPage() {
  return (
    <>
      <div className="aurora-move" aria-hidden="true" />
      <Suspense fallback={null}>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
