/**
 * JSON 输出约束（单一来源）
 * JSON Output Constraints (Single Source of Truth)
 */

/**
 * 硬性 JSON 输出约束
 */
export const HARD_JSON_OUTPUT_CONSTRAINTS = `[JSON Output Format - CRITICAL]

You MUST output ONLY valid JSON format. No markdown, no explanation, no extra text.

**Format Requirements**:
1. Start directly with { and end with }
2. All keys must be in double quotes
3. All string values must be in double quotes
4. No trailing commas
5. No comments
6. No markdown code blocks

**Example Valid Output**:
{"caption": "A blue cotton t-shirt...", "type": "casual"}

**INVALID Outputs** (DO NOT DO THIS):
- \`\`\`json {...} \`\`\`
- Here is the result: {...}
- {...} // this is the caption`

/**
 * Model 输出模式的 JSON Schema
 */
export const MODEL_OUTPUT_SCHEMA = `{
  "caption": "string - Detailed description for image generation",
  "type": "string - Category: daily | commercial | studio"
}`

/**
 * Pattern 输出模式的 JSON Schema
 */
export const PATTERN_OUTPUT_SCHEMA = `{
  "full_prompt": "string - Complete prompt for pattern generation",
  "type": "string - Pattern category: geometric | floral | abstract | etc"
}`

/**
 * Ecom 输出模式的 JSON Schema
 */
export const ECOM_OUTPUT_SCHEMA = `{
  "full_prompt": "string - Complete prompt for e-commerce image generation",
  "type": "string - Image type: flatlay | hanging | model"
}`

/**
 * All 输出模式的 JSON Schema（包含所有类型）
 */
export const ALL_OUTPUT_SCHEMA = `{
  "model": {
    "caption": "string",
    "type": "string"
  },
  "pattern": {
    "full_prompt": "string",
    "type": "string"
  },
  "ecom": {
    "full_prompt": "string",
    "type": "string"
  }
}`

/**
 * 根据输出模式获取对应的 JSON Schema
 */
export function getOutputSchema(outputMode: string): string {
  switch (outputMode) {
    case 'model':
      return MODEL_OUTPUT_SCHEMA
    case 'pattern':
      return PATTERN_OUTPUT_SCHEMA
    case 'ecom':
      return ECOM_OUTPUT_SCHEMA
    case 'all':
      return ALL_OUTPUT_SCHEMA
    default:
      return MODEL_OUTPUT_SCHEMA
  }
}

/**
 * 获取输出模式的必需字段
 */
export function getRequiredFields(outputMode: string): string[] {
  switch (outputMode) {
    case 'model':
      return ['caption', 'type']
    case 'pattern':
      return ['full_prompt', 'type']
    case 'ecom':
      return ['full_prompt', 'type']
    case 'all':
      return ['model', 'pattern', 'ecom']
    default:
      return ['caption', 'type']
  }
}
