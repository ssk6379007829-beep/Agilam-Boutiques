import { useAuth } from '@/auth/AuthContext';
import { useAsync } from './useAsync';
import { fetchMyBoutique } from '@/data/boutiques';

export function useMyBoutique() {
  const { profile } = useAuth();
  const { data: boutique, loading, reload } = useAsync(() => (profile ? fetchMyBoutique(profile.id) : Promise.resolve(null)), [profile?.id]);
  return { boutique, loading, reload };
}
