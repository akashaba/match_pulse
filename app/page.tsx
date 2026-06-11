import dynamic from 'next/dynamic';

const LegacyRoot = dynamic(() => import('@/LegacyRoot'), { ssr: false });

export default function Page() {
  return <LegacyRoot />;
}
