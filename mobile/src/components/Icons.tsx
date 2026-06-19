import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

const SIZE = 22;

export function GridIcon({ color }: { color: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function BoardsIcon({ color }: { color: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Path d="M3 9h18" />
      <Path d="M9 21V9" />
    </Svg>
  );
}

export function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="7" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

export function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Svg>
  );
}

export function BookmarkIcon({ color = '#0B0C1D', filled = false, size = 18 }: { color?: string; filled?: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

export function ChevronLeftIcon({ color = '#0B0C1D', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function DotsIcon({ color = '#0B0C1D', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="5" cy="12" r="2" />
      <Circle cx="12" cy="12" r="2" />
      <Circle cx="19" cy="12" r="2" />
    </Svg>
  );
}

export function CloseIcon({ color = '#7A7B8A', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function CheckIcon({ color = '#fff', size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function ShareIcon({ color = '#0B0C1D', size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v13" />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Svg>
  );
}

export function InboxIcon({ color = '#0B0C1D', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12h4l2 4h6l2-4h4" />
      <Path d="M5.45 5.11L3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6l-2.45-6.89A1.5 1.5 0 0 0 17.13 4H6.87a1.5 1.5 0 0 0-1.42 1.11z" />
    </Svg>
  );
}

export function UserPlusIcon({ color = '#0B0C1D', size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="8" r="4" />
      <Path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
      <Path d="M19 8v6" />
      <Path d="M16 11h6" />
    </Svg>
  );
}
