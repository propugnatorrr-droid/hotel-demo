import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#12324a,#08131d)', borderRadius: 112 }}>
        <div style={{ display: 'flex', width: 220, height: 220, transform: 'rotate(45deg)', border: '14px solid #e0b354', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 84, height: 84, background: '#e0b354' }} />
        </div>
      </div>
    ),
    size,
  );
}
