import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ResetPasswordCard } from '@/components/auth/ResetPasswordCard';
import { adminPath } from '@/lib/adminPath';
import { useShop } from '@/state/ShopContext';

/**
 * Lands here from the admin password-reset email link. The change is only
 * accepted for admin accounts — a non-admin who somehow reaches this flow is
 * signed out, matching the rule that only those with admin access may use the
 * admin console.
 */
export function AdminResetPassword() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useShop();

  return (
    <ResetPasswordCard
      heading="Set a new password"
      sub="Choose a new password for your admin account."
      backTo={adminPath('login')}
      onComplete={async (role) => {
        if (role !== 'admin') {
          await signOut();
          showToast('This account does not have admin access.', 'warning');
          navigate(adminPath('login'), { replace: true });
          return;
        }
        showToast('Password updated. You are signed in.');
        navigate(adminPath('overview'), { replace: true });
      }}
    />
  );
}
