import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

const ADD_FIELDS = [
  { label: 'Product title', value: 'Rose Zari Silk Saree', ph: 'e.g. Rose Zari Silk Saree' },
  { label: 'Category', value: 'Sarees', ph: 'Sarees' },
  { label: 'Colour', value: 'Pink', ph: 'Pink' },
  { label: 'Occasion', value: 'Wedding', ph: 'Wedding' },
  { label: 'Fabric', value: 'Kanchipuram Silk', ph: 'Silk' },
];

const inputStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px;height:50px;font-size:14px;font-weight:600;';

export function AddProduct() {
  const navigate = useNavigate();
  const { showToast } = useShop();

  const publish = () => {
    showToast('Product published');
    navigate('/seller/products');
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/products')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Add New Product</div>
      </div>

      <div style={css('padding:6px 20px 0;display:flex;flex-direction:column;gap:14px;')}>
        <div style={css('display:flex;gap:10px;')}>
          <div style={css('width:96px;height:96px;flex:none;border-radius:16px;border:2px dashed #E6BCCF;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:24px;")}>add_a_photo</span>
            <span style={css('font-size:10px;color:#B79AA6;font-weight:700;')}>Upload</span>
          </div>
          <div style={css('flex:1;height:96px;border-radius:16px;background:#F4D6E2;position:relative;overflow:hidden;')}>
            <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 1px,transparent 1px 14px);')} />
            <div style={css("position:absolute;left:8px;bottom:6px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:rgba(42,26,32,.5);")}>product photo</div>
          </div>
        </div>

        {ADD_FIELDS.map((fl) => (
          <label key={fl.label} style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
            {fl.label}
            <input defaultValue={fl.value} placeholder={fl.ph} style={css(inputStyle)} />
          </label>
        ))}

        <div style={css('display:flex;gap:12px;')}>
          <label style={css('flex:1;font-size:13px;font-weight:700;color:#7A5C67;')}>
            Price (₹)<input defaultValue="4899" style={css(inputStyle)} />
          </label>
          <label style={css('flex:1;font-size:13px;font-weight:700;color:#7A5C67;')}>
            Stock<input defaultValue="12" style={css(inputStyle)} />
          </label>
        </div>

        <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
          Description
          <textarea rows={3} defaultValue="Handcrafted Kanchipuram silk saree with intricate zari border." style={css('width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:12px 14px;font-size:14px;font-weight:500;resize:none;')} />
        </label>

        <button onClick={publish} style={css('width:100%;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}>
          Publish Product
        </button>
      </div>
    </div>
  );
}
