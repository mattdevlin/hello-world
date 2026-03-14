import { BRAND, NEUTRAL, RADIUS } from '../../utils/designTokens.js';

const STATUS_COLORS = {
  draft: { bg: '#f0f0f0', text: NEUTRAL.textSecondary },
  sent: { bg: '#e8f4fd', text: BRAND.primary },
  accepted: { bg: '#e8f8ef', text: BRAND.success },
  rejected: { bg: '#fde8e8', text: BRAND.danger },
};

export default function QuoteStatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.draft;

  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      background: colors.bg,
      color: colors.text,
      borderRadius: RADIUS.sm,
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {status}
    </span>
  );
}
