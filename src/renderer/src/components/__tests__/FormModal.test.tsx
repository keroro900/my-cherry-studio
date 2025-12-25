import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'

import FormModal from '../../pages/workflow/components/FormModal'

function Demo() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      <FormModal open={open} title="测试模态框" onClose={() => setOpen(false)}>
        <div>内容</div>
      </FormModal>
    </div>
  )
}

test('模态框打开与关闭（遮罩与ESC）', async () => {
  const user = userEvent.setup()
  render(<Demo />)
  expect(screen.getByText('测试模态框')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByText('测试模态框')).not.toBeInTheDocument()
})
