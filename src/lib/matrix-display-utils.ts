/**
 * Matrix Display Utilities
 * 
 * Utilities for displaying Wolfpack inputs and outputs in rows of 4
 * to match the physical hardware layout (4 inputs/outputs per card).
 */

export interface DisplayRow<T> {
  cardNumber: number
  items: T[]
  startChannel: number
  endChannel: number
}

export interface MatrixDisplayConfig {
  itemsPerRow: number
  showCardLabels: boolean
  highlightActiveCard?: number
}

const DEFAULT_CONFIG: MatrixDisplayConfig = {
  itemsPerRow: 4,
  showCardLabels: true
}

/**
 * Formats an array of items into rows of 4 (matching Wolfpack card layout)
 * @param items Array of inputs or outputs
 * @param config Display configuration
 * @returns Array of display rows
 */
export function formatIntoRows<T extends { channelNumber: number }>(
  items: T[],
  config: Partial<MatrixDisplayConfig> = {}
): DisplayRow<T>[] {
  const { itemsPerRow } = { ...DEFAULT_CONFIG, ...config }
  const rows: DisplayRow<T>[] = []

  for (let i = 0; i < items.length; i += itemsPerRow) {
    const rowItems = items.slice(i, i + itemsPerRow)
    const cardNumber = Math.floor(i / itemsPerRow) + 1

    rows.push({
      cardNumber,
      items: rowItems,
      startChannel: rowItems[0]?.channelNumber || 0,
      endChannel: rowItems[rowItems.length - 1]?.channelNumber || 0
    })
  }

  return rows
}

/**
 * Gets the card number for a given channel number
 * @param channelNumber The channel number
 * @param itemsPerCard Items per card (default 4)
 * @returns Card number (1-based)
 */
export function getCardNumber(channelNumber: number, itemsPerCard: number = 4): number {
  return Math.ceil(channelNumber / itemsPerCard)
}

/**
 * Gets the position within a card for a given channel number
 * @param channelNumber The channel number
 * @param itemsPerCard Items per card (default 4)
 * @returns Position within card (1-4)
 */
export function getCardPosition(channelNumber: number, itemsPerCard: number = 4): number {
  const position = channelNumber % itemsPerCard
  return position === 0 ? itemsPerCard : position
}

/**
 * Generates CSS grid classes for displaying items in rows of 4
 * @param responsive Whether to use responsive breakpoints
 * @returns CSS class string
 */
export function getGridClasses(responsive: boolean = true): string {
  if (responsive) {
    // Mobile: 1 column, Tablet: 2 columns, Desktop: 4 columns
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
  }
  // Always 4 columns
  return 'grid grid-cols-4 gap-4'
}

/**
 * Generates card label for display
 * @param cardNumber Card number (1-based)
 * @param type 'input' or 'output'
 * @returns Formatted card label
 */
export function getCardLabel(cardNumber: number, type: 'input' | 'output'): string {
  return `Card ${cardNumber} (${type === 'input' ? 'Inputs' : 'Outputs'})`
}

/**
 * Calculates total number of cards needed for given items
 * @param itemCount Total number of items
 * @param itemsPerCard Items per card (default 4)
 * @returns Number of cards needed
 */
export function calculateTotalCards(itemCount: number, itemsPerCard: number = 4): number {
  return Math.ceil(itemCount / itemsPerCard)
}

/**
 * Validates if a channel number is valid for the given card configuration
 * @param channelNumber Channel number to validate
 * @param totalCards Total number of cards
 * @param itemsPerCard Items per card (default 4)
 * @returns True if valid
 */
export function isValidChannelNumber(
  channelNumber: number,
  totalCards: number,
  itemsPerCard: number = 4
): boolean {
  const maxChannel = totalCards * itemsPerCard
  return channelNumber >= 1 && channelNumber <= maxChannel
}

/**
 * Gets channel range for a specific card
 * @param cardNumber Card number (1-based)
 * @param itemsPerCard Items per card (default 4)
 * @returns Object with start and end channel numbers
 */
export function getCardChannelRange(
  cardNumber: number,
  itemsPerCard: number = 4
): { start: number; end: number } {
  const start = (cardNumber - 1) * itemsPerCard + 1
  const end = cardNumber * itemsPerCard
  return { start, end }
}
