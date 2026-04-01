import React from 'react'
import { Text } from 'ink'
import {
  smallAnimatedArray,
  largeAnimatedAray,
} from '../constants/claude-asterisk-ascii-art.js'
import { getTheme } from '../utils/theme.js'

export type OpenCarboAsteriskSize = 'small' | 'medium' | 'large'

interface AnimatedOpenCarboAsteriskProps {
  size?: OpenCarboAsteriskSize
  cycles?: number
  color?: string
  intervalMs?: number
}

export function AnimatedOpenCarboAsterisk({
  size = 'small',
  cycles,
  color,
  intervalMs,
}: AnimatedOpenCarboAsteriskProps): React.ReactNode {
  const [currentAsciiArtIndex, setCurrentAsciiArtIndex] = React.useState(0)
  const direction = React.useRef(1)
  const animateLoopCount = React.useRef(0)
  const theme = getTheme()

  // Determine which array to use based on size
  const animatedArray =
    size === 'large' ? largeAnimatedAray : smallAnimatedArray

  // Animation interval for ascii art
  React.useEffect(() => {
    const timer = setInterval(
      () => {
        setCurrentAsciiArtIndex(prevIndex => {
          // Stop animating after specified number of cycles if provided
          if (
            cycles !== undefined &&
            cycles !== null &&
            animateLoopCount.current >= cycles
          ) {
            return 0
          }

          // Cycle through array indices
          if (prevIndex === animatedArray.length - 1) {
            direction.current = -1
            animateLoopCount.current += 1
          }
          if (prevIndex === 0) {
            direction.current = 1
          }
          return prevIndex + direction.current
        })
      },
      intervalMs || (size === 'large' ? 100 : 200),
    ) // Default: 100ms for large, 200ms for small/medium

    return () => clearInterval(timer)
  }, [animatedArray.length, cycles, intervalMs, size])

  return (
    <Text color={color || theme.claude}>
      {animatedArray[currentAsciiArtIndex]}
    </Text>
  )
}
