export default function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <Skeleton width={240} height={28} style={{ marginBottom: 8 }} />
      <Skeleton width={160} height={14} style={{ marginBottom: 32 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Skeleton height={40} style={{ flex: 1 }} />
        <Skeleton width={120} height={40} />
      </div>
      {[1, 2, 3].map(i => (
        <Skeleton key={i} height={72} borderRadius={8} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}
