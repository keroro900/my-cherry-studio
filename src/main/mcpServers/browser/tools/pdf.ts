/**
 * 增强型浏览器工具 - PDF 导出
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

export const PDFSchema = z.object({
  url: z.string().url().optional().describe('URL to export as PDF (uses current page if not provided)'),
  format: z
    .enum(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
    .default('A4')
    .describe('Paper format'),
  landscape: z.boolean().default(false).describe('Use landscape orientation'),
  printBackground: z.boolean().default(true).describe('Print background graphics'),
  scale: z.number().min(0.1).max(2).default(1).describe('Scale factor'),
  marginTop: z.string().default('1cm').describe('Top margin'),
  marginBottom: z.string().default('1cm').describe('Bottom margin'),
  marginLeft: z.string().default('1cm').describe('Left margin'),
  marginRight: z.string().default('1cm').describe('Right margin'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type PDFArgs = z.infer<typeof PDFSchema>

export const pdfToolDefinition = {
  name: 'browser_pdf',
  description: `Export the current page as a PDF document.

Features:
- Multiple paper formats: A0-A6, Letter, Legal, Tabloid, Ledger
- Portrait or landscape orientation
- Print background graphics
- Custom margins
- Scale control

Returns base64-encoded PDF data.`,
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to export as PDF' },
      format: {
        type: 'string',
        enum: ['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
        default: 'A4',
        description: 'Paper format'
      },
      landscape: { type: 'boolean', default: false, description: 'Use landscape orientation' },
      printBackground: { type: 'boolean', default: true, description: 'Print background graphics' },
      scale: { type: 'number', minimum: 0.1, maximum: 2, default: 1, description: 'Scale factor' },
      marginTop: { type: 'string', default: '1cm', description: 'Top margin' },
      marginBottom: { type: 'string', default: '1cm', description: 'Bottom margin' },
      marginLeft: { type: 'string', default: '1cm', description: 'Left margin' },
      marginRight: { type: 'string', default: '1cm', description: 'Right margin' },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    }
  }
}

export async function handlePDF(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = PDFSchema.parse(args)
    const {
      url,
      format,
      landscape,
      printBackground,
      scale,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      sessionId
    } = parsed

    // Navigate if URL provided
    if (url) {
      await controller.open(url, 30000, false, false, false, sessionId)
    }

    // Export PDF
    const base64Data = await controller.exportPDF(
      {
        format,
        landscape,
        printBackground,
        scale,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight
      },
      sessionId
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              format,
              landscape,
              dataLength: base64Data.length,
              data: base64Data
            },
            null,
            2
          )
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `PDF export failed: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    }
  }
}
