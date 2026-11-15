import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/lib/theme';
import { MARK_FULL_PATH, MARK_SMALL_PATH } from './markPaths';

// The hand-printed tulip-and-heart mark. The full drawing keeps its rough
// edges, which turn to noise when small, so anything under 64pt uses the
// smoothed version.
const SMALL_BELOW = 64;

// Both drawings sit on a 200×200 canvas; crop to the artwork so `size` is the
// mark's real height and it centers against text.
const VIEW_X = 22;
const VIEW_Y = 18;
const VIEW_W = 156;
const VIEW_H = 163;

interface Props {
  /** Height in points. */
  size: number;
  color?: string;
  variant?: 'auto' | 'full' | 'small';
}

export function TroveMark({ size, color = Colors.text, variant = 'auto' }: Props) {
  const small = variant === 'small' || (variant === 'auto' && size < SMALL_BELOW);
  return (
    <Svg
      width={size * (VIEW_W / VIEW_H)}
      height={size}
      viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={small ? MARK_SMALL_PATH : MARK_FULL_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
