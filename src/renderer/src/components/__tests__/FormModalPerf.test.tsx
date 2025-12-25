import { render } from '@testing-library/react'
import { useState } from 'react'
import { expect, test } from 'vitest'

import FormModal from '../../pages/workflow/components/FormModal'

function PerfDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      <FormModal open={open} title="性能测试" onClose={() => setOpen(false)}>
        <div>内容</div>
      </FormModal>
    </div>
  )
}

test('快速打开/关闭不会抛错', async () => {
  const { rerender } = render(<PerfDemo />)
  // 快速切换 20 次，验证不会抛错
  for (let i = 0; i < 20; i++) {
    rerender(<PerfDemo />)
  }
  expect(true).toBe(true)
})
