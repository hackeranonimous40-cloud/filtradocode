export type NotebookCellType = 'code' | 'markdown'

export type NotebookCellOutput = {
  output_type: string
  text?: string | string[]
  data?: Record<string, unknown>
  ename?: string
  evalue?: string
  traceback?: string[]
}

export type NotebookOutputImage = {
  image_data: string
  media_type: string
}

export type NotebookCellSourceOutput = {
  output_type: string
  text?: string
  image?: NotebookOutputImage
}

export type NotebookCell = {
  cell_type: NotebookCellType
  source: string | string[]
  outputs?: NotebookCellOutput[]
  execution_count?: number | null
  metadata?: Record<string, unknown>
}

export type NotebookContent = {
  cells: NotebookCell[]
  metadata: {
    language_info?: {
      name?: string
    }
  }
}

export type NotebookCellSource = {
  cell_type: string
  source: string
  outputs?: NotebookCellSourceOutput[]
  cellType?: string
  language?: string
  execution_count?: number | null
  cell?: number
}
