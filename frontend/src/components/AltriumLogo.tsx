export default function AltriumLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="50,3 93,26 93,74 50,97 7,74 7,26"
        fill="#111111"
        stroke="#f5a623"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M50 28 L72 68 L60 68 L50 48 L40 68 L28 68 Z"
        fill="#ffffff"
      />
      <circle cx="76" cy="24" r="6" fill="#f5a623" />
    </svg>
  );
}
