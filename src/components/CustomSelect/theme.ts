export type Theme = {
  option?: (props: { isFocused?: boolean; isSelected?: boolean }) => Record<string, unknown>
  focusIndicator?: () => Record<string, unknown>
  label?: (props: { isFocused?: boolean; isSelected?: boolean }) => Record<string, unknown>
  selectedIndicator?: () => Record<string, unknown>
  container?: () => Record<string, unknown>
  highlightedText?: () => Record<string, unknown>
} & Record<string, unknown>
