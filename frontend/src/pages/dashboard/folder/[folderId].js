import { useRouter } from 'next/router';
import DashboardView from '../../../components/DashboardView';

export default function FolderPage() {
  const router = useRouter();
  const { folderId } = router.query;

  if (!folderId) return null;
  return <DashboardView mode="folder" folderId={folderId} />;
}
