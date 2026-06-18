/** Simple circular line-icon badges, stroked in the given accent color. */
export const Icon: React.FC<{ name: 'spark' | 'shield' | 'chart'; color: string; size: number }> = ({ name, color, size }) => {
  const paths: Record<string, React.ReactNode> = {
    spark: <path d="M32 8 L37 27 L56 32 L37 37 L32 56 L27 37 L8 32 L27 27 Z" />,
    shield: <path d="M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z" />,
    chart: (
      <>
        <path d="M14 50 V28" />
        <path d="M28 50 V18" />
        <path d="M42 50 V34" />
        <path d="M50 50 H12" />
      </>
    ),
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}
