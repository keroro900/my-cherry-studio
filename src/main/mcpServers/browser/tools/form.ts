/**
 * 增强型浏览器工具 - 表单交互
 */

import * as z from 'zod'

import type { EnhancedBrowserController } from '../enhanced-controller'

const FormFieldSchema = z.object({
  selector: z.string().describe('CSS selector for the form field'),
  value: z.string().describe('Value to set'),
  type: z.enum(['input', 'select', 'checkbox', 'radio', 'textarea']).default('input').describe('Field type')
})

export const FormSchema = z.object({
  url: z.string().url().optional().describe('URL to navigate to before filling form'),
  fields: z.array(FormFieldSchema).describe('Form fields to fill'),
  submitSelector: z.string().optional().describe('CSS selector for submit button'),
  waitAfterSubmit: z.number().default(3000).describe('Wait time after submit (ms)'),
  sessionId: z.string().default('default').describe('Session ID')
})

export type FormArgs = z.infer<typeof FormSchema>

export const formToolDefinition = {
  name: 'browser_form',
  description: `Fill and submit web forms automatically.

Supported field types:
- input: Text input fields
- select: Dropdown selects
- checkbox: Checkboxes (value: 'true'/'false')
- radio: Radio buttons (value: 'true'/'false')
- textarea: Multi-line text areas

Example fields:
[
  { "selector": "#username", "value": "john", "type": "input" },
  { "selector": "#country", "value": "US", "type": "select" },
  { "selector": "#agree", "value": "true", "type": "checkbox" }
]`,
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to before filling form' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the field' },
            value: { type: 'string', description: 'Value to set' },
            type: { type: 'string', enum: ['input', 'select', 'checkbox', 'radio', 'textarea'], default: 'input' }
          },
          required: ['selector', 'value']
        },
        description: 'Form fields to fill'
      },
      submitSelector: { type: 'string', description: 'CSS selector for submit button' },
      waitAfterSubmit: { type: 'number', default: 3000, description: 'Wait time after submit (ms)' },
      sessionId: { type: 'string', default: 'default', description: 'Session ID' }
    },
    required: ['fields']
  }
}

export async function handleForm(
  controller: EnhancedBrowserController,
  args: unknown
): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  try {
    const parsed = FormSchema.parse(args)
    const { url, fields, submitSelector, waitAfterSubmit, sessionId } = parsed

    // Navigate if URL provided
    if (url) {
      await controller.open(url, 30000, false, false, false, sessionId)
    }

    // Fill form fields
    const filledFields: Array<{ selector: string; success: boolean }> = []

    for (const field of fields) {
      try {
        await controller.fillForm([field], sessionId)
        filledFields.push({ selector: field.selector, success: true })
      } catch (error) {
        filledFields.push({ selector: field.selector, success: false })
      }
    }

    // Submit if selector provided
    let submitted = false
    if (submitSelector) {
      try {
        await controller.clickElement(submitSelector, sessionId)
        submitted = true

        // Wait after submit
        await new Promise((resolve) => setTimeout(resolve, waitAfterSubmit))
      } catch {
        // Submit failed
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              filledFields,
              submitted,
              submitSelector: submitSelector || null
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
      content: [{ type: 'text', text: `Form fill failed: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    }
  }
}
