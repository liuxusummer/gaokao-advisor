import { useEffect, useState, useMemo } from 'react'
import { Select, Input, Table, Empty, Spin, Alert } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { probeRankTableYears, loadRankTable, getProvinceName, type RankTableEntry } from '../../../services/dataLoader'

interface RankTableSearchProps {
  provinceId: string
  provinceName: string
}

export default function RankTableSearch({ provinceId, provinceName }: RankTableSearchProps) {
  const displayProvinceName = getProvinceName(provinceId) || provinceName
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | undefined>()
  const [allData, setAllData] = useState<RankTableEntry[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 1. 探测年份
  useEffect(() => {
    if (!provinceName) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const ys = await probeRankTableYears(provinceName)
        if (cancelled) return
        setYears(ys)
        if (ys.length > 0) setSelectedYear(ys[0])
      } catch {
        if (cancelled) return
        setYears([])
        setError('探测可用年份失败，请检查网络或稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [provinceName])

  // 2. 加载完整一分一段表，派生科类选项
  useEffect(() => {
    if (!provinceName || !selectedYear) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const entries = await loadRankTable(provinceName, selectedYear)
        if (cancelled) return
        setAllData(entries)
        const cats = Array.from(new Set(entries.map(e => e.category)))
        if (cats.length > 0) setSelectedCategory(cats[0])
      } catch (err) {
        if (cancelled) return
        setAllData([])
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedYear, provinceName])

  // 派生：科类选项
  const categories = useMemo(
    () => Array.from(new Set(allData.map(e => e.category))),
    [allData]
  )

  // 派生：当前科类下的数据（按分数降序，符合一分一段表常规展示）
  const categoryData = useMemo(
    () => [...allData]
      .filter(e => e.category === selectedCategory)
      .sort((a, b) => b.score - a.score),
    [allData, selectedCategory]
  )

  // 派生：搜索过滤（支持分数/位次/同分人数/累计人数的模糊匹配）
  const filteredData = useMemo(() => {
    if (!search.trim()) return categoryData
    const q = search.trim()
    return categoryData.filter(d =>
      String(d.score).includes(q) ||
      String(d.rank).includes(q) ||
      String(d.count).includes(q) ||
      String(d.cumulativeCount).includes(q)
    )
  }, [categoryData, search])

  if (!provinceName) {
    return (
      <Alert
        type="info"
        showIcon
        message="请先完善省份信息"
        description="一分一段表数据与省份相关，请在个人资料中选择高考省份后再查询。"
      />
    )
  }

  const emptyDescription = search.trim()
    ? '未找到匹配的记录，请尝试其他关键词'
    : years.length === 0
      ? '该省份暂无可查年份的一分一段表数据'
      : '当前科类下暂无数据'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold">{displayProvinceName} 一分一段表</h2>
        <span className="text-xs text-text-secondary">数据来源于各省教育考试院</span>
      </div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span>年份</span>
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={years.map(y => ({ value: y, label: `${y} 年` }))}
            className="w-32"
            placeholder="选择年份"
            notFoundContent="暂无可查年份"
          />
        </div>
        <div className="flex items-center gap-2">
          <span>科类</span>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories.map(c => ({ value: c, label: c }))}
            className="w-32"
            placeholder="选择科类"
          />
        </div>
        <Input
          prefix={<SearchOutlined />}
          placeholder="输入分数、位次、同分人数或累计人数过滤"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
          allowClear
        />
      </div>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Spin spinning={loading}>
        {filteredData.length === 0 && !loading ? (
          <Empty description={emptyDescription} />
        ) : (
          <>
            <div className="text-xs text-text-secondary mb-2">
              当前共 {filteredData.length} 条记录
              {search.trim() ? `（搜索“${search.trim()}”）` : ''}
            </div>
            <Table
              dataSource={filteredData.map((d, i) => ({ ...d, key: `${d.score}-${d.rank}-${i}` }))}
              columns={[
                {
                  title: '分数',
                  dataIndex: 'score',
                  key: 'score',
                  sorter: (a: RankTableEntry, b: RankTableEntry) => a.score - b.score,
                },
                {
                  title: '位次',
                  dataIndex: 'rank',
                  key: 'rank',
                  sorter: (a: RankTableEntry, b: RankTableEntry) => a.rank - b.rank,
                },
                {
                  title: '同分人数',
                  dataIndex: 'count',
                  key: 'count',
                  sorter: (a: RankTableEntry, b: RankTableEntry) => a.count - b.count,
                },
                {
                  title: '累计人数',
                  dataIndex: 'cumulativeCount',
                  key: 'cumulativeCount',
                  sorter: (a: RankTableEntry, b: RankTableEntry) => a.cumulativeCount - b.cumulativeCount,
                },
              ]}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              scroll={{ y: 480 }}
              size="small"
            />
          </>
        )}
      </Spin>
    </div>
  )
}
