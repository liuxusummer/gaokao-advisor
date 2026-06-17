import { useState, useMemo } from 'react'
import { Input, Select, Table, Tag, Tabs } from 'antd'
import { SearchOutlined, BookOutlined } from '@ant-design/icons'
import { colleges, majors, scoreRecords } from '../data/mock'

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

function CollegeSearch() {
  const [keyword, setKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState<string[]>([])

  const filtered = useMemo(() => {
    return colleges.filter((c) => {
      const matchKeyword = c.name.includes(keyword) || c.province.includes(keyword)
      const matchLevel = levelFilter.length === 0 || c.level.some((l) => levelFilter.includes(l))
      return matchKeyword && matchLevel
    })
  }, [keyword, levelFilter])

  const columns = [
    { title: '院校名称', dataIndex: 'name', key: 'name' },
    { title: '省份', dataIndex: 'province', key: 'province' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '层次',
      dataIndex: 'level',
      key: 'level',
      render: (levels: string[]) => (
        <>
          {levels.map((l) => (
            <Tag key={l} color={l === '985' ? 'success' : l === '211' ? 'blue' : 'default'}>
              {l}
            </Tag>
          ))}
        </>
      ),
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

  const filtered = useMemo(() => {
    return majors.filter((m) => {
      const matchKeyword = m.name.includes(keyword)
      const matchCategory = categoryFilter.length === 0 || categoryFilter.includes(m.category)
      return matchKeyword && matchCategory
    })
  }, [keyword, categoryFilter])

  const categories = Array.from(new Set(majors.map((m) => m.category)))

  const columns = [
    { title: '专业名称', dataIndex: 'name', key: 'name' },
    { title: '门类', dataIndex: 'category', key: 'category' },
    { title: '学制', dataIndex: 'duration', key: 'duration', render: (v: number) => `${v}年` },
    {
      title: '选科要求',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (v: string[]) => (v.length ? v.join('+') : '不限'),
    },
    { title: '学费', dataIndex: 'tuition', key: 'tuition', render: (v: number) => `¥${v}/年` },
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

function ScoreSearch() {
  const [collegeId, setCollegeId] = useState<string>()
  const [majorId, setMajorId] = useState<string>()

  const filtered = useMemo(() => {
    return scoreRecords
      .filter((r) => (collegeId ? r.collegeId === collegeId : true) && (majorId ? r.majorId === majorId : true))
      .sort((a, b) => b.year - a.year)
  }, [collegeId, majorId])

  const columns = [
    { title: '年份', dataIndex: 'year', key: 'year' },
    {
      title: '院校',
      dataIndex: 'collegeId',
      key: 'collegeId',
      render: (id: string) => colleges.find((c) => c.id === id)?.name,
    },
    {
      title: '专业',
      dataIndex: 'majorId',
      key: 'majorId',
      render: (id: string) => majors.find((m) => m.id === id)?.name,
    },
    { title: '最低分', dataIndex: 'minScore', key: 'minScore' },
    { title: '平均分', dataIndex: 'avgScore', key: 'avgScore' },
    { title: '最低位次', dataIndex: 'minRank', key: 'minRank' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Select
          showSearch
          placeholder="选择院校"
          value={collegeId}
          onChange={setCollegeId}
          options={colleges.map((c) => ({ value: c.id, label: c.name }))}
          className="md:w-64"
          allowClear
        />
        <Select
          showSearch
          placeholder="选择专业"
          value={majorId}
          onChange={setMajorId}
          options={majors.map((m) => ({ value: m.id, label: m.name }))}
          className="md:w-64"
          allowClear
        />
      </div>
      <Table dataSource={filtered} columns={columns} rowKey={(r) => `${r.collegeId}-${r.majorId}-${r.year}`} pagination={{ pageSize: 8 }} />
      <p className="text-xs text-text-secondary flex items-center gap-1">
        <BookOutlined />
        数据来源：院校本科招生网、阳光高考网、各省教育考试院。
      </p>
    </div>
  )
}
