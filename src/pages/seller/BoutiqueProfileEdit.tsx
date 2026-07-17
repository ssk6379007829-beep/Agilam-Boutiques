import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

const inputStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px;height:50px;font-size:14px;font-weight:600;';
const labelStyle = 'font-size:13px;font-weight:700;color:#7A5C67;';

export function BoutiqueProfileEdit() {
  const navigate = useNavigate();
  const { showToast } = useShop();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:23px;")}>Boutique Profile</div>
      </div>

      <div style={css('padding:4px 20px 0;')}>
        <div style={css('height:110px;border-radius:16px;background:#F4D6E2;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;')}>
          <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 1px,transparent 1px 16px);')} />
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(42,26,32,.5);background:rgba(255,255,255,.7);padding:4px 10px;border-radius:8px;")}>cover image · tap to change</span>
        </div>

        <div style={css('display:flex;align-items:center;gap:12px;margin-top:-24px;padding-left:6px;position:relative;')}>
          <div style={css("width:70px;height:70px;border-radius:20px;background:#E2DAEF;border:3px solid #FBF6F2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:28px;color:rgba(42,26,32,.5);")}>E</div>
          <div style={css('display:flex;align-items:center;gap:5px;background:#E5F3EC;color:#2FA36B;padding:5px 11px;border-radius:9px;font-weight:800;font-size:12px;margin-top:24px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:16px;")}>verified</span>Verified
          </div>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:16px;')}>
          <label style={css(labelStyle)}>
            Boutique name<input defaultValue="Elegance Boutique" style={css(inputStyle)} />
          </label>
          <label style={css(labelStyle)}>
            City<input defaultValue="Coimbatore" style={css(inputStyle)} />
          </label>
          <label style={css(labelStyle)}>
            Description
            <textarea rows={3} defaultValue="Handpicked bridal & festive wear crafted by Coimbatore's finest artisans." style={css('width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:12px 14px;font-size:14px;font-weight:500;resize:none;')} />
          </label>
          <button onClick={() => showToast('Boutique profile saved')} style={css('width:100%;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
