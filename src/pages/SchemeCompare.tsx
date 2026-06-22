import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Table, Select, Empty, Checkbox, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useAppStore, type VolunteerScheme } from '../store'

export default function SchemeCompare() {
  const navigate = useNavigate()
  const { schemes } = useAppStore()
  const [mode, setMode] = useState<'compare' | 'single'>('compare')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [singleId, setSingleId] = useState<string>(schemes[0]?.id ?? '')

  if (schemes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Empty description="暂无保存的方案，请先在志愿表页保存方案" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text" />
          <h1 className="text-xl md:text-2xl font-bold">方案对比</h1>
        </div>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="compare">并排对比</Radio.Button>
          <Radio.Button value="single">单套查看</Radio.Button>
        </Radio.Group>
      </div>

      {mode === 'compare' ? (
        <CompareView schemes={schemes} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      ) : (
        <SingleView schemes={schemes} singleId={singleId} setSingleId={setSingleId} />
      )}
    </div>
  )
}

function CompareView({ schemes, selectedIds, setSelectedIds }: {
  schemes: VolunteerScheme[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
}) {
  const selectedSchemes = schemes.filter(s => selectedIds.includes(s.id))
  const maxRows = Math.max(...selectedSchemes.map(s => s.items.length), 0)

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-text-secondary mb-2">选择要对比的方案（至少 2 套）：</div>
        <Checkbox.Group
          options={schemes.map(s => ({ label: `${s.name}（${s.items.length} 个志愿）`, value: s.id }))}
          value={selectedIds}
          onChange={setSelectedIds}
        />
      </div>
      {selectedSchemes.length < 2 ? (
        <Empty description="请至少选择 2 套方案进行对比" />
      ) : (
        <Table
          dataSource={Array.from({ length: maxRows }, (_, i) => ({ key: i, index: i + 1 }))}
          scroll={{ x: 'max-content' }}
          pagination={false}
          size="small"
          columns={[
            { title: '志愿', dataIndex: 'index', key: 'index', fixed: 'left', width: 60 },
            ...selectedSchemes.map(s => ({
              title: s.name,
              key: s.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              render: (_: any, row: any) => {
                const item = s.items[row.index - 1]
                const isDiff = isDifferent(row.index - 1, selectedSchemes)
                return item ? (
                  <div className={isDiff ? 'bg-yellow-50 p-2 rounded' : 'p-2'}>
                    <div className="font-medium">{item.college.name}</div>
                    <div className="text-xs text-text-secondary">{item.major.name}</div>
                  </div>
                ) : <span className="text-text-secondary">-</span>
              }
            }))
          ]}
        />
      )}
    </div>
  )
}

function isDifferent(rowIndex: number, schemes: VolunteerScheme[]): boolean {
  const colleges = schemes.map(s => s.items[rowIndex]?.college.id).filter(Boolean)
  return new Set(colleges).size > 1
}

function SingleView({ schemes, singleId, setSingleId }: {
  schemes: VolunteerScheme[]
  singleId: string
  setSingleId: (id: string) => void
}) {
  const scheme = schemes.find(s => s.id === singleId)

  return (
    <div>
      <Select
        value={singleId}
        onChange={setSingleId}
        options={schemes.map(s => ({ value: s.id, label: `${s.name}（${s.items.length} 个志愿）` }))}
        className="w-64 mb-4"
      />
      {scheme && (
        <div className="space-y-3">
          {scheme.items.map((item, i) => (
            <div key={item.id} className="bg-bg-card rounded-xl p-4 shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">#{i + 1}</span>
                <span className="font-semibold">{item.college.name}</span>
                <span className="text-text-secondary">·</span>
                <span>{item.major.name}</span>
                {item.locked && <span className="text-xs text-orange-500 ml-2">已锁定</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
