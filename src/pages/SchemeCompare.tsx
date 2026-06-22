import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Table, Select, Empty, Checkbox, Button, Tag, Modal, Input, Statistic, Row, Col, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, ImportOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons'
import { useAppStore, type VolunteerScheme, type VolunteerItem } from '../store'

const tierLabels = {
  rush: { text: '冲', color: 'text-tier-rush', bg: 'bg-tier-rush/10' },
  stable: { text: '稳', color: 'text-tier-stable', bg: 'bg-tier-stable/10' },
  safe: { text: '保', color: 'text-tier-safe', bg: 'bg-tier-safe/10' },
}

function getInitialSelectedIds(schemes: VolunteerScheme[]): string[] {
  return schemes.length >= 2 ? schemes.slice(0, 2).map(s => s.id) : []
}

export default function SchemeCompare() {
  const navigate = useNavigate()
  const { schemes } = useAppStore()
  const [mode, setMode] = useState<'compare' | 'single'>('compare')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getInitialSelectedIds(schemes))
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
            { title: '志愿', dataIndex: 'index', key: 'index', fixed: 'left', width: 60, align: 'center' },
            ...selectedSchemes.map(s => ({
              title: `${s.name} (${s.items.length})`,
              key: s.id,
              width: 220,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              render: (_: any, row: any) => {
                const item = s.items[row.index - 1]
                const isDiff = isDifferent(row.index - 1, selectedSchemes)
                return item ? (
                  <div className={`${isDiff ? 'bg-yellow-50 border border-yellow-200' : ''} p-2 rounded`}>
                    <div className="font-medium">{item.college.name}</div>
                    <div className="text-xs text-text-secondary">{item.major.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${tierLabels[item.tier].bg} ${tierLabels[item.tier].color}`}>
                        {tierLabels[item.tier].text} {item.probability}%
                      </span>
                      {item.locked && <Tag color="orange" className="m-0"><LockOutlined /> 已锁定</Tag>}
                    </div>
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

function getItemKey(item: VolunteerItem | undefined): string {
  if (!item) return ''
  return `${item.college.id}-${item.major.id}-${item.tier}-${item.probability}`
}

function isDifferent(rowIndex: number, schemes: VolunteerScheme[]): boolean {
  const keys = schemes.map(s => getItemKey(s.items[rowIndex]))
  return new Set(keys).size > 1
}

function SingleView({ schemes, singleId, setSingleId }: {
  schemes: VolunteerScheme[]
  singleId: string
  setSingleId: (id: string) => void
}) {
  const navigate = useNavigate()
  const { loadScheme, deleteScheme, renameScheme } = useAppStore()
  const scheme = schemes.find(s => s.id === singleId)

  const stats = useMemo(() => {
    if (!scheme) return null
    const total = scheme.items.length
    const rush = scheme.items.filter(i => i.tier === 'rush').length
    const stable = scheme.items.filter(i => i.tier === 'stable').length
    const safe = scheme.items.filter(i => i.tier === 'safe').length
    const locked = scheme.items.filter(i => i.locked).length
    const avgProbability = total > 0
      ? Math.round(scheme.items.reduce((sum, i) => sum + i.probability, 0) / total)
      : 0
    return { total, rush, stable, safe, locked, avgProbability }
  }, [scheme])

  const handleRename = () => {
    if (!scheme) return
    let newName = scheme.name
    Modal.confirm({
      title: '重命名方案',
      content: <Input defaultValue={scheme.name} onChange={(e) => { newName = e.target.value }} />,
      onOk: () => {
        renameScheme(scheme.id, newName)
        message.success('方案已重命名')
      },
    })
  }

  const handleLoad = () => {
    if (!scheme) return
    Modal.confirm({
      title: '加载方案',
      content: `确定将「${scheme.name}」加载到当前志愿表吗？当前志愿表将被覆盖。`,
      okText: '加载',
      cancelText: '取消',
      onOk: () => {
        loadScheme(scheme.id)
        message.success('方案已加载')
        navigate('/volunteer-list')
      },
    })
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <Select
          value={singleId}
          onChange={setSingleId}
          options={schemes.map(s => ({ value: s.id, label: `${s.name}（${s.items.length} 个志愿）` }))}
          className="w-64"
        />
        <div className="flex gap-2">
          <Button icon={<ImportOutlined />} onClick={handleLoad}>加载到志愿表</Button>
          <Button icon={<EditOutlined />} onClick={handleRename}>重命名</Button>
          <Popconfirm
            title="删除方案"
            description="删除后无法恢复，是否继续？"
            onConfirm={() => {
              if (scheme) {
                const remaining = schemes.filter(s => s.id !== scheme.id)
                deleteScheme(scheme.id)
                message.success('方案已删除')
                setSingleId(remaining[0]?.id ?? '')
              }
            }}
            okText="删除"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </div>
      </div>
      {stats && (
        <Row gutter={16} className="mb-4">
          <Col><Statistic title="志愿总数" value={stats.total} /></Col>
          <Col><Statistic title="冲" value={stats.rush} valueStyle={{ color: '#ef4444' }} /></Col>
          <Col><Statistic title="稳" value={stats.stable} valueStyle={{ color: '#3b82f6' }} /></Col>
          <Col><Statistic title="保" value={stats.safe} valueStyle={{ color: '#22c55e' }} /></Col>
          <Col><Statistic title="已锁定" value={stats.locked} /></Col>
          <Col><Statistic title="平均概率" value={`${stats.avgProbability}%`} /></Col>
        </Row>
      )}
      {scheme && (
        <div className="space-y-3">
          {scheme.items.map((item, i) => (
            <SchemeItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function SchemeItemCard({ item, index }: { item: VolunteerItem; index: number }) {
  const tier = tierLabels[item.tier]
  return (
    <div className="bg-bg-card rounded-xl p-4 shadow-md flex items-center gap-3 flex-wrap">
      <span className="text-sm text-text-secondary font-mono w-6">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{item.college.name}</span>
          <span className="text-text-secondary">·</span>
          <span>{item.major.name}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tier.bg} ${tier.color}`}>
            {tier.text} {item.probability}%
          </span>
          {item.locked && <Tag color="orange" className="m-0"><LockOutlined /> 已锁定</Tag>}
        </div>
        <div className="text-xs text-text-secondary mt-1">
          {item.college.province}{item.college.city}
          {item.minRank ? ` · 最低位次 ${item.minRank}` : ''}
        </div>
      </div>
    </div>
  )
}
