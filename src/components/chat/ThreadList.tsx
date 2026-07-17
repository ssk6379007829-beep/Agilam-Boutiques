import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, type Thread } from '@/data/demo';

/** Messages list, shared by the buyer and seller inboxes. */
export function ThreadList({ threads, chatBase }: { threads: Thread[]; chatBase: string }) {
  const navigate = useNavigate();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;')}>
      <div style={css('padding:6px 20px 12px;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:28px;")}>Messages</div>
      </div>
      <div style={css('display:flex;flex-direction:column;')}>
        {threads.map((m) => (
          <div key={m.id} onClick={() => navigate(`${chatBase}/${m.id}`)} style={css('display:flex;gap:12px;align-items:center;padding:12px 20px;cursor:pointer;border-bottom:1px solid #F5E4EC;')}>
            <div style={css(`position:relative;width:52px;height:52px;flex:none;border-radius:16px;background:${TONES[m.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:22px;color:rgba(42,26,32,.55);`)}>
              {m.name[0]}
              {m.online && <span style={css('position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;border-radius:50%;background:#2FA36B;border:2.5px solid #FBF6F2;')} />}
            </div>
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('display:flex;justify-content:space-between;align-items:center;')}>
                <span style={css('font-weight:800;font-size:14.5px;')}>{m.name}</span>
                <span style={css('font-size:11.5px;color:#B79AA6;')}>{m.time}</span>
              </div>
              <div style={css('display:flex;justify-content:space-between;align-items:center;margin-top:2px;')}>
                <span style={css('font-size:13px;color:#8A7078;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px;')}>{m.last}</span>
                {m.unread > 0 && (
                  <span style={css('min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#D6336C;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;')}>{m.unread}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
