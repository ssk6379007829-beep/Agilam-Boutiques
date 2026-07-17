import { css } from '@/lib/css';
import { ANALYTICS, TONES, fmt } from '@/data/demo';

export function Analytics() {
  const best = ANALYTICS.bestSellers.map((b, i) => ({
    ...b,
    rank: i + 1,
    barW: Math.round((b.units / ANALYTICS.bestSellers[0].units) * 100) + '%',
  }));

  // Build the pie as cumulative conic-gradient stops, as the design does.
  let acc = 0;
  const cats = ANALYTICS.categories.map((c) => {
    const seg = { ...c, from: acc, to: acc + c.pct };
    acc += c.pct;
    return seg;
  });
  const conicPie = `conic-gradient(${cats.map((c) => `${c.color} ${c.from}% ${c.to}%`).join(',')})`;

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:1240px;margin:0 auto;')}>
        <div style={css('padding:6px 0 4px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;')}>
          <div>
            <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Business insights</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>Analytics</div>
          </div>
          <div style={css('display:flex;gap:6px;background:#fff;border:1px solid #F0E2E9;border-radius:12px;padding:4px;')}>
            <span style={css('padding:7px 13px;border-radius:9px;background:#B02454;color:#fff;font-size:12.5px;font-weight:800;')}>6 months</span>
            <span style={css('padding:7px 13px;border-radius:9px;color:#8A7078;font-size:12.5px;font-weight:700;')}>Year</span>
          </div>
        </div>

        <div className="agx-rgrid" style={css('margin-top:14px;')}>
          <div className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 18px 40px -28px rgba(107,20,54,.55);')}>
            <div style={css('width:42px;height:42px;border-radius:13px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}><span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>account_balance_wallet</span></div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;margin-top:12px;")}>₹8.4L</div>
            <div style={css('color:#8A7078;font-size:12.5px;font-weight:700;')}>Total Revenue</div>
            <div style={css('font-size:11.5px;font-weight:800;color:#2FA36B;margin-top:6px;')}>▲ 18.2% vs last period</div>
          </div>
          <div className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 18px 40px -28px rgba(107,20,54,.55);')}>
            <div style={css('width:42px;height:42px;border-radius:13px;background:#E6F0FA;display:flex;align-items:center;justify-content:center;')}><span style={css("font-family:'Material Symbols Outlined';color:#3A6EA5;")}>receipt_long</span></div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;margin-top:12px;")}>₹6,562</div>
            <div style={css('color:#8A7078;font-size:12.5px;font-weight:700;')}>Avg Order Value</div>
            <div style={css('font-size:11.5px;font-weight:800;color:#2FA36B;margin-top:6px;')}>▲ 4.6%</div>
          </div>
          <div className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 18px 40px -28px rgba(107,20,54,.55);')}>
            <div style={css('width:42px;height:42px;border-radius:13px;background:#E9F6EF;display:flex;align-items:center;justify-content:center;')}><span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;")}>conversion_path</span></div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;margin-top:12px;")}>3.8%</div>
            <div style={css('color:#8A7078;font-size:12.5px;font-weight:700;')}>Conversion Rate</div>
            <div style={css('font-size:11.5px;font-weight:800;color:#2FA36B;margin-top:6px;')}>▲ 0.5 pts</div>
          </div>
          <div className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 18px 40px -28px rgba(107,20,54,.55);')}>
            <div style={css('width:42px;height:42px;border-radius:13px;background:#F3EAD9;display:flex;align-items:center;justify-content:center;')}><span style={css("font-family:'Material Symbols Outlined';color:#B8860B;")}>shopping_bag</span></div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;margin-top:12px;")}>128</div>
            <div style={css('color:#8A7078;font-size:12.5px;font-weight:700;')}>Total Orders</div>
            <div style={css('font-size:11.5px;font-weight:800;color:#2FA36B;margin-top:6px;')}>▲ 12 this month</div>
          </div>
        </div>

        <div className="agx-an-grid" style={css('display:grid;gap:18px;margin-top:18px;align-items:start;')}>
          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:22px;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Revenue trend</div>
              <span style={css('font-size:12px;font-weight:800;color:#8A7078;')}>Monthly · ₹</span>
            </div>
            <div style={css('display:flex;align-items:flex-end;gap:clamp(10px,3vw,26px);height:200px;margin-top:22px;padding:0 4px;')}>
              {ANALYTICS.revenueBars.map((b) => (
                <div key={b.m} style={css('flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;height:100%;justify-content:flex-end;')}>
                  <div style={css(`width:100%;max-width:46px;height:${b.h};border-radius:10px 10px 4px 4px;background:linear-gradient(180deg,#E14A7E,#B02454);box-shadow:0 10px 22px -12px rgba(176,36,84,.7);`)} />
                  <span style={css('font-size:11.5px;font-weight:800;color:#8A7078;')}>{b.m}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:22px;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Sales by category</div>
            <div style={css('display:flex;align-items:center;gap:22px;margin-top:18px;flex-wrap:wrap;')}>
              <div style={css(`width:132px;height:132px;flex:none;border-radius:50%;background:${conicPie};display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px -18px rgba(107,20,54,.5);`)}>
                <div style={css('width:78px;height:78px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;')}>
                  <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;color:#B02454;")}>128</span>
                  <span style={css('font-size:9.5px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>ORDERS</span>
                </div>
              </div>
              <div style={css('flex:1;min-width:150px;display:flex;flex-direction:column;gap:11px;')}>
                {cats.map((c) => (
                  <div key={c.name} style={css('display:flex;align-items:center;gap:10px;')}>
                    <span style={css(`width:12px;height:12px;border-radius:4px;background:${c.color};flex:none;`)} />
                    <span style={css('flex:1;font-weight:700;font-size:13.5px;')}>{c.name}</span>
                    <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:#8A7078;")}>{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="agx-an-grid" style={css('display:grid;gap:18px;margin-top:18px;align-items:start;')}>
          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:22px;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Best selling products</div>
            <div style={css('display:flex;flex-direction:column;gap:16px;margin-top:18px;')}>
              {best.map((p) => (
                <div key={p.title} style={css('display:flex;align-items:center;gap:13px;')}>
                  <div style={css(`width:34px;height:34px;flex:none;border-radius:11px;background:${TONES[p.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:15px;color:rgba(42,26,32,.6);`)}>{p.rank}</div>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                      <span style={css('font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</span>
                      <span style={css('font-weight:800;font-size:12.5px;color:#B02454;white-space:nowrap;')}>{p.units} sold</span>
                    </div>
                    <div style={css('height:8px;border-radius:5px;background:#F1E1E9;overflow:hidden;margin-top:7px;')}>
                      <span style={css(`display:block;height:100%;width:${p.barW};background:linear-gradient(90deg,#E14A7E,#B02454);border-radius:5px;`)} />
                    </div>
                    <div style={css('color:#8A7078;font-size:11.5px;margin-top:5px;')}>{fmt(p.revenue)} revenue</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:22px;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Top customers</div>
            <div style={css('display:flex;flex-direction:column;gap:6px;margin-top:12px;')}>
              {ANALYTICS.topCustomers.map((c) => (
                <div key={c.name} style={css('display:flex;align-items:center;gap:13px;padding:11px 0;border-bottom:1px solid #F5E4EC;')}>
                  <div style={css(`width:44px;height:44px;flex:none;border-radius:13px;background:${TONES[c.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:rgba(42,26,32,.55);`)}>{c.name[0]}</div>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('font-weight:800;font-size:14px;')}>{c.name}</div>
                    <div style={css('color:#8A7078;font-size:12px;margin-top:2px;')}>{c.orders} orders</div>
                  </div>
                  <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:17px;")}>{fmt(c.spent)}</div>
                </div>
              ))}
              <div style={css('display:flex;align-items:center;gap:9px;margin-top:8px;color:#8A7078;font-size:12px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:18px;color:#2FA36B;")}>insights</span>Highest selling category: <span style={css('font-weight:800;color:#4B3840;')}>Sarees</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
