import { Icon } from '@/components/ui/Icon';
import { fmtInr, toneHex } from '@/lib/tokens';
import type { ProductWithBoutique } from '@/data/types';

type Props = {
  product: ProductWithBoutique;
  onOpen: () => void;
  wished?: boolean;
  onToggleWish?: (e: React.MouseEvent) => void;
  showRating?: boolean;
  showBoutique?: boolean;
  imageHeight?: number;
  width?: number;
};

export function ProductCard({ product: p, onOpen, wished, onToggleWish, showRating, showBoutique, imageHeight = 180, width }: Props) {
  return (
    <div onClick={onOpen} className="cursor-pointer" style={width ? { flex: 'none', width } : undefined}>
      <div
        className="relative overflow-hidden rounded-[18px] shadow-soft"
        style={{ height: imageHeight, background: toneHex(p.tone) }}
      >
        {p.image_url ? (
          <img src={p.image_url} alt={p.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-black/40">{p.title}</div>
        )}
        {onToggleWish && (
          <button
            type="button"
            onClick={onToggleWish}
            aria-label={wished ? `Remove ${p.title} from wishlist` : `Add ${p.title} to wishlist`}
            aria-pressed={!!wished}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-[10px] border-none bg-white/85"
          >
            <Icon name={wished ? 'favorite' : 'favorite_border'} className="text-lg" style={{ color: wished ? '#D6336C' : '#B79AA6' }} />
          </button>
        )}
      </div>
      <div className="pt-2">
        <div className="truncate text-[13.5px] font-bold leading-tight">{p.title}</div>
        {showBoutique && <div className="mt-0.5 text-xs text-rose-muted">{p.boutique?.name}</div>}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-rose-primaryDark">{fmtInr(p.price)}</span>
          {showRating && (
            <span className="flex items-center gap-0.5 text-[11.5px] font-bold text-rose-label">
              <Icon name="star" className="text-sm" style={{ color: '#E0B84B' }} />
              {p.rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
