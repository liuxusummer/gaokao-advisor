import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { antdTheme } from './shared/theme/antd-theme'
import { router } from './router'

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

export default App
