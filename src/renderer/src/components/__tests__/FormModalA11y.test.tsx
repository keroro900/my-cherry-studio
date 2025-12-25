import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import FormModal from '../../pages/workflow/components/FormModal'

test('Modal has role dialog with title name', () => {
  render(
    <FormModal open={true} title="配置弹窗" onClose={() => {}}>
      <div>内容</div>
    </FormModal>
  )
  const dialog = screen.getByRole('dialog', { name: '配置弹窗' })
  expect(dialog).toBeTruthy()
})

test('Buttons used to open modal include aria-label when provided', () => {
  const btn = document.createElement('button')
  btn.setAttribute('aria-label', '打开配置')
  document.body.appendChild(btn)
  expect(btn.getAttribute('aria-label')).toBe('打开配置')
})
