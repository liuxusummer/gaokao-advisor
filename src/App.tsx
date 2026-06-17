import { ConfigProvider } from 'antd'
import { antdTheme } from './shared/theme/antd-theme'

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <div className="min-h-screen bg-bg-page text-text-body">
        <h1 className="text-display text-text-primary">智填志愿</h1>
      </div>
    </ConfigProvider>
  )
}

export default App
