import { useEffect, useMemo, useState } from 'react'
import { Input, Select, Table, Tag, Tabs } from 'antd'
import { SearchOutlined, BookOutlined } from '@ant-design/icons'
import { loadColleges, loadMajors, loadScores, getProvinceName, isRealDataAvailable } from '../services/dataLoader'
import { useAppStore } from '../store'
import { colleges as mockColleges, majors as mockMajors, scoreRecords as mockScoreRecords, provinces } from '../data/mock'
import type { College, Major, ScoreRecord } from '../data/mock'
import CollegeNameLink from '../components/CollegeNameLink'

const { TabPane } = Tabs

export default function DataCenter() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-6">数据中心</h1>
      <Tabs defaultActiveKey="college" className="custom-tabs">
        <TabPane tab="院校查询" key="college">
          <CollegeSearch />
        </TabPane>
        <TabPane tab="专业查询" key="major">
          <MajorSearch />
        </TabPane>
        <TabPane tab="分数线查询" key="score">
          <ScoreSearch />
        </TabPane>
      </Tabs>
    </div>
  )
}

function useColleges() {
  const { dataCache } = useAppStore()
  const [colleges, setColleges] = useState<College[]>(mockColleges)
  useEffect(() => {
    if (dataCache?.colleges) return
    let mounted = true
    loadColleges()
      .then((data) => { if (mounted) setColleges(data) })
      .catch(() => { if (mounted) setColleges(mockColleges) })
    return () => { mounted = false }
  }, [dataCache])
  return dataCache?.colleges || colleges
}

function useMajors() {
  const { dataCache } = useAppStore()
  const [majors, setMajors] = useState<Major[]>(mockMajors)
  useEffect(() => {
    if (dataCache?.majors) return
    let mounted = true
    loadMajors()
      .then((data) => { if (mounted) setMajors(data) })
      .catch(() => { if (mounted) setMajors(mockMajors) })
    return () => { mounted = false }
  }, [dataCache])
  return dataCache?.majors || majors
}

function CollegeSearch() {
  const [keyword, setKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState<string[]>([])
  const colleges = useColleges()

  const filtered = useMemo(() => {
    return colleges.filter((c) => {
      const matchKeyword = c.name.includes(keyword) || c.province.includes(keyword)
      const matchLevel = levelFilter.length === 0 || c.tags?.some((l) => levelFilter.includes(l))
      return matchKeyword && matchLevel
    })
  }, [keyword, levelFilter, colleges])

  const columns = [
    {
      title: '院校名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, record: College) => <CollegeNameLink college={record} />,
    },
    { title: '省份', dataIndex: 'province', key: 'province' },
    { title: '城市', dataIndex: 'city', key: 'city' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '层次',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags?: string[]) => (
        <>
          {tags?.map((l) => (
            <Tag key={l} color={l === '985' ? 'success' : l === '211' ? 'blue' : 'default'}>
              {l}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '办学性质',
      dataIndex: 'nature',
      key: 'nature',
      render: (v?: string) => (v === 'public' ? '公办' : v === 'private' ? '民办' : v || '-'),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索院校名称或省份"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="md:w-80"
        />
        <Select
          mode="multiple"
          placeholder="筛选层次"
          value={levelFilter}
          onChange={setLevelFilter}
          options={['985', '211', '双一流'].map((l) => ({ value: l, label: l }))}
          className="md:w-64"
          allowClear
        />
      </div>
      <Table dataSource={filtered} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} />
    </div>
  )
}

function MajorSearch() {
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const majors = useMajors()

  const filtered = useMemo(() => {
    return majors.filter((m) => {
      const matchKeyword = m.name.includes(keyword)
      const matchCategory = categoryFilter.length === 0 || categoryFilter.includes(m.category)
      return matchKeyword && matchCategory
    })
  }, [keyword, categoryFilter, majors])

  const categories = Array.from(new Set(majors.map((m) => m.category)))

  const columns = [
    { title: '专业代码', dataIndex: 'id', key: 'id' },
    { title: '专业名称', dataIndex: 'name', key: 'name' },
    { title: '门类', dataIndex: 'category', key: 'category' },
    { title: '专业类', dataIndex: 'discipline', key: 'discipline' },
    { title: '学制', dataIndex: 'duration', key: 'duration', render: (v?: number) => (v ? `${v}年` : '-') },
    {
      title: '选科要求',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (v?: string[]) => (v?.length ? v.join('+') : '不限'),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索专业名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="md:w-80"
        />
        <Select
          mode="multiple"
          placeholder="筛选门类"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categories.map((c) => ({ value: c, label: c }))}
          className="md:w-64"
          allowClear
        />
      </div>
      <Table dataSource={filtered} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} />
    </div>
  )
}

const PROVINCE_OPTIONS = provinces.map(p => ({ value: p.id, label: p.name }))

function useScoreRecords(provinceId: string, year: number) {
  const isReal = useMemo(() => isRealDataAvailable(provinceId), [provinceId])
  const provinceName = useMemo(() => getProvinceName(provinceId), [provinceId])
  const requestKey = `${provinceId}-${year}`

  const [records, setRecords] = useState<ScoreRecord[]>(mockScoreRecords)
  const [loadedKey, setLoadedKey] = useState<string>(() => (!isReal || !provinceName ? requestKey : ''))

  useEffect(() => {
    if (!isReal || !provinceName) return
    let mounted = true
    const load = async () => {
      setRecords(mockScoreRecords)
      try {
        const data = await loadScores(provinceName, year)
        if (mounted) setRecords(data)
      } catch {
        if (mounted) setRecords(mockScoreRecords)
      } finally {
        if (mounted) setLoadedKey(requestKey)
      }
    }
    load()
    return () => { mounted = false }
  }, [isReal, provinceName, year, requestKey])

  const effectiveRecords = !isReal || !provinceName ? mockScoreRecords : records
  const loading = isReal && !!provinceName && loadedKey !== requestKey
  return { records: effectiveRecords, loading }
}

function ScoreSearch() {
  const [provinceId, setProvinceId] = useState('zhejiang')
  const [year, setYear] = useState(2024)
  const [collegeId, setCollegeId] = useState<string>()
  const [majorName, setMajorName] = useState<string>()
  const colleges = useColleges()
  const { records: scoreRecords, loading } = useScoreRecords(provinceId, year)

  const filtered = useMemo(() => {
    return scoreRecords
      .filter((r) => (collegeId ? r.collegeId === collegeId : true) && (majorName ? r.majorName?.includes(majorName) : true))
      .sort((a, b) => b.year - a.year)
  }, [collegeId, majorName, scoreRecords])

  const columns = [
    { title: '年份', dataIndex: 'year', key: 'year' },
    {
      title: '院校',
      dataIndex: 'collegeId',
      key: 'collegeId',
      render: (id: string, record: ScoreRecord) => {
        const college = colleges.find((c) => c.id === id)
        if (college) return <CollegeNameLink college={college} />
        return <span className="font-bold text-text-primary">{record.collegeName || id}</span>
      },
    },
    {
      title: '专业',
      dataIndex: 'majorName',
      key: 'majorName',
    },
    { title: '批次', dataIndex: 'batch', key: 'batch' },
    { title: '最低分', dataIndex: 'minScore', key: 'minScore' },
    { title: '最低位次', dataIndex: 'minRank', key: 'minRank' },
    { title: '计划数', dataIndex: 'planCount', key: 'planCount' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <Select
          placeholder="省份"
          value={provinceId}
          onChange={setProvinceId}
          options={PROVINCE_OPTIONS}
          className="md:w-32"
        />
        <Select
          placeholder="年份"
          value={year}
          onChange={setYear}
          options={[2025, 2024, 2023].map((y) => ({ value: y, label: `${y}年` }))}
          className="md:w-32"
        />
        <Select
          showSearch
          placeholder="选择院校"
          value={collegeId}
          onChange={setCollegeId}
          options={colleges.map((c) => ({ value: c.id, label: c.name }))}
          className="md:w-64"
          allowClear
        />
        <Input
          placeholder="搜索专业名称"
          value={majorName}
          onChange={(e) => setMajorName(e.target.value)}
          className="md:w-64"
        />
      </div>
      <Table dataSource={filtered} columns={columns} rowKey={(r) => `${r.collegeId}-${r.majorId}-${r.year}`} loading={loading} pagination={{ pageSize: 8 }} />
      <p className="text-xs text-text-secondary flex items-center gap-1">
        <BookOutlined />
        数据来源：教育部全国高等学校名单、阳光高考网、各省教育考试院。
      </p>
    </div>
  )
}
