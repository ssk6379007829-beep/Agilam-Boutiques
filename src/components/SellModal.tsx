import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

/**
 * "Are you a Boutique Owner?" sheet, opened from the buyer profile.
 * This is the entry point into the gated seller flow.
 */
export function SellModal() {
  const navigate = useNavigate();
  const { closeSellModal } = useShop();

  const goLogin = () => {
    closeSellModal();
    navigate('/auth/signin/seller');
  };

  const goCreate = () => {
    closeSellModal();
    navigate('/auth/signup/seller');
  };

  return (
    <div
      onClick={closeSellModal}
      style={css('position:fixed;inset:0;z-index:210;background:rgba(40,10,22,.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css('width:100%;max-width:460px;background:#fff;border-radius:28px 28px 0 0;padding:14px 24px 32px;box-shadow:0 -24px 70px -24px rgba(107,20,54,.55);')}
      >
        <div style={css('width:44px;height:5px;border-radius:5px;background:#EFDCE4;margin:0 auto 18px;')} />
        <div style={css('width:58px;height:58px;border-radius:18px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow:0 16px 34px -16px rgba(214,51,108,.8);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:30px;")}>storefront</span>
        </div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;text-align:center;margin-top:16px;line-height:1.1;")}>
          Are you a Boutique Owner?
        </div>
        <div style={css('text-align:center;color:#8A7078;font-size:14px;margin-top:9px;line-height:1.55;max-width:340px;margin-left:auto;margin-right:auto;')}>
          Sell your creations to thousands of shoppers across Tamil Nadu. Manage orders, chat with buyers and grow your boutique on Agilam.
        </div>
        <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:24px;')}>
          <button
            onClick={goLogin}
            style={css('height:54px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);display:flex;align-items:center;justify-content:center;gap:8px;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>login</span>Login
          </button>
          <button
            onClick={goCreate}
            style={css('height:54px;border:1.5px solid #E7C6D4;border-radius:16px;background:#fff;color:#B02454;font-weight:800;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>add_business</span>Create Boutique
          </button>
          <button
            onClick={closeSellModal}
            style={css('height:44px;border:none;background:none;color:#8A7078;font-weight:700;font-size:14px;cursor:pointer;')}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
