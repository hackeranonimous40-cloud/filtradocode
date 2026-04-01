import * as React from 'react'
import { extractTag } from '../../utils/messages.js'
import { getTheme } from '../../utils/theme.js'
import { Box, Text } from 'ink'

export function AssistantLocalCommandOutputMessage({
  content,
}: {
  content: string
}): React.ReactNode[] {
  const stdout = extractTag(content, 'local-command-stdout')
  const stderr = extractTag(content, 'local-command-stderr')
  if (!stdout && !stderr) {
    return []
  }
  const theme = getTheme()
  let insides = [
    format(stdout?.trim(), theme.text),
    format(stderr?.trim(), theme.error),
  ].filter(Boolean)

  if (insides.length === 0) {
    // @ts-ignore
    insides = [<Text key="0">(No output)</Text>]
  }

  return [
    // @ts-ignore
    <Box key="0" gap={1}>
      <Box>
        <Text color={theme.secondaryText}>{'  '}⎿ </Text>
      </Box>
      {insides.map((_, index) => (
        <Box key={index} flexDirection="column">
          {_}
        </Box>
      ))}
    </Box>,
  ]
}

function format(content: string | undefined, color: string): React.ReactNode {
  if (!content) {
    return null
  }
  return <Text color={color}>{content}</Text>
}
