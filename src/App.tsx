import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type BloodRecord = {
  id: string
  date: string
  hb: number | null
  rhb: number | null
  treatment: string
  transfusion: string
  memo: string
  updatedAt: string
}

type RecordForm = {
  date: string
  hb: string
  rhb: string
  treatment: string
  transfusion: string
  memo: string
}

type ImportState = {
  fileName: string
  imported: number
  skipped: number
  message: string
}

type ViewMode = 'input' | 'result'

const STORAGE_KEY = 'mds.records.v1'
const AUTH_KEY = 'mds.auth.v1'
const AUTH_PASSWORD = '0415'

const SAMPLE_RECORDS: BloodRecord[] = [
  {
    id: 'sample-1',
    date: '2026-04-02',
    hb: 8.7,
    rhb: 27,
    treatment: '조혈제',
    transfusion: '없음',
    memo: '아침 복용 후 피로감 감소',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    date: '2026-04-18',
    hb: 9.2,
    rhb: 29,
    treatment: '조혈제',
    transfusion: '없음',
    memo: '수치 소폭 상승',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    date: '2026-05-07',
    hb: 8.3,
    rhb: 25,
    treatment: '조혈제, 수혈',
    transfusion: '1 unit',
    memo: '수혈 후 컨디션 회복',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    date: '2026-05-29',
    hb: 9.5,
    rhb: 31,
    treatment: '조혈제',
    transfusion: '없음',
    memo: '최근 추세 안정',
    updatedAt: new Date().toISOString(),
  },
]

const EMPTY_FORM: RecordForm = {
  date: new Date().toISOString().slice(0, 10),
  hb: '',
  rhb: '',
  treatment: '',
  transfusion: '없음',
  memo: '',
}

function App() {
  const [records, setRecords] = useState<BloodRecord[]>(() => loadInitialRecords())
  const [form, setForm] = useState<RecordForm>(EMPTY_FORM)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('result')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => loadInitialAuth())
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  const sortedRecords = useMemo(
    () => [...records].sort((left, right) => right.date.localeCompare(left.date)),
    [records],
  )

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    if (!keyword) {
      return sortedRecords
    }

    return sortedRecords.filter((record) => {
      const combined = [
        record.date,
        record.hb?.toString() ?? '',
        record.rhb?.toString() ?? '',
        record.treatment,
        record.transfusion,
        record.memo,
      ]
        .join(' ')
        .toLowerCase()

      return combined.includes(keyword)
    })
  }, [query, sortedRecords])

  const latestRecord = sortedRecords[0] ?? null
  const previousRecord = sortedRecords[1] ?? null
  const hbTrend = calculateTrend(sortedRecords.map((record) => record.hb))
  const transfusionCount = sortedRecords.filter((record) => record.transfusion !== '없음').length

  const stats = [
    {
      label: '최근 검사일',
      value: latestRecord?.date ? formatDate(latestRecord.date) : '기록 없음',
      note: latestRecord?.memo || 'CSV를 불러오거나 새 기록을 추가하세요.',
    },
    {
      label: '최근 Hb',
      value: latestRecord?.hb != null ? `${latestRecord.hb.toFixed(1)} g/dL` : '-',
      note: hbTrend,
    },
    {
      label: '수혈 기록',
      value: `${transfusionCount}건`,
      note: previousRecord ? `이전 기록: ${formatDate(previousRecord.date)}` : '비교 기록 없음',
    },
    {
      label: '최근 치료',
      value: latestRecord?.treatment || '-',
      note: latestRecord?.transfusion ? `수혈: ${latestRecord.transfusion}` : '기록 없음',
    },
  ]

  function handleFieldChange(field: keyof RecordForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function addRecord(nextRecord: Omit<BloodRecord, 'id' | 'updatedAt'>) {
    setRecords((current) => [
      ...current,
      {
        ...nextRecord,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      },
    ])
    setForm(EMPTY_FORM)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.date) {
      return
    }

    addRecord({
      date: form.date,
      hb: form.hb ? Number(form.hb) : null,
      rhb: form.rhb ? Number(form.rhb) : null,
      treatment: form.treatment.trim(),
      transfusion: form.transfusion.trim() || '없음',
      memo: form.memo.trim(),
    })
  }

  async function handleCsvFile(file: File | null) {
    if (!file) {
      return
    }

    const text = await file.text()
    const imported = parseCsvRecords(text)

    if (imported.length === 0) {
      setImportState({
        fileName: file.name,
        imported: 0,
        skipped: 0,
        message: '가져올 수 있는 행이 없습니다.',
      })
      return
    }

    setRecords((current) => {
      const merged = [...current]
      let skipped = 0

      for (const nextRecord of imported) {
        const duplicateIndex = merged.findIndex((item) => item.date === nextRecord.date)

        if (duplicateIndex >= 0) {
          merged[duplicateIndex] = {
            ...merged[duplicateIndex],
            ...nextRecord,
            id: merged[duplicateIndex].id,
            updatedAt: new Date().toISOString(),
          }
          skipped += 1
          continue
        }

        merged.push({
          ...nextRecord,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
        })
      }

      setImportState({
        fileName: file.name,
        imported: imported.length,
        skipped,
        message: 'CSV를 불러왔습니다. 날짜가 같은 항목은 기존 기록을 덮어씁니다.',
      })

      return merged
    })
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id))
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password === AUTH_PASSWORD) {
      window.localStorage.setItem(AUTH_KEY, 'ok')
      setIsAuthenticated(true)
      setAuthError('')
      setPassword('')
      return
    }

    setAuthError('비밀번호가 맞지 않습니다.')
  }

  if (!isAuthenticated) {
    return (
      <main className="app-shell">
        <section className="panel auth-panel">
          <p className="section-label">보호 화면</p>
          <h2>비밀번호를 입력하세요</h2>
          <p className="helper-text">최초 1회만 입력하면 다음부터는 자동으로 열립니다.</p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              비밀번호
              <input
                type="password"
                inputMode="numeric"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="0415"
                autoFocus
              />
            </label>
            {authError ? <p className="auth-error">{authError}</p> : null}
            <button className="button button-primary full-width" type="submit">
              확인
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">MDS 혈액검사 기록</p>
          <h1>입력 화면과 결과 화면을 분리한 모바일 뷰</h1>
          <p className="hero-copy">
            입력은 간단하게, 결과는 크게 확인할 수 있도록 나눴습니다. 그래프는 Hb(혈색소)
            변화만 표시합니다.
          </p>
        </div>
        <div className="hero-badges">
          <span>큰 글씨</span>
          <span>세로 화면 우선</span>
          <span>오프라인 저장</span>
        </div>
      </header>

      <section className="page-switch" aria-label="페이지 전환">
        <button
          type="button"
          className={`switch-button ${view === 'input' ? 'active' : ''}`}
          onClick={() => setView('input')}
        >
          입력 페이지
        </button>
        <button
          type="button"
          className={`switch-button ${view === 'result' ? 'active' : ''}`}
          onClick={() => setView('result')}
        >
          결과 페이지
        </button>
      </section>

      {view === 'input' ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">CSV 가져오기</p>
                <h2>기존 자료 넣기</h2>
              </div>
              <label className="button button-secondary file-button">
                CSV 선택
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleCsvFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <p className="helper-text">
              날짜, Hb, Reticulocyte Hemoglobin, 조혈제, 수혈, 메모 컬럼을 자동으로 읽습니다.
            </p>
            {importState ? (
              <div className="notice">
                <strong>{importState.fileName}</strong>
                <span>
                  {importState.message} 가져온 행 {importState.imported}개, 덮어쓴 행{' '}
                  {importState.skipped}개
                </span>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">기록 추가</p>
                <h2>새 검사와 치료 기록</h2>
              </div>
            </div>
            <form className="record-form" onSubmit={handleSubmit}>
              <label>
                날짜
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => handleFieldChange('date', event.target.value)}
                  required
                />
              </label>
              <label>
                Hb
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={form.hb}
                  onChange={(event) => handleFieldChange('hb', event.target.value)}
                  placeholder="예: 8.4"
                />
              </label>
              <label>
                Reticulocyte Hemoglobin
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={form.rhb}
                  onChange={(event) => handleFieldChange('rhb', event.target.value)}
                  placeholder="예: 28"
                />
              </label>
              <label>
                조혈제
                <input
                  type="text"
                  value={form.treatment}
                  onChange={(event) => handleFieldChange('treatment', event.target.value)}
                  placeholder="예: 조혈제"
                />
              </label>
              <label>
                수혈
                <select
                  value={form.transfusion}
                  onChange={(event) => handleFieldChange('transfusion', event.target.value)}
                >
                  <option value="없음">없음</option>
                  <option value="1 unit">1 unit</option>
                  <option value="2 unit">2 unit</option>
                  <option value="기타">기타</option>
                </select>
              </label>
              <label className="full-width">
                메모
                <textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => handleFieldChange('memo', event.target.value)}
                  placeholder="컨디션, 증상, 특이사항"
                />
              </label>
              <button className="button button-primary full-width" type="submit">
                기록 저장
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="stats-grid" aria-label="요약 정보">
            {stats.map((item) => (
              <article className="stat-card" key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.note}</span>
              </article>
            ))}
          </section>

          <section className="charts-grid" aria-label="추세 그래프">
            <article className="panel chart-panel">
              <div className="panel-header compact">
                <div>
                  <p className="section-label">Hb 추세</p>
                  <h2>혈색소 변화</h2>
                </div>
                <span className="chart-range">전체 {sortedRecords.length}건</span>
              </div>
              <TrendChart
                records={[...sortedRecords].reverse()}
                label="Hb"
                getValue={(record) => record.hb}
                color="#1d4ed8"
                unit="g/dL"
              />
            </article>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">날짜별 표</p>
                <h2>기록 목록</h2>
              </div>
              <label className="search-box">
                <span>검색</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="날짜, 수치, 메모 검색"
                />
              </label>
            </div>

            <div className="record-list" role="list">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <article className="record-card" key={record.id} role="listitem">
                    <header>
                      <strong>{formatDate(record.date)}</strong>
                      <span>{record.updatedAt ? formatTime(record.updatedAt) : ''}</span>
                    </header>
                    <div className="record-grid">
                      <div>
                        <span>Hb</span>
                        <strong>{record.hb != null ? record.hb.toFixed(1) : '-'}</strong>
                      </div>
                      <div>
                        <span>Reticulocyte Hb</span>
                        <strong>{record.rhb != null ? record.rhb.toFixed(1) : '-'}</strong>
                      </div>
                      <div>
                        <span>치료</span>
                        <strong>{record.treatment || '-'}</strong>
                      </div>
                      <div>
                        <span>수혈</span>
                        <strong>{record.transfusion || '-'}</strong>
                      </div>
                    </div>
                    {record.memo ? <p className="memo">{record.memo}</p> : null}
                    <button
                      className="button button-text"
                      type="button"
                      onClick={() => removeRecord(record.id)}
                    >
                      삭제
                    </button>
                  </article>
                ))
              ) : (
                <p className="empty-state">표시할 기록이 없습니다. CSV를 넣거나 새 기록을 추가하세요.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function calculateTrend(values: Array<number | null>) {
  const recent = values.filter((value): value is number => value != null)

  if (recent.length < 2) {
    return '비교할 기록이 부족합니다.'
  }

  const latest = recent[0]
  const previous = recent[1]
  const diff = latest - previous

  if (Math.abs(diff) < 0.05) {
    return '비슷한 수준으로 유지되고 있습니다.'
  }

  return diff > 0 ? `이전보다 ${diff.toFixed(1)} 상승` : `이전보다 ${Math.abs(diff).toFixed(1)} 하락`
}

function parseCsvRecords(text: string): Omit<BloodRecord, 'id' | 'updatedAt'>[] {
  const rows = parseCsv(text)

  if (rows.length < 2) {
    return []
  }

  const headers = rows[0].map((value) => normalizeHeader(value))
  const dateIndex = findHeaderIndex(headers, ['date', '날짜'])
  const hbIndex = findHeaderIndex(headers, ['hb', 'hemoglobin', '혈색소'])
  const rhbIndex = findHeaderIndex(headers, ['reticulocyte hemoglobin', 'reticulocytehb', 'rhb'])
  const treatmentIndex = findHeaderIndex(headers, ['treatment', '조혈제', '치료'])
  const transfusionIndex = findHeaderIndex(headers, ['transfusion', '수혈'])
  const memoIndex = findHeaderIndex(headers, ['memo', 'note', '메모'])

  return rows.slice(1).flatMap((row) => {
    const date = row[dateIndex] ?? ''

    if (!date) {
      return []
    }

    return [
      {
        date,
        hb: toNumber(row[hbIndex]),
        rhb: toNumber(row[rhbIndex]),
        treatment: row[treatmentIndex] ?? '',
        transfusion: row[transfusionIndex] ?? '없음',
        memo: row[memoIndex] ?? '',
      },
    ]
  })
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]

    if (character === '"' && inQuotes && next === '"') {
      currentValue += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && character === ',') {
      currentRow.push(currentValue.trim())
      currentValue = ''
      continue
    }

    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && next === '\n') {
        index += 1
      }

      if (currentValue.length > 0 || currentRow.length > 0) {
        currentRow.push(currentValue.trim())
        rows.push(currentRow)
        currentRow = []
        currentValue = ''
      }

      continue
    }

    currentValue += character
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim())
    rows.push(currentRow)
  }

  return rows.filter((row) => row.some((value) => value.length > 0))
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const index = headers.findIndex((header) => header === normalizeHeader(candidate))

    if (index >= 0) {
      return index
    }
  }

  return -1
}

function toNumber(value: string | undefined) {
  if (!value) {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

type TrendChartProps = {
  records: BloodRecord[]
  label: string
  unit: string
  color: string
  getValue: (record: BloodRecord) => number | null
}

function TrendChart({ records, label, unit, color, getValue }: TrendChartProps) {
  const values = records.map(getValue)
  const numericValues = values.filter((value): value is number => value != null)

  if (numericValues.length < 2) {
    return <p className="empty-state">차트를 그릴 데이터가 부족합니다.</p>
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const padding = 28
  const width = Math.max(360, padding * 2 + Math.max(records.length - 1, 1) * 72)
  const height = 180
  const spread = maxValue - minValue || 1
  const points = values
    .map((value, index) => {
      if (value == null) {
        return null
      }

      const x = padding + (index * (width - padding * 2)) / Math.max(records.length - 1, 1)
      const y =
        height -
        padding -
        ((value - minValue) * (height - padding * 2)) / spread

      return `${x},${y}`
    })
    .filter(Boolean) as string[]

  return (
    <div className="chart-wrap">
      <div className="chart-scroll" role="region" aria-label="그래프 가로 스크롤 영역">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart"
          role="img"
          aria-label={label}
          style={{ width: `${width}px`, minWidth: '100%' }}
        >
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
          <polyline points={points.join(' ')} stroke={color} fill="none" strokeWidth="6" />
          {values.map((value, index) => {
            if (value == null) {
              return null
            }

            const x = padding + (index * (width - padding * 2)) / Math.max(records.length - 1, 1)
            const y =
              height -
              padding -
              ((value - minValue) * (height - padding * 2)) / spread

            return <circle key={`${label}-${index}`} cx={x} cy={y} r={5} fill={color} />
          })}
        </svg>
      </div>
      <div className="chart-footnote">
        <span>{records[0] ? formatDate(records[0].date) : ''}</span>
        <strong>
          {numericValues[numericValues.length - 1]?.toFixed(1)} {unit}
        </strong>
        <span>{records[records.length - 1] ? formatDate(records[records.length - 1].date) : ''}</span>
      </div>
    </div>
  )
}

export default App

function loadInitialAuth() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(AUTH_KEY) === 'ok'
}

function loadInitialRecords() {
  if (typeof window === 'undefined') {
    return SAMPLE_RECORDS
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return SAMPLE_RECORDS
  }

  try {
    const parsed = JSON.parse(stored) as BloodRecord[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_RECORDS
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return SAMPLE_RECORDS
  }
}
