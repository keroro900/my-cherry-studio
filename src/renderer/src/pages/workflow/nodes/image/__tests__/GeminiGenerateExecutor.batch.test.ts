import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { WorkflowNodeType } from '../../definitions'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

describe('GeminiGenerateExecutor batch execution', () => {
  const executor = new GeminiGenerateExecutor()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs ECOM batch: main → back → details', async () => {
    vi.spyOn(WorkflowAiService, 'findGeminiImageProvider').mockResolvedValue({
      provider: { id: 'p1', apiHost: 'https://api', apiKey: 'sk', name: 'provider' } as any,
      model: { id: 'gemini-3-pro-image-preview', name: 'm1' } as any
    })
    vi.spyOn(WorkflowAiService, 'loadImagesAsBase64').mockResolvedValue(['data:image/png;base64,REF1'])

    const seq = [
      'data:image/png;base64,MAIN',
      'data:image/png;base64,BACK',
      'data:image/png;base64,D1',
      'data:image/png;base64,D2'
    ]
    let callIndex = 0
    vi.spyOn(WorkflowAiService, 'generateImage').mockImplementation(async () => seq[callIndex++])

    const inputs = { top_garment: 'data:image/png;base64,AAA', bottom_garment: 'data:image/png;base64,BBB' }
    const config: any = {
      nodeType: WorkflowNodeType.GEMINI_ECOM,
      layout: 'flat_lay',
      fillMode: 'filled',
      enableBack: true,
      enableDetail: true,
      detailTypes: ['collar', 'print'],
      aspectRatio: '3:4',
      imageSize: '2K'
    }
    const context: any = { log: () => {} }

    const result = await executor.execute(inputs, config, context)
    expect(result.status).toBe('success')
    expect(result.outputs.mainImage).toBe(seq[0])
    expect(result.outputs.backImage).toBe(seq[1])
    expect(result.outputs.detailImages).toEqual([seq[2], seq[3]])
  })

  it('runs PATTERN batch set: graphic → seamless', async () => {
    vi.spyOn(WorkflowAiService, 'findGeminiImageProvider').mockResolvedValue({
      provider: { id: 'p1', apiHost: 'https://api', apiKey: 'sk', name: 'provider' } as any,
      model: { id: 'gemini-3-pro-image-preview', name: 'm1' } as any
    })
    vi.spyOn(WorkflowAiService, 'loadImagesAsBase64').mockResolvedValue(['data:image/png;base64,REF1'])

    const seq = ['data:image/png;base64,GRAPHIC', 'data:image/png;base64,SEAMLESS']
    let callIndex = 0
    vi.spyOn(WorkflowAiService, 'generateImage').mockImplementation(async () => seq[callIndex++])

    const inputs = { reference_1: 'data:image/png;base64,AAA' }
    const config: any = {
      nodeType: WorkflowNodeType.GEMINI_PATTERN,
      generationMode: 'mode_a',
      outputType: 'set',
      aspectRatio: '1:1',
      imageSize: '2K'
    }
    const context: any = { log: () => {} }

    const result = await executor.execute(inputs, config, context)
    expect(result.status).toBe('success')
    expect(result.outputs.graphicImage).toBe(seq[0])
    expect(result.outputs.patternImage).toBe(seq[1])
  })
})
