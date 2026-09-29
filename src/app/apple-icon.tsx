import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#12324a,#08131d)' }}>
        <div style={{ display: 'flex', width: 78, height: 78, transform: 'rotate(45deg)', border: '5px solid #e0b354', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, background: '#e0b354' }} />
        </div>
      </div>
    ),
    size,
  );
}
