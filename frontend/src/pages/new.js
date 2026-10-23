import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createFile } from '@/lib/api/client';

export default function NewPage() {
  const router = useRouter();

  useEffect(() => {
    async function createAndRedirect() {
      try {
        const data = await createFile({ title: 'Untitled' });
        if (data.success && data.file) {
          router.replace(`/workspace/${data.file.id}`);
        } else {
          router.replace('/dashboard/all');
        }
      } catch (e) {
        console.error(e);
        router.replace('/dashboard/all');
      }
    }
    createAndRedirect();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--text-muted)',
      fontSize: '14px'
    }}>
      Creating new workspace document...
    </div>
  );
}
