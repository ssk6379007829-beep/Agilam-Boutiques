import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';

/**
 * Role-picker splash. The default entry point is the loading screen, which
 * goes straight to the buyer app; this is reached on log out, where asking
 * "buyer or boutique owner?" is the useful question.
 */
export function Splash() {
  const navigate = useNavigate();

  return (
    <div style={css('min-height:100vh;background:linear-gradient(170deg,#D6336C 0%,#B02454 55%,#8E1C44 100%);display:flex;flex-direction:column;padding:40px 30px 34px;color:#fff;')}>
      <div style={css('flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;')}>
        <img src="/agilam-logo.png" alt="Agilam Boutiques" style={css('width:104px;height:104px;border-radius:28px;object-fit:contain;background:#fff;padding:16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.4);')} />
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:44px;margin-top:22px;line-height:1;")}>Agilam Boutiques</div>
        <div style={css("font-family:'Playfair Display',serif;font-style:italic;font-size:26px;margin-top:8px;opacity:.95;")}>All Boutiques. One Place.</div>
        <div style={css('font-size:14px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin-top:26px;')}>Discover · Connect · Chat · Shop</div>
      </div>
      <div style={css('display:flex;flex-direction:column;gap:12px;')}>
        <button onClick={() => navigate('/buyer/home')} style={css('width:100%;height:54px;border:none;border-radius:16px;background:#fff;color:#B02454;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 12px 30px -12px rgba(0,0,0,.4);')}>
          Continue as Buyer
        </button>
        <button onClick={() => navigate('/auth/signin/seller')} style={css('width:100%;height:54px;border:1.5px solid rgba(255,255,255,.6);border-radius:16px;background:rgba(255,255,255,.08);color:#fff;font-weight:700;font-size:16px;cursor:pointer;')}>
          I&apos;m a Boutique Owner
        </button>
      </div>
    </div>
  );
}
