import { useEffect, useState, useMemo } from 'react'
import { Select, Input, Table, Empty, Spin } from 'antd'
import { probeRankTableYears, loadRankTable, type RankTableEntry } from '../../../services/dataLoader'

interface RankTableSearchProps {
  provinceId: string
  provinceName: string
}

export default function RankTableSearch({ provinceName }: RankTableSearchProps) {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | undefined>()
  const [allData, setAllData] = useState<RankTableEntry[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 1. 探测年份
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const ys = await probeRankTableYears(provinceName)
        if (cancelled) return
        setYears(ys)
        if (ys.length > 0) setSelectedYear(ys[0])
      } catch {
        if (cancelled) return
        setYears([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [provinceName])

  // 2. 加载完整一分一段表（扁平数组），派生科类选项
  useEffect(() => {
    if (!selectedYear) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const entries = await loadRankTable(provinceName, selectedYear)
        if (cancelled) return
        setAllData(entries)
        const cats = Array.from(new Set(entries.map(e => e.category)))
        if (cats.length > 0) setSelectedCategory(cats[0])
      } catch {
        if (cancelled) return
        setAllData([])
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

  // 派生：当前科类下的数据
  const categoryData = useMemo(
    () => allData.filter(e => e.category === selectedCategory),
    [allData, selectedCategory]
  )

  // 派生：搜索过滤
  const filteredData = useMemo(() => {
    if (!search.trim()) return categoryData
    const q = search.trim()
    return categoryData.filter(d => String(d.score).includes(q) || String(d.rank).includes(q))
  }, [categoryData, search])

  if (years.length === 0 && !loading) {
    return <Empty description="暂无数据" />
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">一分一段表</h2>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span>年份</span>
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={years.map(y => ({ value: y, label: `${y} 年` }))}
            className="w-32"
            placeholder="选择年份"
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
        <Input.Search
          placeholder="搜索分数或位次"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
          allowClear
        />
      </div>
      <Spin spinning={loading}>
        <Table
          dataSource={filteredData.map((d, i) => ({ ...d, key: i }))}
          columns={[
            { title: '分数', dataIndex: 'score', key: 'score' },
            { title: '位次', dataIndex: 'rank', key: 'rank' },
            { title: '同分人数', dataIndex: 'count', key: 'count' },
            { title: '累计人数', dataIndex: 'cumulativeCount', key: 'cumulativeCount' },
          ]}
          pagination={{ pageSize: 50 }}
          scroll={{ y: 500 }}
          size="small"
        />
      </Spin>
    </div>
  )
}
